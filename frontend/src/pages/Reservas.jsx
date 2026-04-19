import "./reservas.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isLogged, getUser, getToken } from "../services/auth";

const API_BASE = (
  process.env.REACT_APP_API_URL || "http://127.0.0.1:4000"
).replace(/\/$/, "");

const HOURS = [
  "09:00", "10:30", "12:00", "13:30", "15:00",
  "16:30", "18:00", "19:30", "21:00", "22:30",
];

const TIME_LABELS = { morning: "Mañana", afternoon: "Tarde", evening: "Noche" };
const AVATAR_COLORS = ["#2563eb","#16a34a","#9333ea","#dc2626","#ea580c","#0891b2","#be185d"];

function getTimeOfDay(hhmm) {
  const h = parseInt(hhmm, 10);
  if (h < 13) return "morning";
  if (h < 19) return "afternoon";
  return "evening";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function nextHour(hhmm, durationMinutes = 90) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + durationMinutes);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prettyDate(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

const GhostIcon = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function PlayerAvatars({ nombreCliente, status }) {
  const TOTAL   = 4;
  const color   = getAvatarColor(nombreCliente);
  const initials = getInitials(nombreCliente);

  if (status === "ocupada") {
    return (
      <div className="playerSlots">
        <div className="playerAvatars">
          <div
            className="playerAvatar playerFilled"
            style={{ "--avatar-bg": color }}
            title={nombreCliente || "Reservado"}
            aria-label={`Reservado por ${nombreCliente || "usuario"}`}
          >
            {initials}
          </div>
          {Array.from({ length: TOTAL - 1 }).map((_, i) => (
            <div key={i} className="playerAvatar playerEmpty" aria-hidden="true">{GhostIcon}</div>
          ))}
        </div>
        <div className="playerInfo">
          <span className="playerName">{nombreCliente || "Reservado"}</span>
          <span className="playerOpenBadge">partida abierta</span>
        </div>
      </div>
    );
  }

  return (
    <div className="playerSlots">
      <div className="playerAvatars">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} className="playerAvatar playerEmpty" aria-hidden="true">{GhostIcon}</div>
        ))}
      </div>
      <div className="playerInfo">
        <span className="playerOpenBadge playerOpenAvailable">4 plazas libres</span>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
