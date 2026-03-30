import "./reservas.css";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isLogged, getUser, getToken } from "../services/auth";

const API_BASE = (
  process.env.REACT_APP_API_URL || "http://127.0.0.1:4000"
).replace(/\/$/, "");

const HOURS = [
  "09:00", "10:30", "12:00", "13:30", "15:00",
  "16:30", "18:00", "19:30", "21:00", "22:30",
];

function nextHour(hhmm, durationMinutes = 90) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + durationMinutes);
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prettyDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function Reservas() {
  const todayISO = toISODate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toISODate(tomorrow);

  const navigate = useNavigate();

  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);
  const [courts, setCourts] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [courtFilter, setCourtFilter] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchHour, setSearchHour] = useState("");

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reserveName, setReserveName] = useState("");
  const [reservePhone, setReservePhone] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/reservas/pistas`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCourts(data.pistas);
      })
      .catch((e) => console.error("Error cargando pistas:", e));
  }, []);

  const loadReservas = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/reservas?fecha=${selectedDateISO}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setReservas(data.reservas);
      })
      .catch((e) => console.error("Error cargando reservas:", e))
      .finally(() => setLoading(false));
  }, [selectedDateISO]);

  useEffect(() => {
    loadReservas();
  }, [loadReservas]);

  const slots = useMemo(() => {
    if (!courts.length) return [];

    const occupiedSet = new Set(
      reservas.map((r) => {
        const hora = r.hora_inicio.slice(0, 5);
        return `${r.pista_id}|${hora}`;
      })
    );

    const result = [];

    for (const hour of HOURS) {
      for (const court of courts) {
        const key = `${court.id}|${hour}`;
        const occupied = occupiedSet.has(key);

        const reservaReal = occupied
          ? reservas.find(
              (r) =>
                r.pista_id === court.id && r.hora_inicio.slice(0, 5) === hour
            )
          : null;

        result.push({
          id: `${selectedDateISO}|${court.id}|${hour}`,
          dateISO: selectedDateISO,
          courtId: court.id,
          courtName: court.nombre,
          start: hour,
          end: nextHour(hour),
          status: occupied ? "ocupada" : "disponible",
          reservaId: reservaReal ? reservaReal.id : null,
          reservaUserId: reservaReal ? reservaReal.usuario_id : null,
          price: 10,
        });
      }
    }

    return result;
  }, [courts, reservas, selectedDateISO]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (courtFilter !== "all" && String(s.courtId) !== courtFilter)
        return false;
      if (onlyAvailable && s.status !== "disponible") return false;
      if (searchHour.trim() && !s.start.includes(searchHour.trim()))
        return false;
      return true;
    });
  }, [slots, courtFilter, onlyAvailable, searchHour]);

  const counts = useMemo(() => {
    const total = slots.length;
    const disponibles = slots.filter((s) => s.status === "disponible").length;
    return { total, disponibles, ocupadas: total - disponibles };
  }, [slots]);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 3500);
  };

  const handleReserve = async () => {
    if (!reserveName.trim()) {
      showToast("Escribe tu nombre para completar la reserva.");
      return;
    }
    if (!reservePhone.trim()) {
      showToast("Escribe un teléfono de contacto.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/reservas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          nombre_cliente: reserveName.trim(),
          telefono_cliente: reservePhone.trim(),
          pista_id: selectedSlot.courtId,
          fecha: selectedSlot.dateISO,
          hora_inicio: selectedSlot.start,
          duracion_min: 90,
          notas: reserveNote.trim() || null,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        showToast("❌ " + (data.message || "Error al reservar"));
        return;
      }

      showToast(
        `✅ Reserva creada: ${selectedSlot.courtName} ${selectedSlot.start}-${selectedSlot.end} (${prettyDate(selectedSlot.dateISO)})`
      );

      setSelectedSlot(null);
      setReserveName("");
      setReservePhone("");
      setReserveNote("");

      loadReservas();
    } catch (e) {
      showToast("❌ Error de conexión con el servidor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (slot) => {
    if (!window.confirm("¿Seguro que quieres cancelar esta reserva?")) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/reservas/${slot.reservaId}/cancelar`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      const data = await res.json();
      if (data.ok) {
        showToast("✅ Reserva cancelada");
        loadReservas();
      } else {
        showToast("❌ " + data.message);
      }
    } catch {
      showToast("❌ Error de conexión");
    }
  };

  return (
    <section className="reservas">
      <div className="reservasHeader">
        <div>
          <h2>Reservas</h2>
          <p className="intro">
            Elige día, pista y hora para reservar tu pista en tiempo real.
          </p>
        </div>

        <div className="summary">
          <div className="summaryItem">
            <strong>{counts.disponibles}</strong>
            <span>Disponibles</span>
          </div>
          <div className="summaryItem">
            <strong>{counts.ocupadas}</strong>
            <span>Ocupadas</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="datePills">
          <button
            className={`pillBtn ${selectedDateISO === todayISO ? "active" : ""}`}
            onClick={() => setSelectedDateISO(todayISO)}
          >
            Hoy
          </button>
          <button
            className={`pillBtn ${selectedDateISO === tomorrowISO ? "active" : ""}`}
            onClick={() => setSelectedDateISO(tomorrowISO)}
          >
            Mañana
          </button>
          <label className="datePicker">
            <span>📅</span>
            <input
              type="date"
              value={selectedDateISO}
              onChange={(e) => setSelectedDateISO(e.target.value)}
            />
          </label>
        </div>

        <div className="filters">
          <select
            value={courtFilter}
            onChange={(e) => setCourtFilter(e.target.value)}
          >
            <option value="all">Todas las pistas</option>
            {courts.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nombre}
              </option>
            ))}
          </select>

          <input
            className="searchHour"
            value={searchHour}
            onChange={(e) => setSearchHour(e.target.value)}
            placeholder="Filtrar por hora (ej: 18)"
          />

          <label className="check">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            <span>Solo disponibles</span>
          </label>
        </div>
      </div>

      <div className="dayTitle">
        <strong>{prettyDate(selectedDateISO)}</strong>
        <span>Selecciona una hora para reservar</span>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", opacity: 0.7 }}>
          Cargando reservas...
        </p>
      ) : (
        <div className="courtsColumns">
          {courts.map((court) => (
            <div key={court.id} className="courtColumn">
              <div className="courtHeader">{court.nombre}</div>
              <div className="courtSlots">
                {filteredSlots
                  .filter((s) => s.courtId === court.id)
                  .map((slot) => (
                    <div
                      key={slot.id}
                      className={`reservaCard ${slot.status}`}
                      role="group"
                      aria-label={`${slot.courtName} ${slot.start}-${slot.end}`}
                    >
                      <div className="cardTop">
                        <strong>
                          {slot.start} → {slot.end}
                        </strong>
                        <span className={`status ${slot.status}`}>
                          {slot.status === "disponible"
                            ? "Disponible"
                            : "Ocupada"}
                        </span>
                      </div>

                      <div className="metaRow">
                        <span className="chip">Precio: {slot.price}€</span>
                        <span className="chip">90 min</span>
                      </div>

                      {slot.status === "disponible" ? (
                        <button
                          className="reserveBtn"
                          onClick={() => {
                            if (!isLogged()) {
                              navigate("/login");
                              return;
                            }
                            setSelectedSlot(slot);
                          }}
                        >
                          Reservar
                        </button>
                      ) : slot.reservaUserId === getUser()?.id ? (
                        <button
                          className="reserveBtn cancelBtn"
                          onClick={() => handleCancel(slot)}
                        >
                          Cancelar mi reserva
                        </button>
                      ) : (
                        <button className="reserveBtn" disabled>
                          No disponible
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {selectedSlot && (
        <div className="modalBackdrop" onClick={() => setSelectedSlot(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <h3>Confirmar reserva</h3>
              <button
                className="closeBtn"
                onClick={() => setSelectedSlot(null)}
              >
                ✕
              </button>
            </div>

            <div className="modalInfo">
              <p className="modalLine">
                <strong>{selectedSlot.courtName}</strong>
                <span>
                  {selectedSlot.start}-{selectedSlot.end}
                </span>
              </p>
              <p className="modalSub">
                {prettyDate(selectedSlot.dateISO)} · {selectedSlot.price}€
              </p>
            </div>

            <div className="form">
              <label>
                Nombre
                <input
                  value={reserveName}
                  onChange={(e) => setReserveName(e.target.value)}
                  placeholder="Ej: Nani"
                />
              </label>

              <label>
                Teléfono
                <input
                  value={reservePhone}
                  onChange={(e) => setReservePhone(e.target.value)}
                  placeholder="Ej: 600 123 456"
                />
              </label>

              <label>
                Nota (opcional)
                <textarea
                  value={reserveNote}
                  onChange={(e) => setReserveNote(e.target.value)}
                  placeholder="Ej: vamos 4 personas, llevamos bolas..."
                  rows={3}
                />
              </label>

              <div className="modalActions">
                <button
                  className="btnGhost"
                  onClick={() => setSelectedSlot(null)}
                >
                  Cancelar
                </button>
                <button
                  className="btnPrimary"
                  onClick={handleReserve}
                  disabled={submitting}
                >
                  {submitting ? "Reservando..." : "Confirmar reserva"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Reservas;