import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssistantSummary } from "../services/assistantService";
import { getUser, isLogged } from "../services/auth";
import "./clubAssistant.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];
const CONTACT_HREF = "mailto:info@nanipadel.com";

// Accesos visibles segun el tipo de usuario; no cambian rutas ni permisos reales.
const ACTIONS_BY_ROLE = {
  visitante: [
    { key: "clases", label: "Ver clases", icon: "court", description: "Niveles, formatos y como apuntarte." },
    { key: "reservar", label: "Reservar pista", icon: "calendar", description: "Consulta la zona de reservas del club." },
    { key: "torneos", label: "Torneos", icon: "trophy", description: "Competiciones publicadas por el club." },
    { key: "contactar", label: "Contactar", icon: "chat", description: "Escribe al club para resolver dudas." },
    { key: "ayuda", label: "Ayuda", icon: "help", description: "Te oriento por la web de NaniPadel." },
  ],
  alumno: [
    { key: "mis-clases", label: "Mis clases", icon: "court", description: "Revisa tu grupo y proxima clase." },
    { key: "mis-reservas", label: "Mis reservas", icon: "calendar", description: "Consulta tus pistas activas." },
    { key: "avisos", label: "Avisos", icon: "bell", description: "Ultimas notificaciones del club." },
    { key: "recuperaciones", label: "Recuperaciones", icon: "repeat", description: "Comprueba clases pendientes." },
    { key: "estado-pista", label: "Estado de pista", icon: "weather", description: "Meteo y condiciones de juego." },
    { key: "ayuda", label: "Ayuda", icon: "help", description: "Dudas habituales de alumnos." },
  ],
  staff: [
    { key: "panel", label: "Panel", icon: "dashboard", description: "Accede a la gestion del club." },
    { key: "grupos", label: "Grupos", icon: "groups", description: "Consulta grupos y clases." },
    { key: "alumnos", label: "Alumnos", icon: "user", description: "Gestion de alumnos desde el panel." },
    { key: "avisos", label: "Avisos", icon: "bell", description: "Revisa comunicaciones recientes." },
    { key: "reservas", label: "Reservas", icon: "calendar", description: "Consulta la agenda de pistas." },
    { key: "estado-pista", label: "Estado de pista", icon: "weather", description: "Condiciones actuales de juego." },
  ],
};

const HELP_OPTIONS = {
  visitante: [
    { label: "No veo mis clases", action: "mis-clases" },
    { label: "Quiero cambiar mi horario", href: CONTACT_HREF },
    { label: "Tengo una recuperacion pendiente", action: "recuperaciones" },
    { label: "Contactar con el club", href: CONTACT_HREF },
  ],
  alumno: [
    { label: "No veo mis clases", action: "mis-clases" },
    { label: "Quiero cambiar mi horario", href: CONTACT_HREF },
    { label: "Tengo una recuperacion pendiente", action: "recuperaciones" },
    { label: "Contactar con el club", href: CONTACT_HREF },
  ],
  staff: [
    { label: "No veo mis clases", action: "grupos" },
    { label: "Quiero cambiar mi horario", href: CONTACT_HREF },
    { label: "Tengo una recuperacion pendiente", action: "recuperaciones" },
    { label: "Contactar con el club", href: CONTACT_HREF },
  ],
};

