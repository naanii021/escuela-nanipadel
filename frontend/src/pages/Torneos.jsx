import "./torneos.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, isLogged } from "../services/auth";

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const TOURNAMENT_PHOTOS_MANIFEST = `${process.env.PUBLIC_URL}/tournament-photos-manifest.json`;

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

const CATEGORY_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "adultos", label: "Adultos" },
  { key: "menores", label: "Menores" },
  { key: "mixto", label: "Mixto" },
  { key: "competicion", label: "Competicion" },
  { key: "liga_interna", label: "Liga" },
];

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
  return (
    CATEGORY_META[categoria] || {
      label: categoria || "General",
      accentClass: "catAdultos",
      image:
        "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
    }
  );
}

function getStatusMeta(estado) {
  return STATUS_META[estado] || { label: estado || "Pendiente", className: "statusDefault" };
}

function occupancyMeta(inscritos, maxParejas) {
  const current = Number(inscritos || 0);
  const total = Number(maxParejas || 0);
  if (!total) return { percent: 0, className: "occOpen", text: `${current} inscritas` };
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
  const [activeFilter, setActiveFilter] = useState("todos");
  const [tournamentPhotos, setTournamentPhotos] = useState([]);

  const loadTorneos = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const headers = { Accept: "application/json" };
      if (isLogged()) headers.Authorization = `Bearer ${getToken()}`;
      const res = await fetch(`${API_BASE}/api/torneos`, { headers });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "No hemos podido cargar los torneos.");
      setTorneos(data.torneos || []);
    } catch (e) {
      setErr(e.message || "No hemos podido cargar los torneos ahora mismo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTorneos();
  }, [loadTorneos]);

  useEffect(() => {
    let mounted = true;

    async function loadTournamentPhotos() {
      try {
        const response = await fetch(TOURNAMENT_PHOTOS_MANIFEST, { cache: "no-store" });
        if (!response.ok) throw new Error("No hemos podido cargar las fotos de torneo.");
        const manifest = await response.json();
        if (mounted) {
          setTournamentPhotos(Array.isArray(manifest.photos) ? manifest.photos : []);
        }
      } catch {
        if (mounted) setTournamentPhotos([]);
      }
    }

    loadTournamentPhotos();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const abiertos = torneos.filter((t) => t.estado === "abierto").length;
    const proximos = torneos.filter((t) => t.estado === "proximo").length;
    const plazas = torneos.reduce(
      (acc, t) => acc + Math.max(Number(t.max_parejas || 0) - Number(t.inscritos || 0), 0),
      0
    );
    return { total: torneos.length, abiertos, proximos, plazas };
  }, [torneos]);

  const filterCounts = useMemo(() => {
    const counts = { todos: torneos.length };
    for (const key of Object.keys(CATEGORY_META)) counts[key] = 0;
    for (const t of torneos) {
      if (counts[t.categoria] !== undefined) counts[t.categoria] += 1;
    }
    return counts;
  }, [torneos]);

  const filteredTorneos = useMemo(() => {
    if (activeFilter === "todos") return torneos;
    return torneos.filter((t) => t.categoria === activeFilter);
  }, [torneos, activeFilter]);

  const featuredPhotos = tournamentPhotos.slice(0, 4);

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
      if (!res.ok || !data.ok) throw new Error(data.message || "No hemos podido actualizar tu inscripcion.");
      setFeedback(torneo.inscrito ? "Inscripcion cancelada." : "Ya estas apuntado al torneo.");
      await loadTorneos();
    } catch (e) {
      setFeedback(e.message || "No hemos podido actualizar tu inscripcion.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="torneos" aria-label="Torneos del club">
      <div className="torneosShell">
        <section className="torneosHero">
          <div className="torneosHeroCopy">
            <span className="torneosEyebrow">
              <span className="eyebrowDot" aria-hidden="true" />
              Competicion del club
            </span>
            <h2 className="torneosTitle">Torneos y jornadas del club</h2>
            <p className="intro">
              Consulta torneos activos, revisa plazas disponibles y apunta tu pareja cuando haya inscripciones abiertas.
            </p>
          </div>

          <div className="torneosMetrics" role="list" aria-label="Resumen de torneos">
            <div className="torneosMetricCard" role="listitem">
              <span>Total publicados</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="torneosMetricCard" role="listitem">
              <span>Abiertos ahora</span>
              <strong>{stats.abiertos}</strong>
            </div>
            <div className="torneosMetricCard" role="listitem">
              <span>Proximos</span>
              <strong>{stats.proximos}</strong>
            </div>
            <div className="torneosMetricCard" role="listitem">
              <span>Plazas libres</span>
              <strong>{stats.plazas}</strong>
            </div>
          </div>
        </section>

        {!loading && !err && (
          <section className="torneosControlBar">
            <div className="torneosControlHead">
              <div>
                <span className="torneosSectionEyebrow">Inscripciones</span>
                <h3>Torneos activos y proximos</h3>
              </div>
              <p>Filtra por categoria y revisa fechas, plazas y estado de cada torneo.</p>
            </div>

            <nav className="torneosFilters" aria-label="Filtrar torneos por categoria">
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`filterTab${activeFilter === f.key ? " filterTabActive" : ""}`}
                  onClick={() => setActiveFilter(f.key)}
                  aria-pressed={activeFilter === f.key}
                >
                  {f.label}
                  <span className="filterTabBadge" aria-label={`${filterCounts[f.key] ?? 0} torneos`}>
                    {filterCounts[f.key] ?? 0}
                  </span>
                </button>
              ))}
            </nav>
          </section>
        )}

        {feedback && (
          <div className="torneosFeedback" role="status" aria-live="polite">
            {feedback}
          </div>
        )}

        {loading && (
          <div className="torneosGrid" aria-busy="true" aria-label="Cargando torneos">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="torneoSkeleton" key={i} aria-hidden="true" />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="torneosMessage torneosError" role="alert">
            {err}
          </div>
        )}

        {!loading && !err && filteredTorneos.length === 0 && (
          <div className="torneosMessage" role="status">
            {activeFilter !== "todos"
              ? "No hay torneos en esta categoria por ahora."
              : "Aun no hay torneos publicados. Cuando el club abra uno, aparecera aqui."}
          </div>
        )}

        {!loading && !err && filteredTorneos.length > 0 && (
          <section className="torneosPrimaryBlock">
            <div className="torneosGrid">
              {filteredTorneos.map((torneo, index) => {
                const category = getCategoryMeta(torneo.categoria);
                const status = getStatusMeta(torneo.estado);
                const occupancy = occupancyMeta(torneo.inscritos, torneo.max_parejas);
                const isClosed = ["cerrado", "cancelado", "finalizado", "completo"].includes(
                  torneo.estado
                );

                return (
                  <article
                    className={`torneoCard ${category.accentClass}`}
                    key={torneo.id}
                    style={{ "--i": index }}
                    aria-label={`Torneo: ${torneo.nombre}`}
                  >
                    <div className="torneoMedia">
                      <img src={category.image} alt={`Categoria ${category.label}`} loading="lazy" />
                      <div className="torneoMediaOverlay" aria-hidden="true" />
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
                        <span className="torneoPrice" aria-label={`Precio: ${formatPrecio(torneo.precio)}`}>
                          {formatPrecio(torneo.precio)}
                        </span>
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

                      {(torneo.edad_min || torneo.edad_max) && (
                        <div className="torneoDetails">
                          <span className="detailChip">
                            Edad {torneo.edad_min || "?"} - {torneo.edad_max || "?"} anos
                          </span>
                        </div>
                      )}

                      <div className="torneoCapacity">
                        <div className="capacityRow">
                          <span>Plazas</span>
                          <strong>{occupancy.text}</strong>
                        </div>
                        <div
                          className={`capacityBar ${occupancy.className}`}
                          role="progressbar"
                          aria-valuenow={occupancy.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Ocupacion: ${occupancy.percent}%`}
                        >
                          <span style={{ width: `${occupancy.percent}%` }} />
                        </div>
                      </div>

                      <button
                        className={`btnTorneo${torneo.inscrito ? " isSubscribed" : ""}`}
                        disabled={actionId === torneo.id || (!torneo.inscrito && isClosed)}
                        onClick={() => handleInscripcion(torneo)}
                        aria-busy={actionId === torneo.id}
                      >
                        {actionId === torneo.id
                          ? "Procesando..."
                          : torneo.inscrito
                            ? "Cancelar inscripcion"
                            : isClosed
                              ? "Inscripciones cerradas"
                              : "Apuntarme"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {featuredPhotos.length > 0 && (
          <section className="torneosGallerySection" aria-label="Ambiente competitivo">
            <div className="torneosGalleryHead">
              <div>
                <span className="torneosSectionEyebrow">Ambiente competitivo</span>
                <h3>Fotos de jornadas y torneos</h3>
              </div>
              <p>Momentos de competicion y ambiente de club.</p>
            </div>

            <div className="torneosGalleryGrid">
              {featuredPhotos.map((photo) => (
                <article className="torneosGalleryCard" key={photo.id}>
                  <div className="torneosGalleryMedia">
                    <img src={photo.src} alt={photo.title} loading="lazy" />
                  </div>
                  <div className="torneosGalleryBody">
                    <span>{photo.highlight}</span>
                    <strong>{photo.title}</strong>
                    <p>{photo.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export default Torneos;
