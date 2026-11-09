import "./reservas.css";
import "./reservar.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import { ahoraMadrid, esPasada, fechaCorta, fechaLarga, horaFin, sumarDias } from "../services/fechas";
import { requestNotificationsRefresh } from "../services/notificationEvents";
import Hoja from "../components/Hoja";
import Toast from "../components/Toast";
import MisReservas from "../components/MisReservas";
import { PRECIO_CON_LUZ, PRECIO_SIN_LUZ, precioTurno } from "../services/precios";
import { HORAS_RESERVA } from "../services/disponibilidad";
import CuadranteReservas, { Leyenda, esLibre, plazasLibres as freeSeats } from "../components/CuadranteReservas";

const HOURS = HORAS_RESERVA;
const DURATION = 90;
const AVATAR_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#dc2626", "#ea580c", "#0891b2", "#be185d"];
const GAME_LEVELS = [
  { value: 0, label: "0 · Iniciación" },
  { value: 1, label: "1 · Principiante" },
  { value: 2, label: "2 · Medio bajo" },
  { value: 3, label: "3 · Medio" },
  { value: 4, label: "4 · Medio alto" },
  { value: 5, label: "5 · Avanzado" },
  { value: 6, label: "6 · Competición" },
];
const ALREADY_IN = "Ya estás en esta partida.";

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

function levelLabel(value) {
  const found = GAME_LEVELS.find((item) => Number(item.value) === Number(value));
  return found ? found.label.replace(/^\d · /, "") : "sin nivel";
}

function participantName(player) {
  if (!player) return "Jugador";
  if (player.tipo_participante === "invitado") return player.nombre_invitado || player.nombre || "Invitado";
  return `${player.nombre || "Jugador"} ${player.apellidos || ""}`.trim();
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function slotWhen(slot) {
  return `${fechaLarga(slot.dateISO)}, de ${slot.start} a ${slot.end}`;
}

function validDate(value, todayISO) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && value >= todayISO ? value : null;
}

const IconCheck = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const IconCalendar = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