function formatDateTime(date, time) {
  if (!date) return "Por confirmar";
  const raw = time ? `${date}T${String(time).slice(0, 5)}:00` : `${date}T00:00:00`;
  return new Date(raw).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClassDate(value) {
  if (!value) return "Por confirmar";
  return new Date(value).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRole(summary) {
  const storedUser = getUser();
  const role = String(summary?.user?.rol || storedUser?.rol || "").toLowerCase();

  if (!summary?.logged && !isLogged()) return "visitante";
  if (STAFF_ROLES.includes(role)) return "staff";
  return "alumno";
}

function getWelcomeText(role) {
  if (role === "staff") {
    return "Te ayudo a revisar grupos, alumnos, reservas y avisos del club.";
  }

  if (role === "alumno") {
    return "Te ayudo con tus clases, reservas, avisos y recuperaciones.";
  }

  return "Te ayudo a consultar clases, reservas, torneos y contacto del club.";
}

function Icon({ type }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": "true" };
  const icons = {
    bell: <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    calendar: <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
    chat: <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>,
    court: <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M3 12h18" /></svg>,
    dashboard: <svg {...common}><rect x="3" y="3" width="7" height="8" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /></svg>,
    groups: <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    help: <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1.3-2.9 1.5-2.9 3" /><path d="M12 17h.01" /></svg>,
    repeat: <svg {...common}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>,
    trophy: <svg {...common}><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></svg>,
    user: <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    weather: <svg {...common}><path d="M17.5 19H9a5 5 0 1 1 1.6-9.74A6 6 0 0 1 22 12.5 4.5 4.5 0 0 1 17.5 19Z" /></svg>,
  };

  return icons[type] || icons.help;
}

function buildEmptyResponse(title, to) {
  return {
    title,
    eyebrow: "Sin datos",
    status: "Sin informacion",
    text: "No hay informacion disponible ahora mismo.",
    detail: "Prueba de nuevo en unos segundos. Contacta con el club si necesitas ayuda.",
    cta: to ? { label: "Abrir seccion", to } : { label: "Contactar con el club", href: CONTACT_HREF },
  };
}

function buildResponse(action, summary, role) {
  if (!action) {
    return {
      title: "Que necesitas consultar?",
      eyebrow: "Asistente",
      text: "Elige una opcion y te llevo directamente a la seccion correspondiente.",
    };
  }

  const guest = role === "visitante";
  const notifications = summary?.notifications || {};
  const avisos = notifications.items || [];
  const unread = Number(notifications.unread || 0);

  if (action === "clases") {
    return {
      title: "Clases",
      eyebrow: "Escuela",
      text: "Consulta niveles, formatos y como apuntarte a la escuela.",
      cta: { label: "Ir a clases", to: "/clases" },
    };
  }

  if (action === "reservar" || action === "reservas") {
    return {
      title: "Reservas",
      eyebrow: "Pistas",
      text: "Elige dia, hora y tipo de reserva.",
      cta: { label: guest ? "Reservar pista" : "Ver reservas", to: "/reservas" },
    };
  }

  if (action === "mis-clases") {
    const nextClass = summary?.personal?.proximaClase;

    if (!nextClass) {
      return {
        ...buildEmptyResponse("Mis clases", "/clases"),
        text: "Ahora mismo no veo clases asignadas a tu perfil.",
        detail: "Si ya eres alumno, contacta con el club para vincular tu cuenta o revisar tu grupo.",
      };
    }

    return {
      title: "Tu proxima clase",
      eyebrow: "Entrenamientos",
      status: "Activa",
      text: `${nextClass.nombre || "Clase"} - ${formatClassDate(nextClass.nextDate)}.`,
      detail: `Pista: ${nextClass.pista_habitual || "por confirmar"}. Profesor: ${nextClass.profesor || "por confirmar"}.`,
      facts: [
        { label: "Nivel", value: nextClass.nivel || "Por confirmar" },
        { label: "Grupo", value: nextClass.nombre || "Por confirmar" },
      ],
      cta: { label: "Ver mis clases", to: "/clases" },
    };
  }

  if (action === "mis-reservas") {
    const reservas = summary?.personal?.proximasReservas || [];

    if (!reservas.length) {
      return {
        title: "Mis reservas",
        eyebrow: "Pistas",
        status: "Sin reservas",
        text: "No tienes reservas activas ahora mismo.",
        detail: "Puedes buscar hueco por fecha, pista y hora cuando quieras.",
        cta: { label: "Reservar pista", to: "/reservas" },
      };
    }

    const first = reservas[0];
    return {
      title: "Mis reservas",
      eyebrow: "Pistas",
      status: `${reservas.length} activa${reservas.length === 1 ? "" : "s"}`,
      text: `Tu proxima reserva es en ${first.pista_nombre || "pista por confirmar"}.`,
      detail: formatDateTime(first.fecha, first.hora_inicio),
      facts: [
        { label: "Reservas", value: String(reservas.length) },
        { label: "Proxima pista", value: first.pista_nombre || "Por confirmar" },
      ],
      cta: { label: "Ver reservas", to: "/reservas" },
    };
  }

  if (action === "avisos") {
    // El backend de notificaciones ya existe; si no responde, el servicio deja un estado vacio seguro.
    if (!avisos.length) {
      return {
        title: "Avisos",
        eyebrow: "Notificaciones",
        status: unread ? `${unread} sin leer` : "Sin avisos",
        text: unread ? `Tienes ${unread} aviso${unread === 1 ? "" : "s"} sin leer.` : "No tienes avisos recientes ahora mismo.",
        detail: "Cuando el club publique avisos para tu cuenta, apareceran aqui.",
        cta: { label: role === "staff" ? "Abrir panel" : "Ver clases", to: role === "staff" ? "/panel" : "/clases" },
      };
    }

    return {
      title: "Ultimos avisos",
      eyebrow: "Notificaciones",
      status: unread ? `${unread} sin leer` : "Al dia",
      text: unread ? `Tienes ${unread} aviso${unread === 1 ? "" : "s"} pendiente${unread === 1 ? "" : "s"} de leer.` : "Estos son los ultimos avisos disponibles.",
      items: avisos.slice(0, 3).map((item) => item.titulo || item.mensaje || "Aviso del club"),
      cta: { label: role === "staff" ? "Abrir panel" : "Ver clases", to: role === "staff" ? "/panel" : "/clases" },
    };
  }

  if (action === "recuperaciones") {
    return {
      title: "Recuperaciones",
      eyebrow: "Clases",
      status: "Preparado",
      text: "Revisa si tienes recuperaciones pendientes dentro de tu zona de clases.",
      detail: "El asistente aun no recibe un resumen especifico de recuperaciones; queda preparado para conectarlo cuando exista ese dato en el endpoint.",
      cta: { label: "Ver mis clases", to: "/clases" },
    };
  }

  if (action === "estado-pista") {
    const meteo = summary?.general?.estadoPista;

    if (!meteo) return buildEmptyResponse("Estado de pista", "/estado-pista");

    return {
      title: "Estado de pista",
      eyebrow: "Condiciones",
      status: meteo.estado || "Actualizado",
      text: meteo.estado || "La pista tiene una lectura reciente disponible.",
      detail: "Consulta el estado antes de jugar si el tiempo esta cambiando.",
      facts: [
        { label: "Temperatura", value: meteo.temperatura != null ? `${meteo.temperatura} C` : "No disponible" },
        { label: "Humedad", value: meteo.humedad != null ? `${meteo.humedad}%` : "No disponible" },
      ],
      cta: { label: "Ver estado completo", to: "/estado-pista" },
    };
  }

  if (action === "torneos") {
    const torneos = summary?.general?.torneosAbiertos || [];

    if (!torneos.length) {
      return {
        title: "Torneos",
        eyebrow: "Competicion",
        text: "Revisa las competiciones disponibles del club.",
        cta: { label: "Ver torneos", to: "/torneos" },
      };
    }

    return {
      title: "Torneos abiertos",
      eyebrow: "Competicion",
      status: `${torneos.length} publicado${torneos.length === 1 ? "" : "s"}`,
      text: "Revisa las competiciones disponibles del club.",
      detail: `Proximo: ${torneos[0].nombre} - ${formatDateTime(torneos[0].fecha_inicio, torneos[0].hora_inicio)}`,
      items: torneos.slice(0, 3).map((torneo) => torneo.nombre),
      cta: { label: "Ir a torneos", to: "/torneos" },
    };
  }

  if (["panel", "grupos", "alumnos"].includes(action)) {
    const labels = { panel: "Panel", grupos: "Grupos", alumnos: "Alumnos" };
    return {
      title: labels[action],
      eyebrow: "Gestion",
      status: "Acceso staff",
      text: "Abre el panel para consultar informacion de gestion con los permisos de tu cuenta.",
      detail: "Desde el asistente no se muestran alumnos, grupos reales ni datos internos completos.",
      cta: { label: "Abrir panel", to: "/panel" },
    };
  }

  if (action === "contactar") {
    return {
      title: "Contacto",
      eyebrow: "Ayuda",
      text: "Escribe al club para resolver dudas sobre clases, reservas o grupos.",
      cta: { label: "Contactar", href: CONTACT_HREF },
    };
  }

  return {
    title: "Ayuda",
    eyebrow: "Guia rapida",
    text: "Te oriento con las dudas mas habituales.",
    helpOptions: true,
  };
}

function ActionLink({ cta, children, className, onClick }) {
  if (!cta) return null;
  if (cta.href) {
    return <a className={className} href={cta.href} onClick={onClick}>{children || cta.label}</a>;
  }

  return <Link className={className} to={cta.to} onClick={onClick}>{children || cta.label}</Link>;
}

export default function ClubAssistant() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState("");

  useEffect(() => {
    if (!open || summary || loading) return;

    let mounted = true;

    async function loadSummary() {
      try {
        setLoading(true);
        setError("");
        const data = await getAssistantSummary();
        if (mounted) setSummary(data);
      } catch (err) {
        if (mounted) setError(err.message || "No he podido cargar la informacion del club.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSummary();
    return () => {
      mounted = false;
    };
  }, [open, summary, loading]);

  const role = useMemo(() => getRole(summary), [summary]);
  const actions = ACTIONS_BY_ROLE[role] || ACTIONS_BY_ROLE.visitante;
  const selectedActionMeta = actions.find((action) => action.key === selectedAction);
  const response = summary ? buildResponse(selectedAction, summary, role) : null;
  const unreadCount = Number(summary?.notifications?.unread || 0);

  useEffect(() => {
    if (selectedAction && !actions.some((action) => action.key === selectedAction)) {
      setSelectedAction("");
    }
  }, [actions, selectedAction]);

  return (
    <div className="clubAssistant">
      {open && (
        <section className="assistantPanel" aria-label="Asistente del club">
          <div className="assistantPanelHead">
            <div className="assistantBrand">
              <div className="assistantAvatar" aria-hidden="true">NP</div>
              <div>
                <h3>Asistente del club</h3>
                <span className="assistantEyebrow">NaniPadel</span>
                <span className="assistantOnline">
                  <span aria-hidden="true" />
                  Online
                </span>
              </div>
            </div>
            <button className="assistantCloseBtn" onClick={() => setOpen(false)} aria-label="Cerrar asistente">
              <span aria-hidden="true">x</span>
            </button>
          </div>

          <div className="assistantWelcome">
            <div className="assistantMessageAvatar" aria-hidden="true">NP</div>
            <div className="assistantBubble">
              <p>{getWelcomeText(role)}</p>
            </div>
          </div>

          <div className="assistantActions" role="list" aria-label="Acciones rapidas">
            {actions.map((action) => (
              <button
                className={`assistantActionChip${selectedAction === action.key ? " isActive" : ""}`}
                key={action.key}
                onClick={() => setSelectedAction(action.key)}
                role="listitem"
                type="button"
              >
                <span className="assistantActionIcon" aria-hidden="true"><Icon type={action.icon} /></span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                {action.key === "avisos" && unreadCount > 0 && <em>{unreadCount}</em>}
              </button>
            ))}
          </div>

          <div className="assistantBody">
            {loading && (
              <div className="assistantSkeleton" aria-label="Cargando datos del club">
                <span />
                <span />
                <span />
              </div>
            )}
            {!loading && error && (
              <div className="assistantState assistantError">
                <strong>No he podido cargar la informacion ahora mismo.</strong>
                <p>Prueba de nuevo en unos segundos o contacta con el club si necesitas ayuda.</p>
              </div>
            )}
            {!loading && !error && summary && !response && (
              <div className="assistantState assistantEmpty">
                <strong>No hay informacion disponible ahora mismo.</strong>
                <p>Prueba de nuevo en unos segundos.</p>
              </div>
            )}
            {!loading && !error && response && (
              <div className="assistantReplyCard">
                <div className="assistantReplyTop">
                  <span className="assistantReplyIcon" aria-hidden="true"><Icon type={selectedActionMeta?.icon || "help"} /></span>
                  <div>
                    <span className="assistantReplyTag">{response.eyebrow || response.title}</span>
                    <h4>{response.title}</h4>
                  </div>
                </div>
                {response.status && <span className="assistantStatusBadge">{response.status}</span>}
                <p>{response.text}</p>
                {response.detail && <small className="assistantReplyDetail">{response.detail}</small>}
                {response.facts && (
                  <div className="assistantFactGrid">
                    {response.facts.map((fact) => (
                      <div key={fact.label}>
                        <span>{fact.label}</span>
                        <strong>{fact.value}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {response.items && (
                  <ul className="assistantMiniList">
                    {response.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {response.helpOptions && (
                  <div className="assistantHelpList" aria-label="Opciones de ayuda">
                    {(HELP_OPTIONS[role] || HELP_OPTIONS.visitante).map((option) =>
                      option.action ? (
                        <button type="button" key={option.label} onClick={() => setSelectedAction(option.action)}>
                          {option.label}
                        </button>
                      ) : (
                        <ActionLink key={option.label} cta={option} onClick={() => setOpen(false)}>
                          {option.label}
                        </ActionLink>
                      )
                    )}
                  </div>
                )}
                {response.cta && (
                  <ActionLink className="assistantReplyLink" cta={response.cta} onClick={() => setOpen(false)} />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <button
        className={`assistantFab${open ? " isOpen" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir asistente del club"
        type="button"
      >
        <span className="assistantFabStatus" aria-hidden="true" />
        {unreadCount > 0 && <span className="assistantFabBadge" aria-label={`${unreadCount} avisos sin leer`}>{unreadCount}</span>}
        <span className="assistantFabInner">Club</span>
      </button>
    </div>
  );
}
