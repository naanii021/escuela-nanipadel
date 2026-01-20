// Página de reservas de pista (versión mejorada, lista para conectar a backend)
import "./reservas.css";
import { useMemo, useState } from "react";

// Horas base (puedes cambiarlo a lo que use tu club)
const HOURS = [
  "09:00", "10:30", "12:00", "13:30", "15:00", "16:30",
   "18:00", "19:30", "21:00", "22:30"
];

// Pistas disponibles (futuro: vendrá de tu BD)
const COURTS = [
  { id: "p1", name: "Pista 1" },
  { id: "p2", name: "Pista 2" },
];

// Genera slots de ejemplo (futuro: vendrán del backend)
function buildMockSlots(dateISO) {
  // dateISO se usa para que puedas diferenciar días si quieres
  // De momento, simulamos algunas ocupadas
  const occupiedSet = new Set([
    `${dateISO}|p2|18:00`,
    `${dateISO}|p1|19:30`,
    `${dateISO}|p1|21:00`,
  ]);

  const slots = [];

  for (const hour of HOURS) {
    for (const court of COURTS) {
      const key = `${dateISO}|${court.id}|${hour}`;
      const occupied = occupiedSet.has(key);

      slots.push({
        id: key,
        dateISO,
        courtId: court.id,
        courtName: court.name,
        start: hour,
        end: nextHour(hour),
        status: occupied ? "ocupada" : "disponible",
        price: 10, // ejemplo fijo, luego lo conectas a configuración
      });
    }
  }

  return slots;
}

// Calcula la siguiente hora "19:00" -> "20:00"
function nextHour(hhmm, durationMinutes = 90) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + durationMinutes);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Devuelve YYYY-MM-DD
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Formato bonito para mostrar
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
  // Fecha seleccionada
  const todayISO = toISODate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toISODate(tomorrow);

  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);

  // Filtros
  const [courtFilter, setCourtFilter] = useState("all"); // all | p1 | p2
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchHour, setSearchHour] = useState(""); // filtrar por texto "18" etc.

  // Modal de reserva
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reserveName, setReserveName] = useState("");
  const [reservePhone, setReservePhone] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [toast, setToast] = useState("");

  // Slots del día (mock)
  const slots = useMemo(() => buildMockSlots(selectedDateISO), [selectedDateISO]);

  // Slots filtrados
  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (courtFilter !== "all" && s.courtId !== courtFilter) return false;
      if (onlyAvailable && s.status !== "disponible") return false;
      if (searchHour.trim() && !s.start.includes(searchHour.trim())) return false;
      return true;
    });
  }, [slots, courtFilter, onlyAvailable, searchHour]);

  // Contadores para mostrar resumen
  const counts = useMemo(() => {
    const total = slots.length;
    const disponibles = slots.filter((s) => s.status === "disponible").length;
    const ocupadas = total - disponibles;
    return { total, disponibles, ocupadas };
  }, [slots]);

  // Reservar (modo demo)
  const handleReserve = () => {
    // Validación simple
    if (!reserveName.trim()) {
      setToast("Escribe tu nombre para completar la reserva.");
      return;
    }
    if (!reservePhone.trim()) {
      setToast("Escribe un teléfono de contacto.");
      return;
    }

    // Aquí en el futuro llamarías a tu backend:
    // POST /api/reservas { slotId, name, phone, note }
    // De momento, simulamos éxito
    setToast(
      `✅ Reserva creada: ${selectedSlot.courtName} ${selectedSlot.start}-${selectedSlot.end} (${prettyDate(selectedSlot.dateISO)})`
    );

    // Cerramos modal y limpiamos
    setSelectedSlot(null);
    setReserveName("");
    setReservePhone("");
    setReserveNote("");

    // Ocultamos toast tras unos segundos
    window.clearTimeout(handleReserve._t);
    handleReserve._t = window.setTimeout(() => setToast(""), 3500);
  };

  return (
    <section className="reservas">
      {/* Cabecera */}
      <div className="reservasHeader">
        <div>
          <h2>Reservas</h2>
          <p className="intro">
            Elige día, pista y hora. En breve lo conectamos al servidor para que sea 100% en tiempo real.
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

      {/* Selector de día */}
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
          <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)}>
            <option value="all">Todas las pistas</option>
            {COURTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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

      {/* Título del día */}
      <div className="dayTitle">
        <strong>{prettyDate(selectedDateISO)}</strong>
        <span>Selecciona un hora para reservar</span>
      </div>

      {/* Grid de reservas */}
      <div className="gridReservas">
        {filteredSlots.map((slot) => (
          <div
            key={slot.id}
            className={`reservaCard ${slot.status}`}
            role="group"
            aria-label={`${slot.courtName} ${slot.start}-${slot.end}`}
          >
            <div className="cardTop">
              <strong>{slot.courtName}</strong>
              <span className={`status ${slot.status}`}>
                {slot.status === "disponible" ? "Disponible" : "Ocupada"}
              </span>
            </div>

            <div className="timeRow">
              <span className="time">{slot.start}</span>
              <span className="dash">→</span>
              <span className="time">{slot.end}</span>
            </div>

            <div className="metaRow">
              <span className="chip">Precio: {slot.price}€</span>
              <span className="chip">Duración: 90 min</span>
            </div>

            <button
              className="reserveBtn"
              disabled={slot.status !== "disponible"}
              onClick={() => setSelectedSlot(slot)}
            >
              {slot.status === "disponible" ? "Reservar" : "No disponible"}
            </button>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Modal */}
      {selectedSlot && (
        <div className="modalBackdrop" onClick={() => setSelectedSlot(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <h3>Confirmar reserva</h3>
              <button className="closeBtn" onClick={() => setSelectedSlot(null)}>
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
                <button className="btnGhost" onClick={() => setSelectedSlot(null)}>
                  Cancelar
                </button>
                <button className="btnPrimary" onClick={handleReserve}>
                  Confirmar reserva
                </button>
              </div>

              <p className="modalHint">
                Esto es modo demo. Luego lo conectamos a tu backend para bloquear huecos de verdad.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Reservas;