function Reservas() {
  const [todayISO, tomorrowISO] = useMemo(() => {
    const now = new Date();
    return [toISODate(now), toISODate(new Date(now.getTime() + 86400000))];
  }, []);
  const navigate    = useNavigate();
  const toastTimerRef = useRef(null);

  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);
  const [courts,          setCourts]          = useState([]);
  const [reservas,        setReservas]        = useState([]);
  const [loading,         setLoading]         = useState(true);

  const [courtFilter,    setCourtFilter]    = useState("all");
  const [onlyAvailable,  setOnlyAvailable]  = useState(false);
  const [searchHour,     setSearchHour]     = useState("");

  const [selectedSlot,  setSelectedSlot]  = useState(null);
  const [reserveName,   setReserveName]   = useState("");
  const [reservePhone,  setReservePhone]  = useState("");
  const [reserveNote,   setReserveNote]   = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [toast,         setToast]         = useState({ msg: "", type: "" });

  useEffect(() => {
    fetch(`${API_BASE}/api/reservas/pistas`)
      .then(r => r.json())
      .then(data => { if (data.ok) setCourts(data.pistas); })
      .catch(e => console.error("Error cargando pistas:", e));
  }, []);

  const loadReservas = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/reservas?fecha=${selectedDateISO}`)
      .then(r => r.json())
      .then(data => { if (data.ok) setReservas(data.reservas); })
      .catch(e => console.error("Error cargando reservas:", e))
      .finally(() => setLoading(false));
  }, [selectedDateISO]);

  useEffect(() => { loadReservas(); }, [loadReservas]);

  const slots = useMemo(() => {
    if (!courts.length) return [];
    const reservaMap = new Map(reservas.map(r => [`${r.pista_id}|${r.hora_inicio.slice(0, 5)}`, r]));
    const result = [];
    for (const hour of HOURS) {
      for (const court of courts) {
        const key   = `${court.id}|${hour}`;
        const rData = reservaMap.get(key) ?? null;
        result.push({
          id:                   `${selectedDateISO}|${court.id}|${hour}`,
          dateISO:              selectedDateISO,
          courtId:              court.id,
          courtName:            court.nombre,
          start:                hour,
          end:                  nextHour(hour),
          status:               rData ? "ocupada" : "disponible",
          reservaId:            rData?.id ?? null,
          reservaUserId:        rData?.usuario_id ?? null,
          reservaNombreCliente: rData?.nombre_cliente ?? null,
          timeOfDay:            getTimeOfDay(hour),
          price:                10,
        });
      }
    }
    return result;
  }, [courts, reservas, selectedDateISO]);

  const filteredSlots = useMemo(() => slots.filter(s => {
    if (courtFilter !== "all" && String(s.courtId) !== courtFilter) return false;
    if (onlyAvailable && s.status !== "disponible") return false;
    if (searchHour.trim() && !s.start.includes(searchHour.trim())) return false;
    return true;
  }), [slots, courtFilter, onlyAvailable, searchHour]);

  const counts = useMemo(() => {
    const disponibles = slots.filter(s => s.status === "disponible").length;
    return { total: slots.length, disponibles, ocupadas: slots.length - disponibles };
  }, [slots]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  }, []);

  const handleReserve = async () => {
    if (!reserveName.trim()) { showToast("Escribe tu nombre para completar la reserva.", "error"); return; }
    if (!reservePhone.trim()) { showToast("Escribe un teléfono de contacto.", "error"); return; }
    setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/api/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          nombre_cliente:   reserveName.trim(),
          telefono_cliente: reservePhone.trim(),
          pista_id:         selectedSlot.courtId,
          fecha:            selectedSlot.dateISO,
          hora_inicio:      selectedSlot.start,
          duracion_min:     90,
          notas:            reserveNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || "Error al reservar", "error"); return; }
      showToast(`Reserva creada: ${selectedSlot.courtName} · ${selectedSlot.start}–${selectedSlot.end}`);
      setSelectedSlot(null);
      setReserveName("");
      setReservePhone("");
      setReserveNote("");
      loadReservas();
    } catch {
      showToast("Error de conexión con el servidor", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (slot) => {
    if (!window.confirm("¿Seguro que quieres cancelar esta reserva?")) return;
    try {
      const res  = await fetch(`${API_BASE}/api/reservas/${slot.reservaId}/cancelar`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.ok) { showToast("Reserva cancelada"); loadReservas(); }
      else showToast(data.message, "error");
    } catch {
      showToast("Error de conexión", "error");
    }
  };

  /* ── Render ── */
  return (
    <section className="reservas">

      {/* ── Header ── */}
      <header className="reservasHeader">
        <div className="headerText">
          <span className="reservasEyebrow">Club NaniPadel</span>
          <h2 className="reservasTitle">Reserva tu pista</h2>
          <p className="reservasIntro">Elige día, pista y hora. Disponibilidad en tiempo real.</p>
        </div>
        <div className="summary">
          <div className="summaryItem summaryGreen">
            <strong>{counts.disponibles}</strong>
            <span>Disponibles</span>
          </div>
          <div className="summaryItem summaryRed">
            <strong>{counts.ocupadas}</strong>
            <span>Ocupadas</span>
          </div>
          <div className="summaryItem summaryBlue">
            <strong>{counts.total}</strong>
            <span>Total</span>
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="datePills">
          <button
            className={`pillBtn${selectedDateISO === todayISO ? " active" : ""}`}
            onClick={() => setSelectedDateISO(todayISO)}
          >
            Hoy
          </button>
          <button
            className={`pillBtn${selectedDateISO === tomorrowISO ? " active" : ""}`}
            onClick={() => setSelectedDateISO(tomorrowISO)}
          >
            Mañana
          </button>
          <label className="datePicker">
            <span className="datePickerIcon" aria-hidden="true">▦</span>
            <input
              type="date"
              value={selectedDateISO}
              onChange={e => setSelectedDateISO(e.target.value)}
              aria-label="Seleccionar fecha"
            />
          </label>
        </div>

        <div className="filters">
          <select
            value={courtFilter}
            onChange={e => setCourtFilter(e.target.value)}
            aria-label="Filtrar por pista"
          >
            <option value="all">Todas las pistas</option>
            {courts.map(c => (
              <option key={c.id} value={String(c.id)}>{c.nombre}</option>
            ))}
          </select>

          <input
            className="searchHour"
            value={searchHour}
            onChange={e => setSearchHour(e.target.value)}
            placeholder="Hora (ej: 18)"
            aria-label="Filtrar por hora"
          />

          <label className="check">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={e => setOnlyAvailable(e.target.checked)}
            />
            <span>Solo disponibles</span>
          </label>
        </div>
      </div>

      {/* ── Day title ── */}
      <div className="dayTitle">
        <strong>{prettyDate(selectedDateISO)}</strong>
        <span>Toca un hueco verde para reservar</span>
      </div>

      {/* ── Slots grid ── */}
      {loading ? (
        <div className="loadingSlots">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="slotSkeleton" style={{ "--i": i }} />
          ))}
        </div>
      ) : (
        <div className="courtsColumns">
          {courts.map(court => {
            const courtSlots      = filteredSlots.filter(s => s.courtId === court.id);
            const availableInCourt = courtSlots.filter(s => s.status === "disponible").length;
            return (
              <div key={court.id} className="courtColumn">
                <div className="courtHeader">
                  <span className="courtName">{court.nombre}</span>
                  <span className="courtCount">
                    {availableInCourt} libres
                  </span>
                </div>

                <div className="courtSlots">
                  {courtSlots.map((slot, idx) => (
                    <article
                      key={slot.id}
                      className={`reservaCard ${slot.status} tod${cap(slot.timeOfDay)}`}
                      style={{ "--i": idx }}
                      aria-label={`${slot.courtName} ${slot.start}–${slot.end} ${slot.status}`}
                    >
                      {/* Time-of-day accent stripe */}
                      <div className={`cardStripe stripe${cap(slot.timeOfDay)}`} aria-hidden="true" />

                      {/* Card top */}
                      <div className="cardTop">
                        <span className={`timeTag tag${cap(slot.timeOfDay)}`}>
                          {TIME_LABELS[slot.timeOfDay]}
                        </span>
                        <span className={`statusBadge badge${cap(slot.status)}`}>
                          {slot.status === "disponible" ? "Disponible" : "Ocupada"}
                        </span>
                      </div>

                      {/* Big time display */}
                      <div className="timeDisplay">
                        <span className="timeVal">{slot.start}</span>
                        <span className="timeDash">→</span>
                        <span className="timeVal">{slot.end}</span>
                      </div>

                      {/* Meta chips */}
                      <div className="metaRow">
                        <span className="chip">{slot.price}€</span>
                        <span className="chip">90 min</span>
                      </div>

                      {/* Player slots */}
                      <PlayerAvatars
                        nombreCliente={slot.reservaNombreCliente}
                        status={slot.status}
                      />

                      {/* Action */}
                      {slot.status === "disponible" ? (
                        <button
                          className="reserveBtn btnDisponible"
                          onClick={() => {
                            if (!isLogged()) { navigate("/login"); return; }
                            setSelectedSlot(slot);
                          }}
                        >
                          Reservar ahora
                        </button>
                      ) : slot.reservaUserId === getUser()?.id ? (
                        <button
                          className="reserveBtn btnCancel"
                          onClick={() => handleCancel(slot)}
                        >
                          Cancelar mi reserva
                        </button>
                      ) : (
                        <button className="reserveBtn btnOcupada" disabled>
                          No disponible
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Toast ── */}
      {toast.msg && (
        <div className={`toast toast${cap(toast.type)}`} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}

      {/* ── Modal ── */}
      {selectedSlot && (
        <div className="modalBackdrop" onClick={() => setSelectedSlot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>

            <div className="modalHead">
              <div>
                <h3>Confirmar reserva</h3>
                <p className="modalSubtitle">{selectedSlot.courtName} · {selectedSlot.start}–{selectedSlot.end}</p>
              </div>
              <button className="closeBtn" onClick={() => setSelectedSlot(null)} aria-label="Cerrar">✕</button>
            </div>

            <div className="modalInfo">
              <div className="modalInfoRow">
                <span className="modalInfoLabel">Fecha</span>
                <strong>{prettyDate(selectedSlot.dateISO)}</strong>
              </div>
              <div className="modalInfoRow">
                <span className="modalInfoLabel">Hora</span>
                <strong>{selectedSlot.start} – {selectedSlot.end}</strong>
              </div>
              <div className="modalInfoRow">
                <span className="modalInfoLabel">Precio</span>
                <strong className="modalPrice">{selectedSlot.price}€</strong>
              </div>
            </div>

            <div className="form">
              <label>
                Nombre
                <input
                  value={reserveName}
                  onChange={e => setReserveName(e.target.value)}
                  placeholder="Ej: Nani García"
                  autoComplete="name"
                />
              </label>

              <label>
                Teléfono
                <input
                  value={reservePhone}
                  onChange={e => setReservePhone(e.target.value)}
                  placeholder="Ej: 600 123 456"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>

              <label>
                Nota (opcional)
                <textarea
                  value={reserveNote}
                  onChange={e => setReserveNote(e.target.value)}
                  placeholder="Ej: vamos 4 personas, llevamos bolas..."
                  rows={3}
                />
              </label>

              <div className="modalActions">
                <button className="btnGhost" onClick={() => setSelectedSlot(null)}>
                  Cancelar
                </button>
                <button className="btnPrimary" onClick={handleReserve} disabled={submitting}>
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