function Reservas() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayISO = ahoraMadrid().fecha;
  const logged = isLogged();
  const me = getUser();

  const [selectedDateISO, setSelectedDateISO] = useState(() => validDate(searchParams.get("fecha"), todayISO) || todayISO);
  const [courts, setCourts] = useState([]);
  // Reservas del último día cargado. Mientras llega otro día se sigue viendo el anterior, atenuado.
  const [datos, setDatos] = useState({ fecha: null, reservas: [] });
  const [loading, setLoading] = useState(true);
  const [ahora, setAhora] = useState(() => ahoraMadrid().hora);
  const pedido = useRef(null);
  const raiz = useRef(null);
  const [loadError, setLoadError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [toast, setToast] = useState(null);
  const [misKey, setMisKey] = useState(0);
  const [contact, setContact] = useState({ nombre: me?.nombre || "", telefono: "" });

  // Hojas
  const [confirmSlot, setConfirmSlot] = useState(null);
  const [detailSlot, setDetailSlot] = useState(null);
  const [joinSlot, setJoinSlot] = useState(null);
  const [cancelSlot, setCancelSlot] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(todayISO, i)), [todayISO]);

  useEffect(() => {
    apiGet("/api/reservas/pistas")
      .then((data) => { if (data.ok) setCourts(data.pistas); })
      .catch(() => setLoadError("No hemos podido cargar las pistas. Comprueba tu conexión."));
  }, []);

  // Nombre y teléfono del perfil para no tener que escribirlos al reservar.
  useEffect(() => {
    if (!logged) return;
    apiGet("/api/perfil")
      .then((data) => {
        const p = data.profile || {};
        setContact((current) => ({
          nombre: current.nombre || [p.nombre, p.apellidos].filter(Boolean).join(" "),
          telefono: current.telefono || p.telefono || "",
        }));
      })
      .catch(() => {});
  }, [logged]);

  const loadReservas = useCallback(() => {
    const fecha = selectedDateISO;
    pedido.current = fecha;
    setLoading(true);
    setLoadError("");
    apiGet(`/api/reservas?fecha=${fecha}`)
      .then((data) => {
        if (pedido.current !== fecha) return;
        setDatos({ fecha, reservas: data.ok && Array.isArray(data.reservas) ? data.reservas : [] });
      })
      .catch(() => { if (pedido.current === fecha) setLoadError("No hemos podido cargar las horas de este día."); })
      .finally(() => { if (pedido.current === fecha) setLoading(false); });
  }, [selectedDateISO]);

  // La hora de "ahora" (y qué horas han pasado) se actualiza cada minuto, sin animaciones.
  useEffect(() => {
    const id = window.setInterval(() => setAhora(ahoraMadrid().hora), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Altura de la cabecera del sitio, para que la fila de pistas se quede pegada justo debajo.
  useEffect(() => {
    const cabecera = document.querySelector(".headerWrap");
    const nodo = raiz.current;
    if (!cabecera || !nodo || typeof ResizeObserver === "undefined") return undefined;
    const medir = () => nodo.style.setProperty("--rs-arriba", `${cabecera.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(cabecera);
    return () => observador.disconnect();
  }, []);

  useEffect(() => { loadReservas(); }, [loadReservas]);

  const refreshAll = useCallback(() => {
    loadReservas();
    setMisKey((value) => value + 1);
    requestNotificationsRefresh();
  }, [loadReservas]);

  const dataDate = datos.fecha;
  const slots = useMemo(() => {
    if (!courts.length || !dataDate) return [];
    const reservaMap = new Map(
      datos.reservas
        .filter((r) => r.estado !== "cancelada")
        .filter((r) => r.tipo_reserva !== "abierta" || Number(r.plazas_ocupadas || 0) > 0)
        .map((r) => [`${r.pista_id}|${String(r.hora_inicio).slice(0, 5)}`, r])
    );

    return HOURS.map((hour) => courts.map((court) => {
      const rData = reservaMap.get(`${court.id}|${hour}`) ?? null;
      const isOpenWithSeats = rData?.tipo_reserva === "abierta" && rData?.estado === "abierta";
      const mine = Boolean(rData) && me?.id != null && (String(rData.usuario_id) === String(me.id) || rData.motivo_no_unirse === ALREADY_IN);
      return {
        id: `${dataDate}|${court.id}|${hour}`,
        dateISO: dataDate,
        courtId: court.id,
        courtName: court.nombre,
        start: hour,
        end: horaFin(hour, DURATION),
        status: rData ? (isOpenWithSeats ? "abierta" : "ocupada") : "disponible",
        pasada: esPasada(dataDate, hour),
        mia: mine,
        esCreador: Boolean(rData) && me?.id != null && String(rData.usuario_id) === String(me.id),
        reservaId: rData?.id ?? null,
        reservaNombreCliente: rData?.nombre_cliente ?? null,
        tipoReserva: rData?.tipo_reserva ?? null,
        plazasOcupadas: rData?.plazas_ocupadas ?? 0,
        maxJugadores: rData?.max_jugadores ?? 4,
        nivelMin: rData?.nivel_min ?? null,
        nivelMax: rData?.nivel_max ?? null,
        participantes: rData?.participantes ?? [],
        notas: rData?.notas ?? null,
        puedeUnirse: Boolean(rData?.puede_unirse),
        motivoNoUnirse: rData?.motivo_no_unirse ?? null,
      };
    }));
    // "ahora" se incluye para recalcular las horas pasadas cada minuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courts, datos, dataDate, me?.id, ahora]);

  const pastRows = slots.filter((row) => row[0]?.pasada).length;
  const visibleRows = showPast ? slots : slots.filter((row) => !row[0]?.pasada);
  const freeSlots = slots.flat().filter(esLibre);
  const freeCount = freeSlots.length;
  const firstFree = freeSlots[0];
  const isToday = dataDate === todayISO;
  const dayWord = selectedDateISO === todayISO ? "Hoy" : selectedDateISO === sumarDias(todayISO, 1) ? "Mañana" : "Este día";

  const showMessage = useCallback((texto, tipo = "ok") => setToast({ texto, tipo, id: Date.now() }), []);

  const goToLogin = (slot) => {
    const volver = `/reservas?fecha=${slot.dateISO}&pista=${slot.courtId}&hora=${slot.start}`;
    const motivo = `Entra con tu cuenta para reservar la ${slot.courtName} el ${fechaLarga(slot.dateISO, { capital: false })} a las ${slot.start}. Después volverás aquí.`;
    navigate(`/login?volver=${encodeURIComponent(volver)}&motivo=${encodeURIComponent(motivo)}`);
  };

  const openReserve = (slot) => {
    if (!isLogged()) { goToLogin(slot); return; }
    setConfirmSlot(slot);
  };

  // Vuelta del login: se abre directamente la confirmación de la hora elegida.
  useEffect(() => {
    const hora = searchParams.get("hora");
    const pista = searchParams.get("pista");
    if (!hora || !pista || loading || !slots.length || dataDate !== selectedDateISO) return;
    if (searchParams.get("fecha") && searchParams.get("fecha") !== selectedDateISO) return;
    const slot = slots.flat().find((item) => String(item.courtId) === pista && item.start === hora);
    setSearchParams({}, { replace: true });
    if (!slot || !isLogged()) return;
    if (slot.status === "disponible" && !slot.pasada) setConfirmSlot(slot);
    else showMessage(`La ${slot.courtName} a las ${slot.start} ya no está libre. Elige otra hora.`, "error");
  }, [searchParams, setSearchParams, slots, loading, selectedDateISO, dataDate, showMessage]);

  const otherDay = !days.includes(selectedDateISO);

  return (
    <section className={`rs${logged ? " conLateral" : ""}`} ref={raiz}>
      <header className="rsHead">
        <h1>Reservar pista</h1>
        <p>Elige el día y toca una hora libre. Cada partido dura {DURATION} minutos: {PRECIO_SIN_LUZ} € sin luz y {PRECIO_CON_LUZ} € con luz.</p>
      </header>

      {logged && (
        <aside className="rsLateral" aria-label="Tus reservas">
          <MisReservas recarga={misKey} onCambio={loadReservas} mostrarVacio={false} />
          <div className="rsLeyendaCaja">
            <h2>Colores del cuadrante</h2>
            <Leyenda />
          </div>
        </aside>
      )}

      <div className="rsDias" role="group" aria-label="Elige el día">
        {days.map((iso, index) => (
          <button
            key={iso}
            type="button"
            className={`rsDia${iso === selectedDateISO ? " isActivo" : ""}`}
            aria-pressed={iso === selectedDateISO}
            aria-label={`${index === 0 ? "Hoy, " : index === 1 ? "Mañana, " : ""}${fechaLarga(iso, { capital: false })}`}
            onClick={() => { setSelectedDateISO(iso); setShowPast(false); }}
          >
            <span className="rsDiaNombre">{index === 0 ? "Hoy" : index === 1 ? "Mañana" : fechaCorta(iso, { capital: true }).split(" ")[0]}</span>
            <strong className="rsDiaNumero">{fechaCorta(iso).split(" ")[1]}</strong>
            <span className="rsDiaMes">{fechaCorta(iso).split(" ")[2]}</span>
          </button>
        ))}
        <label className={`rsDia rsOtroDia${otherDay ? " isActivo" : ""}`}>
          {IconCalendar}
          <span className="rsDiaNombre">{otherDay ? fechaCorta(selectedDateISO, { capital: true }) : "Otro día"}</span>
          <input
            type="date"
            min={todayISO}
            value={selectedDateISO}
            onChange={(e) => { const value = validDate(e.target.value, todayISO); if (value) { setSelectedDateISO(value); setShowPast(false); } }}
            aria-label="Elegir otro día"
          />
        </label>
      </div>

      <div className="rsPrincipal">
        <div className="rsDiaTitulo">
          <h2>{fechaLarga(selectedDateISO)}</h2>
          {!loadError && dataDate === selectedDateISO && (
            <p className={freeCount ? "isHay" : "isNo"} aria-live="polite">
              {freeCount ? (
                <>
                  <strong>{dayWord} {freeCount === 1 ? "queda 1 hora libre" : `quedan ${freeCount} horas libres`}</strong>
                  {firstFree && <span>La primera, a las {firstFree.start} en la {firstFree.courtName}.</span>}
                </>
              ) : (
                <strong>{dayWord} no quedan horas libres</strong>
              )}
            </p>
          )}
        </div>

        <Leyenda className={logged ? "isSoloMovil" : ""} />

        {loadError ? (
          <div className="mensajeCaja isError" role="alert">
            <span>{loadError}</span>
            <button type="button" className="rsReintentar" onClick={loadReservas}>Reintentar</button>
          </div>
        ) : !dataDate ? (
          <div className="rsCargando" aria-label="Cargando horas">
            {Array.from({ length: 5 }).map((_, i) => <span key={i} />)}
          </div>
        ) : (
          <>
            {pastRows > 0 && (
              <button type="button" className="rsPasadas" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}>
                {showPast ? "Ocultar las horas que ya han pasado" : `Ver las horas que ya han pasado (${pastRows})`}
              </button>
            )}

            {visibleRows.length === 0 ? (
              <div className="rsVacio">
                <strong>Hoy ya no quedan horas.</strong>
                <button type="button" className="btnGrande isPrincipal" onClick={() => setSelectedDateISO(sumarDias(todayISO, 1))}>Ver mañana</button>
              </div>
            ) : (
              <div className="rsCuadro" key={dataDate}>
                <CuadranteReservas
                  pistas={courts}
                  filas={visibleRows}
                  ahora={isToday ? ahora : null}
                  ocupado={loading}
                  onReservar={openReserve}
                  onDetalle={setDetailSlot}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Toast mensaje={toast} onCerrar={() => setToast(null)} />

      {confirmSlot && (
        <ConfirmSheet
          slot={confirmSlot}
          contact={contact}
          setContact={setContact}
          onClose={() => setConfirmSlot(null)}
          onDone={refreshAll}
        />
      )}

      {detailSlot && (
        <DetailSheet
          slot={detailSlot}
          onClose={() => setDetailSlot(null)}
          onJoin={(slot) => { if (!isLogged()) { goToLogin(slot); return; } setDetailSlot(null); setJoinSlot(slot); }}
          onCancel={(slot) => { setDetailSlot(null); setCancelSlot(slot); }}
          onShared={(texto) => showMessage(texto)}
        />
      )}

      {joinSlot && (
        <JoinSheet
          slot={joinSlot}
          onClose={() => setJoinSlot(null)}
          onDone={(texto) => { setJoinSlot(null); showMessage(texto); refreshAll(); }}
        />
      )}

      {cancelSlot && (
        <CancelSheet
          slot={cancelSlot}
          onClose={() => setCancelSlot(null)}
          onDone={(texto) => { setCancelSlot(null); showMessage(texto); refreshAll(); }}
        />
      )}
    </section>
  );
}

function TextoPrecio({ slot }) {
  const { precio, conLuz } = precioTurno(slot.dateISO, slot.start);
  return <span className="rsPrecio">Precio: <b>{precio} €</b> ({conLuz ? "con luz" : "sin luz"})</span>;
}

function SlotSummary({ slot }) {
  return (
    <div className="rsResumen">
      <strong>{slot.courtName}</strong>
      <span>{fechaLarga(slot.dateISO)}</span>
      <span>De {slot.start} a {slot.end} · {DURATION} minutos</span>
      <TextoPrecio slot={slot} />
    </div>
  );
}

function ConfirmSheet({ slot, contact, setContact, onClose, onDone }) {
  const user = getUser();
  const userLevel = Number(user?.nivel_juego);
  const hasLevel = user?.nivel_juego !== null && user?.nivel_juego !== undefined && user?.nivel_juego !== "" && Number.isInteger(userLevel);
  const [editing, setEditing] = useState(!contact.nombre.trim() || !contact.telefono.trim());
  const [openMatch, setOpenMatch] = useState(false);
  const [levelMin, setLevelMin] = useState(hasLevel ? Math.max(0, userLevel - 1) : 0);
  const [levelMax, setLevelMax] = useState(hasLevel ? Math.min(6, userLevel + 1) : 6);
  const [guests, setGuests] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    const errors = {};
    if (!openMatch && !contact.nombre.trim()) errors.nombre = "Escribe tu nombre.";
    if (!openMatch && !contact.telefono.trim()) errors.telefono = "Escribe un teléfono para que el club pueda avisarte.";
    if (openMatch && Number(levelMin) > Number(levelMax)) errors.nivel = "El nivel mínimo no puede ser mayor que el máximo.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      if (errors.nombre || errors.telefono) setEditing(true);
      setError("Revisa los datos marcados en rojo.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiPost("/api/reservas", {
        tipo_reserva: openMatch ? "abierta" : "completa",
        nombre_cliente: openMatch ? user?.nombre : contact.nombre.trim(),
        telefono_cliente: openMatch ? null : contact.telefono.trim(),
        pista_id: slot.courtId,
        fecha: slot.dateISO,
        hora_inicio: slot.start,
        duracion_min: DURATION,
        nivel_min: openMatch ? Number(levelMin) : null,
        nivel_max: openMatch ? Number(levelMax) : null,
        num_invitados: openMatch ? Number(guests) : 0,
        notas: note.trim() || null,
      });
      if (!data.ok) { setError(data.message || "No hemos podido hacer la reserva."); return; }
      setDone(true);
      onDone();
    } catch (e) {
      setError(e.message || "No hemos podido conectar con el club. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Hoja
        titulo={openMatch ? "Partida abierta creada" : "Reserva hecha"}
        onCerrar={onClose}
        pie={(close) => <button type="button" className="btnGrande isPrincipal" onClick={close} data-autofocus>Hecho</button>}
      >
        <div className="rsHecho" role="status">
          <span className="rsHechoCheck" aria-hidden="true">{IconCheck}</span>
          <p>
            {openMatch
              ? "Ya estás apuntado. Otros jugadores del club pueden unirse a las plazas libres."
              : "Te esperamos en la pista."}
          </p>
        </div>
        <SlotSummary slot={slot} />
        <p className="rsNota">Si no puedes venir, cancélala en «Tus próximas reservas», arriba en esta página.</p>
      </Hoja>
    );
  }

  return (
    <Hoja
      titulo="Confirmar reserva"
      onCerrar={onClose}
      pie={
        <button type="button" className="btnGrande isPrincipal" onClick={submit} disabled={submitting}>
          {submitting ? "Reservando…" : openMatch ? "Crear partida abierta" : "Confirmar reserva"}
        </button>
      }
    >
      {error && <div className="mensajeCaja isError" role="alert">{error}</div>}

      <SlotSummary slot={slot} />

      {!openMatch && (
        editing ? (
          <div className="rsCampos">
            <label className="rsCampo">
              <span>Nombre</span>
              <input
                value={contact.nombre}
                onChange={(e) => setContact((c) => ({ ...c, nombre: e.target.value }))}
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.nombre)}
                aria-describedby={fieldErrors.nombre ? "rs-err-nombre" : undefined}
              />
              {fieldErrors.nombre && <small id="rs-err-nombre" className="rsCampoError">{fieldErrors.nombre}</small>}
            </label>
            <label className="rsCampo">
              <span>Teléfono</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={contact.telefono}
                onChange={(e) => setContact((c) => ({ ...c, telefono: e.target.value }))}
                placeholder="Ej: 600 123 456"
                aria-invalid={Boolean(fieldErrors.telefono)}
                aria-describedby={fieldErrors.telefono ? "rs-err-tel" : undefined}
              />
              {fieldErrors.telefono && <small id="rs-err-tel" className="rsCampoError">{fieldErrors.telefono}</small>}
            </label>
          </div>
        ) : (
          <div className="rsDatos">
            <div>
              <span>A nombre de</span>
              <strong>{contact.nombre}</strong>
              <span>{contact.telefono}</span>
            </div>
            <button type="button" className="rsEnlace" onClick={() => setEditing(true)}>Cambiar</button>
          </div>
        )
      )}

      <div className={`rsAbierta${openMatch ? " isAbierta" : ""}`}>
        <button type="button" className="rsEnlace rsAbiertaToggle" aria-expanded={openMatch} onClick={() => setOpenMatch((v) => !v)}>
          {openMatch ? "Prefiero reservar la pista completa" : "¿Te faltan jugadores? Crear partida abierta"}
        </button>
        {openMatch && (
          <div className="rsAbiertaCuerpo">
            <p>Te apuntas tú y las demás plazas quedan libres para otros jugadores del club de tu nivel.</p>
            {!hasLevel && (
              <p className="mensajeCaja isInfo">Para crear una partida abierta primero tienes que indicar tu nivel en tu perfil.</p>
            )}
            <div className="rsCampos rsCamposFila">
              <label className="rsCampo">
                <span>Nivel mínimo</span>
                <select value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))} aria-invalid={Boolean(fieldErrors.nivel)}>
                  {GAME_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                </select>
              </label>
              <label className="rsCampo">
                <span>Nivel máximo</span>
                <select value={levelMax} onChange={(e) => setLevelMax(Number(e.target.value))} aria-invalid={Boolean(fieldErrors.nivel)}>
                  {GAME_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                </select>
              </label>
            </div>
            {fieldErrors.nivel && <small className="rsCampoError">{fieldErrors.nivel}</small>}
            <label className="rsCampo">
              <span>¿Llevas a alguien contigo?</span>
              <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {[0, 1, 2, 3].map((value) => <option key={value} value={value}>{value === 0 ? "No, voy solo" : plural(value, "invitado", "invitados")}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {showNote ? (
        <label className="rsCampo">
          <span>Nota (opcional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={openMatch ? "Ej: buscamos gente para pelotear" : "Ej: traigo bolas nuevas"} />
        </label>
      ) : (
        <button type="button" className="rsEnlace" onClick={() => setShowNote(true)}>Añadir una nota</button>
      )}
    </Hoja>
  );
}

function DetailSheet({ slot, onClose, onJoin, onCancel, onShared }) {
  const isOpen = slot.tipoReserva === "abierta";
  const seats = freeSeats(slot);
  const players = isOpen ? slot.participantes : [];

  const share = async () => {
    const text = `Partida abierta en ${slot.courtName}: ${slotWhen(slot)}. Quedan ${plural(seats, "plaza", "plazas")}.`;
    try {
      if (navigator.share) await navigator.share({ title: "NaniPadel", text, url: window.location.href });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text} ${window.location.href}`); onShared("Texto de la partida copiado. Pégalo donde quieras."); }
    } catch {
      /* El usuario ha cerrado el menú de compartir. */
    }
  };

  return (
    <Hoja
      titulo={slot.mia && !isOpen ? "Tu reserva" : isOpen ? "Partida abierta" : "Reserva"}
      subtitulo={`${slot.courtName} · ${slotWhen(slot)}`}
      onCerrar={onClose}
      pie={
        <>
          {isOpen && slot.puedeUnirse && <button type="button" className="btnGrande isPrincipal" onClick={() => onJoin(slot)}>Apuntarme a la partida</button>}
          {isOpen && slot.motivoNoUnirse === ALREADY_IN && !slot.esCreador && (
            <button type="button" className="btnGrande isPeligroSuave" onClick={() => onCancel({ ...slot, salir: true })}>Salir de la partida</button>
          )}
          {slot.esCreador && (
            <button type="button" className="btnGrande isPeligroSuave" onClick={() => onCancel(slot)}>{isOpen ? "Cancelar la partida" : "Cancelar la reserva"}</button>
          )}
          {isOpen && seats > 0 && <button type="button" className="btnGrande isSecundario" onClick={share}>Compartir partida</button>}
        </>
      }
    >
      {isOpen ? (
        <>
          <div className={`mensajeCaja ${slot.puedeUnirse || slot.motivoNoUnirse === ALREADY_IN ? "isOk" : "isInfo"}`}>
            <span>
              {plural(seats, "plaza libre", "plazas libres")}
              {slot.nivelMin !== null && ` · Nivel ${slot.nivelMin} a ${slot.nivelMax}`}
              <br />
              {slot.motivoNoUnirse === ALREADY_IN
                ? "Ya juegas en esta partida."
                : slot.puedeUnirse
                  ? "Tu nivel encaja: puedes apuntarte."
                  : slot.motivoNoUnirse || "Entra con tu cuenta para apuntarte."}
            </span>
          </div>
          <h3 className="rsSubtitulo">Jugadores</h3>
          <ul className="rsJugadores">
            {Array.from({ length: Number(slot.maxJugadores || 4) }).map((_, index) => {
              const player = players[index];
              const name = player ? participantName(player) : "";
              const isGuest = player?.tipo_participante === "invitado";
              return (
                <li key={index} className={player ? "" : "isLibre"}>
                  <span className="rsAvatar" style={{ "--avatar-bg": player ? getAvatarColor(name) : "#cbd5d0" }} aria-hidden="true">
                    {player ? getInitials(name) : "+"}
                  </span>
                  <span>
                    <strong>{player ? name : "Plaza libre"}</strong>
                    <small>
                      {!player
                        ? "Esperando jugador"
                        : isGuest
                          ? "Invitado"
                          : player.nivel_juego !== null && player.nivel_juego !== undefined
                            ? `Nivel ${player.nivel_juego} · ${levelLabel(player.nivel_juego)}`
                            : "Sin nivel indicado"}
                      {player?.es_creador ? " · Organiza" : ""}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="rsResumen">
          <strong>{slot.reservaNombreCliente ? `A nombre de ${slot.reservaNombreCliente}` : "Pista reservada"}</strong>
          <span>De {slot.start} a {slot.end} · {DURATION} minutos</span>
          <TextoPrecio slot={slot} />
        </div>
      )}
      {slot.notas && (
        <>
          <h3 className="rsSubtitulo">Nota</h3>
          <p className="rsNota">{slot.notas}</p>
        </>
      )}
    </Hoja>
  );
}

function JoinSheet({ slot, onClose, onDone }) {
  const [guests, setGuests] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const maxGuests = Math.max(freeSeats(slot) - 1, 0);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiPost(`/api/reservas/${slot.reservaId}/unirse`, { num_invitados: Number(guests) });
      onDone(guests ? `Apuntados a la partida: tú y ${plural(guests, "invitado", "invitados")}.` : "Ya estás apuntado a la partida.");
    } catch (e) {
      setError(e.message || "Ahora mismo no puedes unirte a esta partida.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Hoja
      titulo="Apuntarme a la partida"
      onCerrar={onClose}
      pie={<button type="button" className="btnGrande isPrincipal" onClick={submit} disabled={submitting}>{submitting ? "Apuntando…" : "Confirmar y apuntarme"}</button>}
    >
      {error && <div className="mensajeCaja isError" role="alert">{error}</div>}
      <SlotSummary slot={slot} />
      {maxGuests > 0 && (
        <label className="rsCampo">
          <span>¿Llevas a alguien contigo?</span>
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: maxGuests + 1 }).map((_, value) => (
              <option key={value} value={value}>{value === 0 ? "No, voy solo" : plural(value, "invitado", "invitados")}</option>
            ))}
          </select>
        </label>
      )}
      <p className="rsNota">Ocuparéis {plural(Number(guests) + 1, "plaza", "plazas")} de las {freeSeats(slot)} libres.</p>
    </Hoja>
  );
}

function CancelSheet({ slot, onClose, onDone }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const leaving = Boolean(slot.salir);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (leaving) {
        const data = await apiDelete(`/api/reservas/${slot.reservaId}/participantes/me`);
        onDone(data.invitados_cancelados > 0 ? "Has salido de la partida junto con tus invitados." : "Has salido de la partida.");
      } else {
        await apiPatch(`/api/reservas/${slot.reservaId}/cancelar`);
        onDone(`Reserva cancelada: ${slot.courtName}, ${slotWhen(slot)}.`);
      }
    } catch (e) {
      setError(e.message || "No hemos podido cancelar. Inténtalo otra vez o llama al club.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Hoja
      titulo={leaving ? "¿Salir de la partida?" : `¿Cancelar la reserva del ${fechaLarga(slot.dateISO, { capital: false })} a las ${slot.start}?`}
      onCerrar={onClose}
      pie={(close) => (
        <>
          <button type="button" className="btnGrande isPeligro" onClick={submit} disabled={submitting}>
            {submitting ? "Cancelando…" : leaving ? "Sí, salir" : "Sí, cancelar"}
          </button>
          <button type="button" className="btnGrande isSecundario" onClick={close}>No, mantenerla</button>
        </>
      )}
    >
      {error && <div className="mensajeCaja isError" role="alert">{error}</div>}
      <SlotSummary slot={slot} />
      {leaving && <p className="rsNota">Si llevas invitados, también dejarán su plaza.</p>}
    </Hoja>
  );
}

export default Reservas;
