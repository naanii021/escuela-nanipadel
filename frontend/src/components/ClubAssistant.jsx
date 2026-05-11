import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssistantSummary } from "../services/assistantService";
import { isLogged } from "../services/auth";
import "./clubAssistant.css";

const QUICK_ACTIONS = [
  {
    key: "mis-clases",
    label: "Mis clases",
    icon: "📘",
    description: "Consulta tus próximos entrenamientos.",
  },
  {
    key: "mis-reservas",
    label: "Mis reservas",
    icon: "🎾",
    description: "Revisa tus pistas reservadas.",
  },
  {
    key: "torneos",
    label: "Torneos abiertos",
    icon: "🏆",
    description: "Competiciones disponibles para apuntarte.",
  },
  {
    key: "estado-pista",
    label: "Estado de pista",
    icon: "🌦️",
    description: "Consulta clima, humedad y condiciones de juego.",
  },
  {
    key: "ayuda",
    label: "Ayuda",
    icon: "✨",
    description: "Te ayudo a encontrar lo que necesitas.",
  },
];

const HELP_OPTIONS = [
  { label: "Ver mis próximas clases", action: "mis-clases" },
  { label: "Consultar mis reservas", action: "mis-reservas" },
  { label: "Ver torneos disponibles", action: "torneos" },
  { label: "Comprobar estado de pista", action: "estado-pista" },
  { label: "Contactar con el club", to: "/" },
];

