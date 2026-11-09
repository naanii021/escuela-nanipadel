import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAssistantSummary } from "../services/assistantService";
import { getUser, isLogged } from "../services/auth";
import { buildClubWhatsappUrl } from "../services/whatsappLinks";
import ContactoClub from "./ContactoClub";
import "./clubAssistant.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];

const ACTIONS_BY_ROLE = {
  admin: [
    { key: "panel", label: "Panel", icon: "dashboard", description: "Accede a la gestión del club.", to: "/panel" },
    { key: "clases", label: "Clases / Grupos", icon: "court", description: "Consulta grupos y clases.", to: "/clases" },
    { key: "alumnos", label: "Alumnos", icon: "user", description: "Gestión desde el panel.", to: "/panel" },
    { key: "avisos", label: "Avisos", icon: "bell", description: "Revisa comunicaciones recientes.", to: "/avisos" },
    { key: "reservas", label: "Reservas", icon: "calendar", description: "Consulta la agenda de pistas.", to: "/reservas" },
    { key: "estado-pista", label: "Tiempo y pista", icon: "weather", description: "Condiciones actuales.", to: "/estado-pista" },
    { key: "torneos", label: "Torneos", icon: "trophy", description: "Gestiona jornadas y formatos.", to: "/torneos" },
  ],
  profesor: [
    { key: "clases", label: "Mis clases", icon: "court", description: "Grupos y seguimiento.", to: "/clases" },
    { key: "reservas", label: "Reservas", icon: "calendar", description: "Agenda de pistas.", to: "/reservas" },
    { key: "avisos", label: "Avisos", icon: "bell", description: "Comunicaciones recientes.", to: "/avisos" },
    { key: "estado-pista", label: "Tiempo y pista", icon: "weather", description: "Tiempo y estado de la pista.", to: "/estado-pista" },
    { key: "torneos", label: "Torneos", icon: "trophy", description: "Jornadas del club.", to: "/torneos" },
    { key: "perfil", label: "Perfil", icon: "user", description: "Datos y preferencias.", to: "/perfil" },
  ],
  alumno: [
    { key: "reservas", label: "Reservar pista", icon: "calendar", description: "Elige día, hora y pista.", to: "/reservas" },
    { key: "clases", label: "Mis clases", icon: "court", description: "Consulta tu grupo.", to: "/clases" },
    { key: "torneos", label: "Torneos", icon: "trophy", description: "Competiciones abiertas.", to: "/torneos" },
    { key: "estado-pista", label: "Tiempo y pista", icon: "weather", description: "¿Se puede jugar hoy?", to: "/estado-pista" },
    { key: "perfil", label: "Perfil", icon: "user", description: "Teléfono y preferencias.", to: "/perfil" },
    { key: "avisos", label: "Avisos", icon: "bell", description: "Mensajes del club.", to: "/avisos" },
  ],
  visitante: [
    { key: "reservas", label: "Reservar pista", icon: "calendar", description: "Consulta disponibilidad.", to: "/reservas" },
    { key: "clases", label: "Clases", icon: "court", description: "Niveles y formatos.", to: "/clases" },
    { key: "torneos", label: "Torneos", icon: "trophy", description: "Jornadas publicadas.", to: "/torneos" },
    { key: "estado-pista", label: "Tiempo y pista", icon: "weather", description: "¿Se puede jugar hoy?", to: "/estado-pista" },
    { key: "perfil", label: "Entrar", icon: "user", description: "Accede a tu cuenta.", to: "/login" },
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
  const role = String(summary?.data?.user?.rol || summary?.user?.rol || storedUser?.rol || "").toLowerCase();

  if (!summary?.logged && !isLogged()) return "visitante";
  if (role === "admin") return "admin";
  if (STAFF_ROLES.includes(role)) return "profesor";
  return "alumno";
}

function getWelcomeText(role) {
  if (role === "admin") return "Te ayudo a revisar grupos, alumnos, reservas y avisos del club.";
  if (role === "profesor") return "Te ayudo con tus clases, reservas, avisos y estado de pista.";
  return "Te ayudo a revisar reservas, clases, torneos, avisos y estado de pista.";
}

function Icon({ type }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": "true" };
  const icons = {
    bell: <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    calendar: <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
    court: <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M3 12h18" /></svg>,
    dashboard: <svg {...common}><rect x="3" y="3" width="7" height="8" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /></svg>,
    help: <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1.3-2.9 1.5-2.9 3" /><path d="M12 17h.01" /></svg>,
    trophy: <svg {...common}><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></svg>,
    user: <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    weather: <svg {...common}><path d="M17.5 19H9a5 5 0 1 1 1.6-9.74A6 6 0 0 1 22 12.5 4.5 4.5 0 0 1 17.5 19Z" /></svg>,
  };

  return icons[type] || icons.help;
}

function getSummaryCards(summary, logged) {
  const data = summary?.data || {};
  const personal = summary?.personal || {};
  const notifications = summary?.notifications || data.notificaciones || {};
  const reservas = data.reservas || personal.proximasReservas || [];
  const nextClass = data.claseProxima || personal.proximaClase;
  const torneos = data.torneos?.proximos || summary?.general?.torneosAbiertos || [];
  const avisos = notifications.items || [];

  const cards = [];
  if (logged) {
    cards.push(
      {
        key: "reserva",
        label: "Tu próxima reserva",
        value: reservas[0] ? `${reservas[0].pista_nombre || "Pista"} · ${formatDateTime(String(reservas[0].fecha).slice(0, 10), reservas[0].hora_inicio)}` : "No tienes reservas próximas.",
        action: "reservas",
      },
      {
        key: "clase",
        label: "Tu próxima clase",
        value: nextClass ? `${nextClass.nombre || "Clase"} · ${formatClassDate(nextClass.nextDate)}` : "No tienes clases asignadas.",
        action: "clases",
      },
    );
  }
  cards.push({
    key: "torneos",
    label: "Torneos",
    value: torneos[0] ? `${torneos.length} publicado${torneos.length === 1 ? "" : "s"} · ${torneos[0].nombre}` : "No hay torneos abiertos ahora mismo.",
    action: "torneos",
  });
  if (logged) {
    cards.push({
      key: "avisos",
      label: "Avisos",
      value: avisos[0]?.titulo || avisos[0]?.mensaje || (Number(notifications.unread || 0) ? `${notifications.unread} aviso${notifications.unread === 1 ? "" : "s"} sin leer` : "No hay avisos recientes."),
      action: "avisos",
    });
  }
  return cards;
}

function buildCommandResponse(command, role) {
  const text = command.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const staff = role === "admin" || role === "profesor";

  if (/(reserva|reservar|pista\b)/.test(text)) {
    return { title: "Reservas", text: "Te llevo a reservas para elegir día, hora y pista.", action: "reservas" };
  }
  if (/(clase|grupo|alumno)/.test(text)) {
    return {
      title: staff ? "Clases y grupos" : "Mis clases",
      text: staff ? "Abre la vista de clases para revisar grupos y alumnos." : "Abre tus clases para ver grupo, horario y profesor.",
      action: staff && text.includes("alumno") ? "alumnos" : "clases",
    };
  }
  if (/(torneo|americano|mexicano)/.test(text)) {
    return { title: "Torneos", text: "Te llevo a torneos para revisar competiciones y formatos.", action: "torneos" };
  }
  if (/(aviso|mensaje|notificacion)/.test(text)) {
    return { title: "Avisos", text: "Abre los avisos y comunicaciones recientes del club.", action: "avisos" };
  }
  if (/(estado|tiempo|xiao|mojada|humeda|llueve|lluvia)/.test(text)) {
    return { title: "Tiempo y pista", text: "Mira si hoy se puede jugar y la previsión de los próximos días.", action: "estado-pista" };
  }
  if (/(hora|abre|cierra|horario|telefono|llamar|direccion|donde|precio|cuota|cuanto)/.test(text)) {
    return { title: "Eso te lo dice el club", text: "Para horarios, precios o cómo llegar, escribe al club por WhatsApp o llámalos.", action: "", contacto: true };
  }
  if (/(perfil|telefono|whatsapp)/.test(text)) {
    return { title: "Perfil", text: "Abre tu perfil para revisar teléfono y preferencias.", action: "perfil" };
  }
  if (/ayuda/.test(text)) {
    return { title: "Ayuda", text: "Puedes probar con reservas, clases, torneos, avisos, perfil o estado de pista.", action: "" };
  }

  return {
    title: "No sé responder a eso",
    text: "¿Te paso con el club? Te contestan por WhatsApp o por teléfono.",
    action: "",
    contacto: true,
  };
}

export default function ClubAssistant() {
  // En Reservar pista el botón flotante tapaba celdas del cuadrante en el móvil; ahí la barra inferior ya tiene Contacto.
  const enReservas = useLocation().pathname.startsWith("/reservas");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadMessage, setLoadMessage] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [command, setCommand] = useState("");
  const [commandResponse, setCommandResponse] = useState(null);

  useEffect(() => {
    if (!open || summary || loading) return;

    let mounted = true;

    async function loadSummary() {
      try {
        setLoading(true);
        setLoadMessage("");
        const data = await getAssistantSummary();
        if (!mounted) return;
        setSummary(data);
        if (data?.fallback || data?.ok === false) {
          setLoadMessage(data.message || "No he podido cargar el resumen del club, pero puedes usar los accesos rápidos.");
        }
      } catch {
        if (mounted) {
          setLoadMessage("No he podido cargar el resumen del club, pero puedes usar los accesos rápidos.");
          setSummary({ fallback: true });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSummary();
    return () => {
      mounted = false;
    };
  }, [open, summary, loading]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const role = useMemo(() => getRole(summary), [summary]);
  const actions = ACTIONS_BY_ROLE[role] || ACTIONS_BY_ROLE.visitante;
  const unreadCount = Number(summary?.notifications?.unread || summary?.data?.notificaciones?.unread || 0);
  const logged = isLogged();
  const summaryCards = useMemo(() => getSummaryCards(summary, logged), [summary, logged]);
  const [lastQuestion, setLastQuestion] = useState("");
  const selectedActionMeta = actions.find((action) => action.key === selectedAction);
  const activeResponse = commandResponse || (selectedActionMeta
    ? { title: selectedActionMeta.label, text: selectedActionMeta.description, action: selectedActionMeta.key }
    : { title: "Centro rápido del club", text: "Elige una opción o escribe lo que necesitas." });

  function goToAction(actionKey) {
    const action = actions.find((item) => item.key === actionKey)
      || Object.values(ACTIONS_BY_ROLE).flat().find((item) => item.key === actionKey);

    if (!action?.to) return;
    navigate(action.to);
    setOpen(false);
  }

  function handleAction(action) {
    setCommandResponse(null);
    setSelectedAction(action.key);
    goToAction(action.key);
  }

  function handleSummaryAction(actionKey) {
    setCommandResponse(null);
    setSelectedAction(actionKey);
    goToAction(actionKey);
  }

  function handleCommandSubmit(event) {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;

    const response = buildCommandResponse(value, role);
    setLastQuestion(value);
    setCommandResponse(response);
    setSelectedAction(response.action);
    setCommand("");
  }

  return (
    <div className="clubAssistant">
      {open && (
        <section className="assistantPanel" aria-label="Asistente del club">
          <div className="assistantPanelHead">
            <div className="assistantBrand">
              <div className="assistantAvatar" aria-hidden="true">NP</div>
              <div>
                <h3>Asistente del club</h3>
                <span className="assistantEyebrow">Respuestas automáticas</span>
              </div>
            </div>
            <button className="assistantCloseBtn" onClick={() => setOpen(false)} type="button">
              Cerrar
            </button>
          </div>

          <div className="assistantPanelScroll">
            <div className="assistantWelcome">
              <div className="assistantMessageAvatar" aria-hidden="true">NP</div>
              <div className="assistantBubble">
                <p>{getWelcomeText(role)}</p>
              </div>
            </div>

            <div className="assistantContacto">
              <strong>Hablar con una persona del club</strong>
              <ContactoClub compacto />
            </div>

            {loading && (
              <div className="assistantSkeleton" aria-label="Cargando resumen del club">
                <span />
                <span />
              </div>
            )}

            {!loading && loadMessage && (
              <div className="assistantState assistantWarning" role="status">
                <strong>{loadMessage}</strong>
                <p>Los botones principales siguen funcionando.</p>
              </div>
            )}

            <div className="assistantActions" role="list" aria-label="Accesos rápidos">
              {actions.map((action) => (
                <button
                  className={`assistantActionChip${selectedAction === action.key ? " isActive" : ""}`}
                  key={action.key}
                  onClick={() => handleAction(action)}
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

            <div className="assistantReplyCard">
              <div className="assistantReplyTop">
                <span className="assistantReplyIcon" aria-hidden="true"><Icon type={selectedActionMeta?.icon || "help"} /></span>
                <div>
                  <span className="assistantReplyTag">Respuesta rápida</span>
                  <h4>{activeResponse.title}</h4>
                </div>
              </div>
              <p>{activeResponse.text}</p>
              {activeResponse.action && (
                <button type="button" className="assistantReplyLink" onClick={() => goToAction(activeResponse.action)}>
                  Ir ahora
                </button>
              )}
              {activeResponse.contacto && (
                <a
                  className="assistantReplyLink assistantReplyWhatsapp"
                  href={buildClubWhatsappUrl(lastQuestion ? `Hola, tengo una pregunta: ${lastQuestion}` : "Hola, tengo una pregunta sobre NaniPadel")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preguntar al club por WhatsApp
                </a>
              )}
            </div>

            <div className="assistantSummaryGrid" aria-label="Resumen del club">
              {summaryCards.map((card) => (
                <button key={card.key} type="button" onClick={() => handleSummaryAction(card.action)}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </button>
              ))}
            </div>
          </div>

          <form className="assistantCommandBar" onSubmit={handleCommandSubmit}>
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Escribe qué necesitas..."
              aria-label="Escribe qué necesitas"
            />
            <button type="submit">Enviar</button>
          </form>
        </section>
      )}

      <button
        className={`assistantFab${open ? " isOpen" : ""}${enReservas && !open ? " isQuietMobile" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Cerrar la ayuda" : "Abrir la ayuda del club"}
        aria-expanded={open}
        type="button"
      >
        {unreadCount > 0 && <span className="assistantFabBadge" aria-label={`${unreadCount} avisos sin leer`}>{unreadCount}</span>}
        <svg className="assistantFabIcon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.1" />
          <path d="M12 17.2h.01" />
        </svg>
        <span className="assistantFabInner">{open ? "Cerrar" : "Ayuda"}</span>
      </button>
    </div>
  );
}
