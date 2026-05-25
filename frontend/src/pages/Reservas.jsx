import "./reservas.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import { requestNotificationsRefresh } from "../services/notificationEvents";

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

function playerName(player) {
  return `${player?.nombre || "Jugador"} ${player?.apellidos || ""}`.trim();
}

function participantName(player, fallback = "Jugador") {
  if (!player) return fallback;
  if (player.tipo_participante === "invitado") return player.nombre_invitado || player.nombre || "Invitado";
  return `${player.nombre || fallback} ${player.apellidos || ""}`.trim();
}

function freeSeats(slot) {
  return Math.max(Number(slot?.maxJugadores || 4) - Number(slot?.plazasOcupadas || 0), 0);
}

function slotStateLabel(slot) {
  if (!slot) return "";
  if (slot.status === "disponible") return "Libre";
  if (slot.tipoReserva === "abierta") {
    return Number(slot.plazasOcupadas) >= Number(slot.maxJugadores) ? "Partida completa" : "Partida abierta";
  }
  if (slot.reservaEstado === "cancelada") return "Cancelada";
  return "Reserva privada";
}

function compatibilityText(slot) {
  if (!slot || slot.tipoReserva !== "abierta") return null;
  if (slot.motivoNoUnirse === "Ya estas en esta partida.") return "Ya formas parte de esta partida.";
  if (slot.puedeUnirse) return "Tu nivel encaja con esta partida.";
  return slot.motivoNoUnirse || "No puedes unirte a esta partida.";
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
            const playerLabel = participantName(player, nombreCliente || "Jugador");
            const isGuest = player?.tipo_participante === "invitado";
            return (
              <div
                key={`${playerLabel}-${index}`}
                className={`playerAvatar playerFilled${isGuest ? " playerGuest" : ""}`}
                style={{ "--avatar-bg": getAvatarColor(playerLabel) }}
                title={isGuest ? `${playerLabel} · Invitado` : playerLabel}
              >
                {getInitials(playerLabel)}
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
  const [detailSlot, setDetailSlot] = useState(null);
  const [reserveType, setReserveType] = useState("completa");
  const [reserveName, setReserveName] = useState("");
  const [reservePhone, setReservePhone] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [levelMin, setLevelMin] = useState(0);
  const [levelMax, setLevelMax] = useState(6);
  const [openMatchGuests, setOpenMatchGuests] = useState(0);
  const [joinSlot, setJoinSlot] = useState(null);
  const [joinGuests, setJoinGuests] = useState(0);
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
    const reservaMap = new Map(
      reservas
        .filter((r) => r.estado !== "cancelada")
        .filter((r) => r.tipo_reserva !== "abierta" || Number(r.plazas_ocupadas || 0) > 0)
        .map((r) => [`${r.pista_id}|${String(r.hora_inicio).slice(0, 5)}`, r])
    );
    const result = [];

    for (const hour of HOURS) {
      for (const court of courts) {
        const rData = reservaMap.get(`${court.id}|${hour}`) ?? null;
        const isOpenMatch = rData?.tipo_reserva === "abierta" && Number(rData?.plazas_ocupadas || 0) > 0;
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
          notas: rData?.notas ?? null,
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
    setOpenMatchGuests(0);
    setReserveType("completa");
    setSelectedSlot(slot);
  };

  const openJoinGuestModal = (slot) => {
    if (!isLogged()) { navigate("/login"); return; }
    setDetailSlot(null);
    setJoinGuests(0);
    setJoinSlot(slot);
  };

  const closeJoinGuestModal = () => {
    setJoinSlot(null);
    setJoinGuests(0);
  };

  const openDetailModal = (slot) => {
    setDetailSlot(slot);
  };

  const closeDetailModal = () => {
    setDetailSlot(null);
  };

  const closeModal = () => {
    setSelectedSlot(null);
    setReserveType("completa");
    setReserveName("");
    setReservePhone("");
    setReserveNote("");
    setOpenMatchGuests(0);
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
        num_invitados: reserveType === "abierta" ? Number(openMatchGuests) : 0,
        notas: reserveNote.trim() || null,
      });

      if (!data.ok) { showToast(data.message || "No hemos podido crear la reserva.", "error"); return; }
      showToast(reserveType === "abierta" ? "Partida abierta creada. Otros jugadores ya pueden apuntarse." : `Reserva confirmada: ${selectedSlot.courtName} · ${selectedSlot.start}-${selectedSlot.end}`);
      closeModal();
      loadReservas();
      requestNotificationsRefresh();
    } catch (e) {
      showToast(e.message || "No hemos podido conectar con el club. Intentalo de nuevo.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinOpenMatch = async (slot, numInvitados = 0) => {
    if (!isLogged()) { navigate("/login"); return; }
    try {
      await apiPost(`/api/reservas/${slot.reservaId}/unirse`, {
        num_invitados: Number(numInvitados),
      });
      showToast(Number(numInvitados) ? `Ya estais apuntados a la partida (${Number(numInvitados) + 1} plazas).` : "Ya estas apuntado a la partida.");
      closeJoinGuestModal();
      loadReservas();
      requestNotificationsRefresh();
    } catch (e) {
      showToast(e.message || "Ahora mismo no puedes unirte a esta partida.", "error");
    }
  };

  const handleLeaveOpenMatch = async (slot) => {
    if (!window.confirm("Quieres salir de esta partida?")) return;
    try {
      const data = await apiDelete(`/api/reservas/${slot.reservaId}/participantes/me`);
      showToast(data.invitados_cancelados > 0 ? "Has salido de la partida junto con tus invitados." : (data.message || "Has salido de la partida."));
      loadReservas();
      requestNotificationsRefresh();
    } catch (e) {
      showToast(e.message || "No hemos podido sacarte de la partida.", "error");
    }
  };

  const handleCancel = async (slot) => {
    if (!window.confirm("Quieres cancelar esta reserva?")) return;
    try {
      const data = await apiPatch(`/api/reservas/${slot.reservaId}/cancelar`);
      if (data.ok) { showToast("Reserva cancelada"); loadReservas(); requestNotificationsRefresh(); }
      else showToast(data.message || "No hemos podido cancelar la reserva.", "error");
    } catch (e) {
      showToast(e.message || "No hemos podido conectar con el club.", "error");
    }
  };

  const handleShareSlot = async (slot) => {
    const text = `${slotStateLabel(slot)} en ${slot.courtName}: ${prettyDate(slot.dateISO)} de ${slot.start} a ${slot.end}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "NaniPadel", text, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} - ${window.location.href}`);
        showToast("Enlace de la partida copiado");
      }
    } catch {
      showToast("No hemos podido compartir la partida.", "error");
    }
  };

  return (
    <section className="reservas">
      <header className="reservasHeader">
        <div className="headerText">
          <span className="reservasEyebrow">Club NaniPadel</span>
          <h2 className="reservasTitle">Reserva pista</h2>
          <p className="reservasIntro">Elige dia, pista y hora. Puedes reservar la pista completa o crear una partida abierta.</p>
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
        <span>Toca una hora libre para reservar o una partida abierta para unirte.</span>
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
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetailModal(slot)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDetailModal(slot);
                        }
                      }}
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
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isLogged()) { navigate("/login"); return; }
                            openReservationModal(slot);
                          }}
                        >
                          Reservar ahora
                        </button>
                      ) : slot.tipoReserva === "abierta" ? (
                        <div className="openMatchActions">
                          {slot.puedeUnirse ? (
                            <button className="reserveBtn btnJoin" onClick={(event) => { event.stopPropagation(); openJoinGuestModal(slot); }}>Unirme</button>
                          ) : slot.motivoNoUnirse === "Ya estas en esta partida." ? (
                            <button className="reserveBtn btnCancel" onClick={(event) => { event.stopPropagation(); handleLeaveOpenMatch(slot); }}>Salir de partida</button>
                          ) : (
                            <button className="reserveBtn btnOcupada" disabled>{slot.motivoNoUnirse || "No disponible"}</button>
                          )}
                        </div>
                      ) : slot.reservaUserId === getUser()?.id ? (
                        <button className="reserveBtn btnCancel" onClick={(event) => { event.stopPropagation(); handleCancel(slot); }}>Cancelar mi reserva</button>
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

      {detailSlot && (
        <div className="modalBackdrop" onClick={closeDetailModal}>
          <aside className="reservationDetail" onClick={(event) => event.stopPropagation()} aria-label="Detalle de reserva">
            <div className="detailHero">
              <div>
                <span className={`detailState detailState${cap(detailSlot.status)}`}>{slotStateLabel(detailSlot)}</span>
                <h3>{detailSlot.courtName}</h3>
                <p>{prettyDate(detailSlot.dateISO)} · {detailSlot.start} - {detailSlot.end} · 90 min</p>
              </div>
              <button className="closeBtn" onClick={closeDetailModal} aria-label="Cerrar">x</button>
            </div>

            <div className="detailSummary">
              <div><span>Precio</span><strong>{detailSlot.price}€</strong></div>
              <div><span>Tipo</span><strong>{detailSlot.tipoReserva === "abierta" ? "Partida abierta" : detailSlot.status === "disponible" ? "Libre" : "Reserva privada"}</strong></div>
              <div><span>Plazas</span><strong>{detailSlot.status === "disponible" ? "4 libres" : `${detailSlot.plazasOcupadas || 4}/${detailSlot.maxJugadores || 4}`}</strong></div>
              <div><span>Nivel</span><strong>{detailSlot.tipoReserva === "abierta" ? `${detailSlot.nivelMin} - ${detailSlot.nivelMax}` : "Sin rango"}</strong></div>
            </div>

            {detailSlot.tipoReserva === "abierta" && (
              <div className={`compatibilityBox ${detailSlot.puedeUnirse ? "ok" : "warn"}`}>
                <strong>{Number(detailSlot.maxJugadores) - Number(detailSlot.plazasOcupadas)} plazas disponibles</strong>
                <span>{compatibilityText(detailSlot)}</span>
              </div>
            )}

            <section className="detailSection">
              <div className="detailSectionHead">
                <h4>Jugadores</h4>
                <span>{detailSlot.tipoReserva === "abierta" ? "Partida normal" : "Reserva privada"}</span>
              </div>
              <div className="detailPlayers">
                {Array.from({ length: Number(detailSlot.maxJugadores || 4) }).map((_, index) => {
                  const player = detailSlot.tipoReserva === "abierta" ? detailSlot.participantes[index] : index === 0 ? { nombre: detailSlot.reservaNombreCliente || "Reserva privada" } : null;
                  const name = player ? participantName(player) : playerName(player);
                  const isGuest = player?.tipo_participante === "invitado";
                  return (
                    <article key={index} className={player ? `detailPlayer filled${isGuest ? " guest" : ""}` : "detailPlayer empty"}>
                      {player?.foto_perfil_url ? (
                        <img src={player.foto_perfil_url} alt="" className="detailAvatarImg" />
                      ) : (
                        <div className="detailAvatar" style={{ "--avatar-bg": getAvatarColor(name) }}>
                          {player ? getInitials(name) : PlayerIcon}
                        </div>
                      )}
                      <div>
                        <strong>{player ? name : "Plaza libre"}</strong>
                        {player ? (
                          <>
                            <span>{isGuest ? "Invitado de la partida" : player.nivel_juego !== null && player.nivel_juego !== undefined ? `Nivel ${player.nivel_juego} · ${levelLabel(player.nivel_juego)}` : "Nivel no configurado"}</span>
                            {!isGuest && (player.mano_dominante || player.lado_preferido || player.club_habitual) && (
                              <small>
                                {[player.mano_dominante, player.lado_preferido, player.club_habitual].filter(Boolean).join(" · ")}
                              </small>
                            )}
                          </>
                        ) : (
                          <span>Disponible para otro jugador</span>
                        )}
                      </div>
                      {player?.es_creador ? <em>Creador</em> : null}
                      {isGuest ? <em className="guestBadge">Invitado</em> : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="detailSection">
              <div className="detailSectionHead">
                <h4>Notas</h4>
                <span>{detailSlot.tipoReserva === "abierta" ? "Mensaje del creador" : "Informacion"}</span>
              </div>
              <p className="detailNotes">
                {detailSlot.notas || (detailSlot.status === "disponible" ? "Hora libre para reservar pista completa o abrir partida." : "Sin notas anadidas.")}
              </p>
            </section>

            <div className="detailActions">
              {detailSlot.status === "disponible" ? (
                <button className="btnPrimary" onClick={() => { closeDetailModal(); if (!isLogged()) { navigate("/login"); return; } openReservationModal(detailSlot); }}>Reservar esta hora</button>
              ) : detailSlot.tipoReserva === "abierta" ? (
                <>
                  {detailSlot.puedeUnirse && <button className="btnPrimary" onClick={() => openJoinGuestModal(detailSlot)}>Unirme</button>}
                  {detailSlot.motivoNoUnirse === "Ya estas en esta partida." && <button className="btnGhost" onClick={() => handleLeaveOpenMatch(detailSlot)}>Salir de la partida</button>}
                  {detailSlot.reservaUserId === getUser()?.id && <button className="btnDanger" onClick={() => handleCancel(detailSlot)}>Cancelar partida</button>}
                </>
              ) : detailSlot.reservaUserId === getUser()?.id ? (
                <button className="btnDanger" onClick={() => handleCancel(detailSlot)}>Cancelar reserva</button>
              ) : null}
              <button className="btnGhost" onClick={() => handleShareSlot(detailSlot)}>Compartir partida</button>
              <button className="btnGhost" onClick={closeDetailModal}>Cerrar</button>
            </div>
          </aside>
        </div>
      )}

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
                <span>Te apuntas tu y dejas plazas libres para otros jugadores.</span>
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
                  <label>Invitados<select value={openMatchGuests} onChange={(e) => setOpenMatchGuests(Number(e.target.value))}>{[0, 1, 2, 3].map((value) => <option key={value} value={value}>{value} {value === 1 ? "invitado" : "invitados"}</option>)}</select></label>
                  <p className="levelHelp">Rango recomendado: nivel {levelMin} - {levelMax} ({levelLabel(levelMin)} - {levelLabel(levelMax)}).</p>
                  <p className="guestHelp">Tu plaza cuenta como jugador. Si llevas invitados, cada uno ocupa una plaza adicional.</p>
                </div>
              )}

              <label>Nota (opcional)<textarea value={reserveNote} onChange={(e) => setReserveNote(e.target.value)} placeholder="Ej: preferencia de pista o comentario para los jugadores..." rows={3} /></label>

              <div className="modalActions">
                <button className="btnGhost" onClick={closeModal}>Cancelar</button>
                <button className="btnPrimary" onClick={handleReserve} disabled={submitting}>{submitting ? "Reservando..." : reserveType === "abierta" ? "Crear partida abierta" : "Confirmar reserva"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {joinSlot && (
        <div className="modalBackdrop" onClick={closeJoinGuestModal}>
          <div className="modal joinModal" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead">
              <div>
                <h3>Unirte a la partida</h3>
                <p className="modalSubtitle">{joinSlot.courtName} · {joinSlot.start}-{joinSlot.end}</p>
              </div>
              <button className="closeBtn" onClick={closeJoinGuestModal} aria-label="Cerrar">x</button>
            </div>

            <div className="modalInfo">
              <div className="modalInfoRow"><span className="modalInfoLabel">Plazas libres</span><strong>{freeSeats(joinSlot)}</strong></div>
              <div className="modalInfoRow"><span className="modalInfoLabel">Tu plaza</span><strong>1 jugador</strong></div>
              <div className="modalInfoRow"><span className="modalInfoLabel">Invitados max.</span><strong>{Math.max(freeSeats(joinSlot) - 1, 0)}</strong></div>
            </div>

            <div className="form joinGuestForm">
              <label>Invitados que llevas
                <select value={joinGuests} onChange={(e) => setJoinGuests(Number(e.target.value))}>
                  {Array.from({ length: Math.max(freeSeats(joinSlot) - 1, 0) + 1 }).map((_, value) => (
                    <option key={value} value={value}>{value} {value === 1 ? "invitado" : "invitados"}</option>
                  ))}
                </select>
              </label>
              <p className="guestHelp">Se reservaran {Number(joinGuests) + 1} plaza{Number(joinGuests) === 0 ? "" : "s"}: la tuya y {Number(joinGuests)} invitado{Number(joinGuests) === 1 ? "" : "s"}.</p>
              <div className="modalActions">
                <button className="btnGhost" onClick={closeJoinGuestModal}>Cancelar</button>
                <button className="btnPrimary" onClick={() => handleJoinOpenMatch(joinSlot, joinGuests)}>Confirmar union</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Reservas;
