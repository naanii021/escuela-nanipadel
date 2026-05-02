import "./reservas.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";

const HOURS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00", "22:30"];
const TIME_LABELS = { morning: "Manana", afternoon: "Tarde", evening: "Noche" };
const AVATAR_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#dc2626", "#ea580c", "#0891b2", "#be185d"];
const GAME_LEVELS = [
  { value: 0, label: "0 - Iniciacion" },
  { value: 1, label: "1 - Principiante" },
  { value: 2, label: "2 - Medio bajo" },
  { value: 3, label: "3 - Medio" },
  { value: 4, label: "4 - Medio alto" },
  { value: 5, label: "5 - Avanzado" },
  { value: 6, label: "6 - Competicion / profesional" },
];

function getTimeOfDay(hhmm) {
  const hour = parseInt(hhmm, 10);
  if (hour < 13) return "morning";
  if (hour < 19) return "afternoon";
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
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function levelLabel(value) {
  const found = GAME_LEVELS.find((item) => Number(item.value) === Number(value));
  return found ? found.label.replace(/^\d - /, "") : "-";
}

const PlayerIcon = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function PlayerAvatars({ nombreCliente, status, participantes = [], maxJugadores = 4, tipoReserva }) {
  const total = Number(maxJugadores || 4);
  const filledPlayers = tipoReserva === "abierta" ? participantes : [{ nombre: nombreCliente }];

  if (status !== "disponible") {
    return (
      <div className="playerSlots">
        <div className="playerAvatars">
          {filledPlayers.slice(0, total).map((player, index) => {
            const playerName = `${player.nombre || nombreCliente || "Jugador"} ${player.apellidos || ""}`.trim();
            return (
              <div
                key={`${playerName}-${index}`}
                className="playerAvatar playerFilled"
                style={{ "--avatar-bg": getAvatarColor(playerName) }}
                title={playerName}
              >
                {getInitials(playerName)}
              </div>
            );
          })}
          {Array.from({ length: Math.max(total - filledPlayers.length, 0) }).map((_, index) => (
            <div key={index} className="playerAvatar playerEmpty" aria-hidden="true">{PlayerIcon}</div>
          ))}
        </div>
        <div className="playerInfo">
          <span className="playerName">{tipoReserva === "abierta" ? `${filledPlayers.length}/${total} jugadores` : nombreCliente || "Reservado"}</span>
          <span className="playerOpenBadge">{tipoReserva === "abierta" ? "partida abierta" : "reserva completa"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="playerSlots">
      <div className="playerAvatars">
        {Array.from({ length: total }).map((_, index) => (
          <div key={index} className="playerAvatar playerEmpty" aria-hidden="true">{PlayerIcon}</div>
        ))}
      </div>
      <div className="playerInfo">
        <span className="playerOpenBadge playerOpenAvailable">4 plazas libres</span>
      </div>
    </div>
  );
}

function Reservas() {
  const [todayISO, tomorrowISO] = useMemo(() => {
    const now = new Date();
    return [toISODate(now), toISODate(new Date(now.getTime() + 86400000))];
  }, []);
  const navigate = useNavigate();
  const toastTimerRef = useRef(null);

  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);
  const [courts, setCourts] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courtFilter, setCourtFilter] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchHour, setSearchHour] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reserveType, setReserveType] = useState("completa");
  const [reserveName, setReserveName] = useState("");
  const [reservePhone, setReservePhone] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [levelMin, setLevelMin] = useState(0);
  const [levelMax, setLevelMax] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "" });

  useEffect(() => {
    apiGet("/api/reservas/pistas")
      .then((data) => { if (data.ok) setCourts(data.pistas); })
      .catch((e) => console.error("Error cargando pistas:", e));
  }, []);

  const loadReservas = useCallback(() => {
    setLoading(true);
    apiGet(`/api/reservas?fecha=${selectedDateISO}`)
      .then((data) => { if (data.ok) setReservas(data.reservas); })
      .catch((e) => console.error("Error cargando reservas:", e))
      .finally(() => setLoading(false));
  }, [selectedDateISO]);

  useEffect(() => { loadReservas(); }, [loadReservas]);

  const slots = useMemo(() => {
    if (!courts.length) return [];
    const reservaMap = new Map(reservas.map((r) => [`${r.pista_id}|${String(r.hora_inicio).slice(0, 5)}`, r]));
    const result = [];

    for (const hour of HOURS) {
      for (const court of courts) {
        const rData = reservaMap.get(`${court.id}|${hour}`) ?? null;
        const isOpenMatch = rData?.tipo_reserva === "abierta";
        const isOpenWithSeats = isOpenMatch && rData?.estado === "abierta";

        result.push({
          id: `${selectedDateISO}|${court.id}|${hour}`,
          dateISO: selectedDateISO,
          courtId: court.id,
          courtName: court.nombre,
          start: hour,
          end: nextHour(hour),
          status: rData ? (isOpenWithSeats ? "abierta" : "ocupada") : "disponible",
          reservaId: rData?.id ?? null,
          reservaUserId: rData?.usuario_id ?? null,
          reservaNombreCliente: rData?.nombre_cliente ?? null,
          tipoReserva: rData?.tipo_reserva ?? null,
          reservaEstado: rData?.estado ?? null,
          plazasOcupadas: rData?.plazas_ocupadas ?? 0,
          maxJugadores: rData?.max_jugadores ?? 4,
          nivelMin: rData?.nivel_min ?? null,
          nivelMax: rData?.nivel_max ?? null,
          participantes: rData?.participantes ?? [],
          puedeUnirse: Boolean(rData?.puede_unirse),
          motivoNoUnirse: rData?.motivo_no_unirse ?? null,
          timeOfDay: getTimeOfDay(hour),
          price: 10,
        });
      }
    }

    return result;
  }, [courts, reservas, selectedDateISO]);

  const filteredSlots = useMemo(() => slots.filter((slot) => {
    if (courtFilter !== "all" && String(slot.courtId) !== courtFilter) return false;
    if (onlyAvailable && slot.status !== "disponible") return false;
    if (searchHour.trim() && !slot.start.includes(searchHour.trim())) return false;
    return true;
  }), [slots, courtFilter, onlyAvailable, searchHour]);

  const counts = useMemo(() => {
    const disponibles = slots.filter((slot) => slot.status === "disponible").length;
    const abiertas = slots.filter((slot) => slot.status === "abierta").length;
    return { total: slots.length, disponibles, abiertas, ocupadas: slots.length - disponibles };
  }, [slots]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  }, []);

  const openReservationModal = (slot) => {
    const userLevel = Number(getUser()?.nivel_juego);
    if (Number.isInteger(userLevel)) {
      setLevelMin(Math.max(0, userLevel - 1));
      setLevelMax(Math.min(6, userLevel + 1));
    } else {
      setLevelMin(0);
      setLevelMax(6);
    }
    setReserveType("completa");
    setSelectedSlot(slot);
  };

  const closeModal = () => {
    setSelectedSlot(null);
    setReserveType("completa");
    setReserveName("");
    setReservePhone("");
    setReserveNote("");
  };

  const handleReserve = async () => {
    if (reserveType === "completa" && !reserveName.trim()) { showToast("Escribe tu nombre para completar la reserva.", "error"); return; }
    if (reserveType === "completa" && !reservePhone.trim()) { showToast("Escribe un telefono de contacto.", "error"); return; }
    if (reserveType === "abierta" && Number(levelMin) > Number(levelMax)) { showToast("El nivel minimo no puede ser mayor que el maximo.", "error"); return; }

    setSubmitting(true);
    try {
      const data = await apiPost("/api/reservas", {
        tipo_reserva: reserveType,
        nombre_cliente: reserveType === "completa" ? reserveName.trim() : getUser()?.nombre,
        telefono_cliente: reserveType === "completa" ? reservePhone.trim() : null,
        pista_id: selectedSlot.courtId,
        fecha: selectedSlot.dateISO,
        hora_inicio: selectedSlot.start,
        duracion_min: 90,
        nivel_min: reserveType === "abierta" ? Number(levelMin) : null,
        nivel_max: reserveType === "abierta" ? Number(levelMax) : null,
        notas: reserveNote.trim() || null,
      });

      if (!data.ok) { showToast(data.message || "Error al reservar", "error"); return; }
      showToast(reserveType === "abierta" ? "Partida abierta creada" : `Reserva creada: ${selectedSlot.courtName} · ${selectedSlot.start}-${selectedSlot.end}`);
      closeModal();
      loadReservas();
    } catch (e) {
      showToast(e.message || "Error de conexion con el servidor", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinOpenMatch = async (slot) => {
    if (!isLogged()) { navigate("/login"); return; }
    try {
      await apiPost(`/api/reservas/${slot.reservaId}/unirse`, {});
      showToast("Te has unido a la partida");
      loadReservas();
    } catch (e) {
      showToast(e.message || "No puedes unirte a esta partida", "error");
    }
  };

  const handleLeaveOpenMatch = async (slot) => {
    if (!window.confirm("Seguro que quieres salir de esta partida?")) return;
    try {
      await apiDelete(`/api/reservas/${slot.reservaId}/participantes/me`);
      showToast("Has salido de la partida");
      loadReservas();
    } catch (e) {
      showToast(e.message || "No se pudo salir de la partida", "error");
    }
  };

  const handleCancel = async (slot) => {
    if (!window.confirm("Seguro que quieres cancelar esta reserva?")) return;
    try {
      const data = await apiPatch(`/api/reservas/${slot.reservaId}/cancelar`);
      if (data.ok) { showToast("Reserva cancelada"); loadReservas(); }
      else showToast(data.message, "error");
    } catch (e) {
      showToast(e.message || "Error de conexion", "error");
    }
  };

  return (
    <section className="reservas">
      <header className="reservasHeader">
        <div className="headerText">
          <span className="reservasEyebrow">Club NaniPadel</span>
          <h2 className="reservasTitle">Reserva tu pista</h2>
          <p className="reservasIntro">Elige dia, pista y hora. Ahora tambien puedes crear partidas abiertas.</p>
        </div>
        <div className="summary">
          <div className="summaryItem summaryGreen"><strong>{counts.disponibles}</strong><span>Disponibles</span></div>
          <div className="summaryItem summaryBlue"><strong>{counts.abiertas}</strong><span>Abiertas</span></div>
          <div className="summaryItem summaryRed"><strong>{counts.ocupadas}</strong><span>Ocupadas</span></div>
        </div>
      </header>

      <div className="toolbar">
        <div className="datePills">
          <button className={`pillBtn${selectedDateISO === todayISO ? " active" : ""}`} onClick={() => setSelectedDateISO(todayISO)}>Hoy</button>
          <button className={`pillBtn${selectedDateISO === tomorrowISO ? " active" : ""}`} onClick={() => setSelectedDateISO(tomorrowISO)}>Manana</button>
          <label className="datePicker">
            <span className="datePickerIcon" aria-hidden="true">□</span>
            <input type="date" value={selectedDateISO} onChange={(e) => setSelectedDateISO(e.target.value)} aria-label="Seleccionar fecha" />
          </label>
        </div>

        <div className="filters">
          <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)} aria-label="Filtrar por pista">
            <option value="all">Todas las pistas</option>
            {courts.map((court) => <option key={court.id} value={String(court.id)}>{court.nombre}</option>)}
          </select>
          <input className="searchHour" value={searchHour} onChange={(e) => setSearchHour(e.target.value)} placeholder="Hora (ej: 18)" aria-label="Filtrar por hora" />
          <label className="check">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            <span>Solo disponibles</span>
          </label>
        </div>
      </div>

      <div className="dayTitle">
        <strong>{prettyDate(selectedDateISO)}</strong>
        <span>Toca un hueco verde para reservar o una partida abierta para unirte</span>
      </div>

      {loading ? (
        <div className="loadingSlots">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="slotSkeleton" style={{ "--i": i }} />)}
        </div>
      ) : (
        <div className="courtsColumns">
          {courts.map((court) => {
            const courtSlots = filteredSlots.filter((slot) => slot.courtId === court.id);
            const availableInCourt = courtSlots.filter((slot) => slot.status === "disponible").length;
            return (
              <div key={court.id} className="courtColumn">
                <div className="courtHeader">
                  <span className="courtName">{court.nombre}</span>
                  <span className="courtCount">{availableInCourt} libres</span>
                </div>

                <div className="courtSlots">
                  {courtSlots.map((slot, idx) => (
                    <article
                      key={slot.id}
                      className={`reservaCard ${slot.status} tod${cap(slot.timeOfDay)}`}
                      style={{ "--i": idx }}
                      aria-label={`${slot.courtName} ${slot.start}-${slot.end} ${slot.status}`}
                    >
                      <div className={`cardStripe stripe${cap(slot.timeOfDay)}`} aria-hidden="true" />
                      <div className="cardTop">
                        <span className={`timeTag tag${cap(slot.timeOfDay)}`}>{TIME_LABELS[slot.timeOfDay]}</span>
                        <span className={`statusBadge badge${cap(slot.status)}`}>
                          {slot.status === "disponible" ? "Libre" : slot.tipoReserva === "abierta" ? (slot.plazasOcupadas >= slot.maxJugadores ? "Partida completa" : "Partida abierta") : "Reservada"}
                        </span>
                      </div>

                      <div className="timeDisplay">
                        <span className="timeVal">{slot.start}</span>
                        <span className="timeDash">→</span>
                        <span className="timeVal">{slot.end}</span>
                      </div>

                      <div className="metaRow">
                        <span className="chip">{slot.price}€</span>
                        <span className="chip">90 min</span>
                        {slot.tipoReserva === "abierta" && <span className="chip chipLevel">Nivel {slot.nivelMin} - {slot.nivelMax}</span>}
                      </div>

                      <PlayerAvatars
                        nombreCliente={slot.reservaNombreCliente}
                        status={slot.status}
                        participantes={slot.participantes}
                        maxJugadores={slot.maxJugadores}
                        tipoReserva={slot.tipoReserva}
                      />

                      {slot.status === "disponible" ? (
                        <button
                          className="reserveBtn btnDisponible"
                          onClick={() => {
                            if (!isLogged()) { navigate("/login"); return; }
                            openReservationModal(slot);
                          }}
                        >
                          Reservar ahora
                        </button>
                      ) : slot.tipoReserva === "abierta" ? (
                        <div className="openMatchActions">
                          {slot.puedeUnirse ? (
                            <button className="reserveBtn btnJoin" onClick={() => handleJoinOpenMatch(slot)}>Unirme</button>
                          ) : slot.motivoNoUnirse === "Ya estas en esta partida." ? (
                            <button className="reserveBtn btnCancel" onClick={() => handleLeaveOpenMatch(slot)}>Salir de partida</button>
                          ) : (
                            <button className="reserveBtn btnOcupada" disabled>{slot.motivoNoUnirse || "No disponible"}</button>
                          )}
                        </div>
                      ) : slot.reservaUserId === getUser()?.id ? (
                        <button className="reserveBtn btnCancel" onClick={() => handleCancel(slot)}>Cancelar mi reserva</button>
                      ) : (
                        <button className="reserveBtn btnOcupada" disabled>No disponible</button>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast.msg && <div className={`toast toast${cap(toast.type)}`} role="status" aria-live="polite">{toast.msg}</div>}

      {selectedSlot && (
        <div className="modalBackdrop" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead">
              <div>
                <h3>Confirmar reserva</h3>
                <p className="modalSubtitle">{selectedSlot.courtName} · {selectedSlot.start}-{selectedSlot.end}</p>
              </div>
              <button className="closeBtn" onClick={closeModal} aria-label="Cerrar">x</button>
            </div>

            <div className="modalInfo">
              <div className="modalInfoRow"><span className="modalInfoLabel">Fecha</span><strong>{prettyDate(selectedSlot.dateISO)}</strong></div>
              <div className="modalInfoRow"><span className="modalInfoLabel">Hora</span><strong>{selectedSlot.start} - {selectedSlot.end}</strong></div>
              <div className="modalInfoRow"><span className="modalInfoLabel">Precio</span><strong className="modalPrice">{selectedSlot.price}€</strong></div>
            </div>

            <div className="reservationTypeGrid" role="radiogroup" aria-label="Tipo de reserva">
              <button type="button" className={reserveType === "completa" ? "reservationType active" : "reservationType"} onClick={() => setReserveType("completa")}>
                <strong>Reservar pista completa</strong>
                <span>Reserva las 4 plazas para ti.</span>
              </button>
              <button type="button" className={reserveType === "abierta" ? "reservationType active" : "reservationType"} onClick={() => setReserveType("abierta")}>
                <strong>Crear partida abierta</strong>
                <span>Reserva tu plaza y permite que otros jugadores se unan.</span>
              </button>
            </div>

            <div className="form">
              {reserveType === "completa" ? (
                <>
                  <label>Nombre<input value={reserveName} onChange={(e) => setReserveName(e.target.value)} placeholder="Ej: Nani Garcia" autoComplete="name" /></label>
                  <label>Telefono<input value={reservePhone} onChange={(e) => setReservePhone(e.target.value)} placeholder="Ej: 600 123 456" autoComplete="tel" inputMode="tel" /></label>
                </>
              ) : (
                <div className="levelRangeGrid">
                  <label>Nivel minimo<select value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))}>{GAME_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
                  <label>Nivel maximo<select value={levelMax} onChange={(e) => setLevelMax(Number(e.target.value))}>{GAME_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
                  <p className="levelHelp">Jugadores recomendados: nivel {levelMin} - {levelMax} ({levelLabel(levelMin)} - {levelLabel(levelMax)}).</p>
                </div>
              )}

              <label>Nota (opcional)<textarea value={reserveNote} onChange={(e) => setReserveNote(e.target.value)} placeholder="Ej: preferencia de pista, bolas, observaciones..." rows={3} /></label>

              <div className="modalActions">
                <button className="btnGhost" onClick={closeModal}>Cancelar</button>
                <button className="btnPrimary" onClick={handleReserve} disabled={submitting}>{submitting ? "Reservando..." : reserveType === "abierta" ? "Crear partida abierta" : "Confirmar reserva"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Reservas;