function formatDateTime(date, time) {
  if (!date) return "Por confirmar";
  const raw = time ? `${date}T${String(time).slice(0, 5)}:00` : `${date}T00:00:00`;
  return new Date(raw).toLocaleString("es-ES", {
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

function buildResponse(action, summary) {
  const guest = !summary?.logged;

  if (action === "mis-clases") {
    if (guest) {
      return {
        title: "Mis clases",
        eyebrow: "Entrenamientos",
        text: "Inicia sesion para ver tu proxima clase y tu grupo.",
        detail: "Cuando entres, podras revisar horarios, profesor y avisos.",
        status: "Cuenta necesaria",
        cta: { label: "Entrar", to: "/login" },
      };
    }

    const nextClass = summary.personal?.proximaClase;
    if (!nextClass) {
      return {
        title: "Mis clases",
        eyebrow: "Entrenamientos",
        text: "Ahora mismo no veo clases asignadas a tu perfil.",
        detail: "Si ya eres alumno, contacta con el club para vincular tu cuenta.",
        status: "Sin asignar",
        cta: { label: "Ver clases", to: "/clases" },
      };
    }

    return {
      title: "Tu proxima clase",
      eyebrow: "Entrenamientos",
      text: `${nextClass.nombre}. ${formatClassDate(nextClass.nextDate)} con ${nextClass.profesor}.`,
      detail: "Ven con unos minutos de margen para empezar la clase tranquilo.",
      status: "Activa",
      cta: { label: "Ir a clases", to: "/clases" },
    };
  }

  if (action === "mis-reservas") {
    if (guest) {
      return {
        title: "Mis reservas",
        eyebrow: "Pistas",
        text: "Inicia sesion para ver tus reservas activas.",
        detail: "Sin cuenta solo puedo llevarte a la zona general de reservas.",
        status: "Cuenta necesaria",
        cta: { label: "Entrar", to: "/login" },
      };
    }

    const reservas = summary.personal?.proximasReservas || [];
    if (!reservas.length) {
      return {
        title: "Mis reservas",
        text: "No tienes reservas activas ahora mismo.",
        eyebrow: "Pistas",
        detail: "Puedes buscar hueco por fecha, pista y hora cuando quieras.",
        status: "Disponible",
        cta: { label: "Reservar pista", to: "/reservas" },
      };
    }

    const first = reservas[0];
    return {
      title: "Tu proxima reserva",
      eyebrow: "Pistas",
      text: `${first.pista_nombre} el ${formatDateTime(first.fecha, first.hora_inicio)}.`,
      detail: "Revisa la hora antes de venir al club.",
      status: "Confirmada",
      cta: { label: "Ver reservas", to: "/reservas" },
    };
  }

  if (action === "torneos") {
    const torneos = summary.general?.torneosAbiertos || [];
    if (!torneos.length) {
      return {
        title: "Torneos abiertos",
        eyebrow: "Competicion",
        text: "No veo torneos abiertos ahora mismo.",
        detail: "Cuando el club publique uno nuevo, aparecera en la seccion de torneos.",
        status: "Sin abiertos",
        cta: { label: "Ver torneos", to: "/torneos" },
      };
    }

    const first = torneos[0];
    return {
      title: "Torneos abiertos",
      eyebrow: "Competicion",
      text: `El siguiente es ${first.nombre} el ${formatDateTime(first.fecha_inicio, first.hora_inicio)}.`,
      detail: "Revisa categoria, plazas y fecha antes de apuntarte.",
      status: "Abierto",
      cta: { label: "Ir a torneos", to: "/torneos" },
    };
  }

  if (action === "estado-pista") {
    const meteo = summary.general?.estadoPista;
    if (!meteo) {
      return {
        title: "Estado de pista",
        eyebrow: "Condiciones",
        text: "Todavia no hay lectura de pista disponible.",
        detail: "Puedes consultar la pagina de estado para ver la prevision.",
        status: "Sin lectura",
        cta: { label: "Ver pagina", to: "/estado-pista" },
      };
    }

    return {
      title: "Estado de pista",
      eyebrow: "Condiciones",
      text: `${meteo.estado || "Lectura recibida"}. ${meteo.temperatura}°C y ${meteo.humedad}% de humedad.`,
      detail: "Temperatura, viento y humedad ayudan a decidir si es buen momento para jugar.",
      status: meteo.estado || "Actualizado",
      cta: { label: "Ver estado completo", to: "/estado-pista" },
    };
  }

  return {
    title: "Ayuda",
    eyebrow: "Guia rapida",
    text: guest
      ? "Puedes ver clases, torneos, galeria y estado de pista. Si entras con tu cuenta, tambien podre ayudarte con tus datos del club."
      : "Elige que quieres consultar: clases, reservas, torneos o estado de pista.",
    detail: "Elige una opcion para ir directo a lo que necesitas.",
    status: "Listo",
    cta: { label: "Ir al inicio", to: "/" },
    helpOptions: true,
  };
}

export default function ClubAssistant() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState("ayuda");

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

  const welcomeText = useMemo(() => {
    if (!summary) {
      return isLogged()
        ? "Puedo ayudarte con tus clases, reservas, torneos y avisos del club."
        : "Puedo orientarte por la web y mostrar informacion general del club.";
    }

    return summary.logged
      ? `Hola ${summary.user?.nombre?.split(" ")[0] || ""}. Que quieres consultar hoy?`
      : "Bienvenido. Sin iniciar sesion puedo darte informacion general del club.";
  }, [summary]);

  const response = summary ? buildResponse(selectedAction, summary) : null;
  const selectedActionMeta = QUICK_ACTIONS.find((action) => action.key === selectedAction);

  return (
    <div className="clubAssistant">
      {open && (
        <section className="assistantPanel" aria-label="Asistente del club">
          <div className="assistantPanelHead">
            <div className="assistantBrand">
              <div className="assistantAvatar" aria-hidden="true">NP</div>
              <div>
                <span className="assistantEyebrow">Asistente del club</span>
                <h3>NaniPadel</h3>
                <span className="assistantOnline">
                  <span aria-hidden="true" />
                  Online
                </span>
              </div>
            </div>
            <button
              className="assistantCloseBtn"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="assistantWelcome">
            <div className="assistantMessageAvatar" aria-hidden="true">NP</div>
            <div className="assistantBubble">
              <strong>Hola, soy el asistente de NaniPadel.</strong>
              <p>{welcomeText}</p>
            </div>
          </div>

          <div className="assistantActions" role="list" aria-label="Acciones rapidas">
            {QUICK_ACTIONS.map((action) => (
              <button
                className={`assistantActionChip${selectedAction === action.key ? " isActive" : ""}`}
                key={action.key}
                onClick={() => setSelectedAction(action.key)}
                role="listitem"
              >
                <span className="assistantActionIcon" aria-hidden="true">{action.icon}</span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
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
                <strong>No he podido cargar la información ahora mismo.</strong>
                <p>Prueba de nuevo en unos segundos.</p>
              </div>
            )}

            {!loading && !error && summary && !response && (
              <div className="assistantState assistantEmpty">
                <strong>No tengo datos para mostrar todavía.</strong>
                <p>Prueba con otro acceso rápido o vuelve a intentarlo en unos segundos.</p>
              </div>
            )}

            {!loading && !error && response && (
              <div className="assistantReplyCard">
                <div className="assistantReplyTop">
                  <span className="assistantReplyIcon" aria-hidden="true">
                    {selectedActionMeta?.icon || "✓"}
                  </span>
                  <div>
                    <span className="assistantReplyTag">{response.eyebrow || response.title}</span>
                    <h4>{response.title}</h4>
                  </div>
                </div>
                {response.status && <span className="assistantStatusBadge">{response.status}</span>}
                <p>{response.text}</p>
                {response.detail && <small className="assistantReplyDetail">{response.detail}</small>}
                {response.helpOptions && (
                  <div className="assistantHelpList" aria-label="Opciones de ayuda">
                    {HELP_OPTIONS.map((option) =>
                      option.action ? (
                        <button
                          type="button"
                          key={option.label}
                          onClick={() => setSelectedAction(option.action)}
                        >
                          {option.label}
                        </button>
                      ) : (
                        <Link key={option.label} to={option.to} onClick={() => setOpen(false)}>
                          {option.label}
                        </Link>
                      )
                    )}
                  </div>
                )}
                {response.cta && (
                  <Link className="assistantReplyLink" to={response.cta.to} onClick={() => setOpen(false)}>
                    {response.cta.label}
                  </Link>
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
      >
        <span className="assistantFabStatus" aria-hidden="true" />
        <span className="assistantFabInner">Club</span>
      </button>
    </div>
  );
}
