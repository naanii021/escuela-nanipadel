import "./torneos.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, isLogged } from "../services/auth";

const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

const CATEGORY_META = {
  adultos: {
    label: "Adultos",
    accentClass: "catAdultos",
    image:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
  },
  menores: {
    label: "Menores",
    accentClass: "catMenores",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
  },
  mixto: {
    label: "Mixto",
    accentClass: "catMixto",
    image:
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
  },
  competicion: {
    label: "Competicion",
    accentClass: "catCompeticion",
    image:
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
  },
  liga_interna: {
    label: "Liga interna",
    accentClass: "catLiga",
    image:
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80",
  },
};

const STATUS_META = {
  abierto: { label: "Abierto", className: "statusAbierto" },
  proximo: { label: "Proximo", className: "statusProximo" },
  en_curso: { label: "En curso", className: "statusCurso" },
  completo: { label: "Completo", className: "statusCompleto" },
  cerrado: { label: "Cerrado", className: "statusCerrado" },
  finalizado: { label: "Finalizado", className: "statusFinalizado" },
  cancelado: { label: "Cancelado", className: "statusCancelado" },
};

function formatFecha(fecha) {
  if (!fecha) return "Por confirmar";
  return new Date(fecha).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatHora(hora) {
  return hora ? String(hora).slice(0, 5) : "Pendiente";
}

function formatPrecio(precio) {
  const amount = Number(precio || 0);
  return amount > 0 ? `${amount.toFixed(2)} EUR` : "Gratis";
}

function getCategoryMeta(categoria) {
  return CATEGORY_META[categoria] || {
    label: categoria || "General",
    accentClass: "catAdultos",
    image:
      "https://images.unsplash.com/photo-1603112579965-7a0c1e3b7a4f?auto=format&fit=crop&w=1200&q=80",
  };
}

function getStatusMeta(estado) {
  return STATUS_META[estado] || { label: estado || "Pendiente", className: "statusDefault" };
}

function occupancyMeta(inscritos, maxParejas) {
  const current = Number(inscritos || 0);
  const total = Number(maxParejas || 0);

  if (!total) {
    return { percent: 0, className: "occOpen", text: `${current} inscritas` };
  }

  const percent = Math.min(100, Math.round((current / total) * 100));
  const className = percent >= 85 ? "occHigh" : percent >= 55 ? "occMid" : "occLow";
  return { percent, className, text: `${current}/${total} parejas` };
}

function Torneos() {
  const navigate = useNavigate();
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionId, setActionId] = useState(null);
  const [feedback, setFeedback] = useState("");

  const loadTorneos = async () => {
    try {
      setLoading(true);
      setErr("");

      const headers = { Accept: "application/json" };
      if (isLogged()) {
        headers.Authorization = `Bearer ${getToken()}`;
      }

      const res = await fetch(`${API_BASE}/api/torneos`, { headers });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "No se pudieron cargar los torneos");
      }

      setTorneos(data.torneos || []);
    } catch (e) {
      setErr(e.message || "Error al cargar los torneos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTorneos();
  }, []);

  const stats = useMemo(() => {
    const abiertos = torneos.filter((t) => t.estado === "abierto").length;
    const proximos = torneos.filter((t) => t.estado === "proximo").length;
    const plazas = torneos.reduce((acc, t) => acc + Math.max(Number(t.max_parejas || 0) - Number(t.inscritos || 0), 0), 0);
    return { total: torneos.length, abiertos, proximos, plazas };
  }, [torneos]);

  const handleInscripcion = async (torneo) => {
    if (!isLogged()) {
      navigate("/login");
      return;
    }

    const endpoint = torneo.inscrito
      ? `/api/torneos/${torneo.id}/cancelar-inscripcion`
      : `/api/torneos/${torneo.id}/inscribirse`;

    try {
      setActionId(torneo.id);
      setFeedback("");

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: torneo.inscrito ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: torneo.inscrito ? undefined : JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "No se pudo actualizar la inscripcion");
      }

      setFeedback(torneo.inscrito ? "Inscripcion cancelada correctamente." : "Te has apuntado al torneo.");
      await loadTorneos();
    } catch (e) {
      setFeedback(e.message || "Error al actualizar la inscripcion");
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="torneos">
      <div className="torneosShell">
        <div className="torneosHero">
          <div className="torneosHeroText">
            <span className="torneosEyebrow">Calendario deportivo</span>
            <h2>Torneos</h2>
            <p className="intro">
              Compite por categorias, revisa plazas disponibles en tiempo real y apunta tu pareja en los eventos activos del club.
            </p>
          </div>

          <div className="torneosHeroVisual">
            <div className="heroPhotoCard">
              <img
                src="https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1400&q=80"
                alt="Jugadores de padel en torneo"
              />
              <div className="heroPhotoOverlay" />
            </div>

            <div className="torneosStats">
              <div className="torneoStat">
                <strong>{stats.total}</strong>
                <span>torneos</span>
              </div>
              <div className="torneoStat">
                <strong>{stats.abiertos}</strong>
                <span>abiertos</span>
              </div>
              <div className="torneoStat">
                <strong>{stats.proximos}</strong>
                <span>proximos</span>
              </div>
              <div className="torneoStat">
                <strong>{stats.plazas}</strong>
                <span>plazas libres</span>
              </div>
            </div>
          </div>
        </div>

        {feedback && <div className="torneosFeedback">{feedback}</div>}

        {loading && (
          <div className="torneosGrid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="torneoSkeleton" key={index} />
            ))}
          </div>
        )}

        {!loading && err && <div className="torneosMessage torneosError">{err}</div>}

        {!loading && !err && torneos.length === 0 && (
          <div className="torneosMessage">
            Aun no hay torneos creados en la base de datos. En cuanto el club publique uno, aparecera aqui.
          </div>
        )}

        {!loading && !err && torneos.length > 0 && (
          <div className="torneosGrid">
            {torneos.map((torneo) => {
              const category = getCategoryMeta(torneo.categoria);
              const status = getStatusMeta(torneo.estado);
              const occupancy = occupancyMeta(torneo.inscritos, torneo.max_parejas);
              const isClosed = ["cerrado", "cancelado", "finalizado", "completo"].includes(torneo.estado);

              return (
                <article className={`torneoCard ${category.accentClass}`} key={torneo.id}>
                  <div className="torneoMedia">
                    <img src={category.image} alt={torneo.nombre} />
                    <div className="torneoMediaOverlay" />
                    <div className="torneoBadges">
                      <span className={`torneoBadge torneoCategoria ${category.accentClass}`}>
                        {category.label}
                      </span>
                      <span className={`torneoBadge torneoEstado ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="torneoBody">
                    <div className="torneoTitleRow">
                      <h3>{torneo.nombre}</h3>
                      <span className="torneoPrice">{formatPrecio(torneo.precio)}</span>
                    </div>

                    {torneo.descripcion && <p className="torneoDescripcion">{torneo.descripcion}</p>}

                    <div className="torneoMeta">
                      <div className="metaBlock">
                        <span className="metaLabel">Fecha</span>
                        <strong>{formatFecha(torneo.fecha_inicio)}</strong>
                      </div>
                      <div className="metaBlock">
                        <span className="metaLabel">Hora</span>
                        <strong>{formatHora(torneo.hora_inicio)}</strong>
                      </div>
                      <div className="metaBlock">
                        <span className="metaLabel">Nivel</span>
                        <strong>{torneo.nivel || "Todos"}</strong>
                      </div>
                      <div className="metaBlock">
                        <span className="metaLabel">Modalidad</span>
                        <strong>{torneo.modalidad || "A definir"}</strong>
                      </div>
                    </div>

                    <div className="torneoDetails">
                      {(torneo.edad_min || torneo.edad_max) && (
                        <span className="detailChip">
                          Edad {torneo.edad_min || "?"} - {torneo.edad_max || "?"} anos
                        </span>
                      )}
                      <span className="detailChip">{occupancy.text}</span>
                      <span className="detailChip">{torneo.estado || "Pendiente"}</span>
                    </div>

                    <div className="torneoCapacity">
                      <div className="capacityRow">
                        <span>Plazas</span>
                        <strong>{occupancy.text}</strong>
                      </div>
                      <div className={`capacityBar ${occupancy.className}`}>
                        <span style={{ width: `${occupancy.percent}%` }} />
                      </div>
                    </div>

                    <button
                      className={`btnTorneo ${torneo.inscrito ? "isSubscribed" : ""}`}
                      disabled={actionId === torneo.id || (!torneo.inscrito && isClosed)}
                      onClick={() => handleInscripcion(torneo)}
                    >
                      {actionId === torneo.id
                        ? "Procesando..."
                        : torneo.inscrito
                          ? "Cancelar inscripcion"
                          : isClosed
                            ? "Inscripciones cerradas"
                            : "Apuntarse"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default Torneos;
