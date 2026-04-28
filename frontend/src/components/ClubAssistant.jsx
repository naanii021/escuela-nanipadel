import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssistantSummary } from "../services/assistantService";
import { isLogged } from "../services/auth";
import "./clubAssistant.css";

const QUICK_ACTIONS = [
  { key: "mis-clases", label: "Mis clases" },
  { key: "mis-reservas", label: "Mis reservas" },
  { key: "torneos", label: "Torneos abiertos" },
  { key: "estado-pista", label: "Estado de pista" },
  { key: "ayuda", label: "Ayuda" },
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
        text: "Inicia sesion para ver tu proxima clase y tus grupos asignados.",
        cta: { label: "Entrar", to: "/login" },
      };
    }

    const nextClass = summary.personal?.proximaClase;
    if (!nextClass) {
      return {
        title: "Mis clases",
        text: "Ahora mismo no veo clases asignadas a tu perfil.",
        cta: { label: "Ver clases", to: "/clases" },
      };
    }

    return {
      title: "Tu proxima clase",
      text: `${nextClass.nombre}. ${formatClassDate(nextClass.nextDate)} con ${nextClass.profesor}.`,
      cta: { label: "Ir a clases", to: "/clases" },
    };
  }

  if (action === "mis-reservas") {
    if (guest) {
      return {
        title: "Mis reservas",
        text: "Sin sesion solo puedo mostrar la zona general de reservas.",
        cta: { label: "Entrar", to: "/login" },
      };
    }

    const reservas = summary.personal?.proximasReservas || [];
    if (!reservas.length) {
      return {
        title: "Mis reservas",
        text: "No tienes reservas proximas ahora mismo.",
        cta: { label: "Reservar pista", to: "/reservas" },
      };
    }

    const first = reservas[0];
    return {
      title: "Tu proxima reserva",
      text: `${first.pista_nombre} el ${formatDateTime(first.fecha, first.hora_inicio)}.`,
      cta: { label: "Ver reservas", to: "/reservas" },
    };
  }

  if (action === "torneos") {
    const torneos = summary.general?.torneosAbiertos || [];
    if (!torneos.length) {
      return {
        title: "Torneos abiertos",
        text: "No veo torneos abiertos o proximos ahora mismo.",
        cta: { label: "Ver torneos", to: "/torneos" },
      };
    }

    const first = torneos[0];
    return {
      title: "Torneos abiertos",
      text: `El siguiente es ${first.nombre} el ${formatDateTime(first.fecha_inicio, first.hora_inicio)}.`,
      cta: { label: "Ir a torneos", to: "/torneos" },
    };
  }

  if (action === "estado-pista") {
    const meteo = summary.general?.estadoPista;
    if (!meteo) {
      return {
        title: "Estado de pista",
        text: "Todavia no hay lectura del sensor XIAO disponible.",
        cta: { label: "Ver pagina", to: "/estado-pista" },
      };
    }

    return {
      title: "Estado de pista",
      text: `${meteo.estado || "Lectura recibida"}. ${meteo.temperatura}°C y ${meteo.humedad}% de humedad.`,
      cta: { label: "Ver estado completo", to: "/estado-pista" },
    };
  }

  return {
    title: "Ayuda",
    text: guest
      ? "Puedes explorar clases, torneos, galeria y estado de pista. Si entras con tu cuenta, el asistente te dara datos personales."
      : "Usa los accesos rapidos para ver clases, reservas, torneos y estado de pista. Este MVP queda listo para crecer con avisos y recomendaciones.",
    cta: { label: "Ir al inicio", to: "/" },
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
        if (mounted) setError(err.message || "No se pudo cargar el asistente");
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
        ? "Soy el asistente del club. Puedo ayudarte con clases, reservas, torneos y pista."
        : "Soy el asistente del club. Puedo orientarte por la web y mostrar informacion general.";
    }

    return summary.logged
      ? `Hola ${summary.user?.nombre?.split(" ")[0] || ""}. Ya puedo darte datos utiles del club y de tu cuenta.`
      : "Bienvenido. Sin iniciar sesion puedo darte informacion general del club.";
  }, [summary]);

  const response = summary ? buildResponse(selectedAction, summary) : null;

  return (
    <div className="clubAssistant">
      {open && (
        <section className="assistantPanel" aria-label="Asistente del club">
          <div className="assistantPanelHead">
            <div>
              <span className="assistantEyebrow">Asistente del club</span>
              <h3>NaniPadel</h3>
            </div>
            <button
              className="assistantCloseBtn"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
            >
              ×
            </button>
          </div>

          <div className="assistantWelcome">
            <strong>Hola</strong>
            <p>{welcomeText}</p>
          </div>

          <div className="assistantActions" role="list" aria-label="Acciones rapidas">
            {QUICK_ACTIONS.map((action) => (
              <button
                className={`assistantActionChip${selectedAction === action.key ? " isActive" : ""}`}
                key={action.key}
                onClick={() => setSelectedAction(action.key)}
                role="listitem"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="assistantBody">
            {loading && <p className="assistantState">Cargando datos del club...</p>}
            {!loading && error && <p className="assistantState assistantError">{error}</p>}

            {!loading && !error && response && (
              <div className="assistantReplyCard">
                <span className="assistantReplyTag">{response.title}</span>
                <p>{response.text}</p>
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
        <span className="assistantFabInner">Club</span>
      </button>
    </div>
  );
}
