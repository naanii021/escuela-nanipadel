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
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
  },
  menores: {
    label: "Menores",
    accentClass: "catMenores",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
  },
  mixto: {
    label: "Mixto",
    accentClass: "catMixto",
    image: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
  },
  competicion: {
    label: "Competicion",
    accentClass: "catCompeticion",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
  },
  liga_interna: {
    label: "Liga interna",
    accentClass: "catLiga",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80",
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
      image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
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
      if (!res.ok || !data.ok) throw new Error(data.message || "No se pudieron cargar los torneos");
      setTorneos(data.torneos || []);
    } catch (e) {
      setErr(e.message || "Error al cargar los torneos");
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
        if (!response.ok) throw new Error("No se pudieron cargar las fotos de torneo");
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
      if (!res.ok || !data.ok) throw new Error(data.message || "No se pudo actualizar la inscripcion");
      setFeedback(torneo.inscrito ? "Inscripcion cancelada correctamente." : "Te has apuntado al torneo.");
      await loadTorneos();
    } catch (e) {
      setFeedback(e.message || "Error al actualizar la inscripcion");
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="torneos" aria-label="Torneos del club">
      <div className="torneosShell">
        <div className="torneosHero">
          <div className="torneosHeroText">
            <span className="torneosEyebrow">
              <span className="eyebrowDot" aria-hidden="true" />
              Calendario deportivo
            </span>
            <h2 className="torneosTitle">Torneos</h2>
            <p className="intro">
              Compite por categorias, revisa plazas disponibles en tiempo real y apunta tu pareja
              en los eventos activos del club.
            </p>
          </div>

          <div className="torneosHeroVisual">
            <div className="heroPhotoCard">
              <img
                src="https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1400&q=80"
                alt="Jugadores de padel en torneo"
                loading="lazy"
              />
              <div className="heroPhotoOverlay" aria-hidden="true" />
              <div className="heroFloatingBadge" aria-hidden="true">
                <span>NaniPadel</span>
              </div>
            </div>

            <div className="torneosStats" role="list" aria-label="Estadisticas de torneos">
              <div className="torneoStat statBlue" role="listitem">
                <strong aria-label={`${stats.total} torneos totales`}>{stats.total}</strong>
                <span>Torneos</span>
              </div>
              <div className="torneoStat statGreen" role="listitem">
                <strong aria-label={`${stats.abiertos} torneos abiertos`}>{stats.abiertos}</strong>
                <span>Abiertos</span>
              </div>
              <div className="torneoStat statOrange" role="listitem">
                <strong aria-label={`${stats.proximos} torneos proximos`}>{stats.proximos}</strong>
                <span>Proximos</span>
              </div>
              <div className="torneoStat statPurple" role="listitem">
                <strong aria-label={`${stats.plazas} plazas libres`}>{stats.plazas}</strong>
                <span>Plazas libres</span>
              </div>
            </div>
          </div>
        </div>

        <section className="torneosStory" aria-label="Presentacion de torneos">
          <div className="torneosStoryIntro">
            <span className="torneosBlockEyebrow">Vida competitiva</span>
            <h3>Torneos, jornadas y ambiente real de club</h3>
            <p>
              Aqui se muestra la parte mas activa de la competicion del club: torneos sociales,
              jornadas, cuadros, parejas y ambiente de juego para que la seccion tenga mas vida.
            </p>
          </div>

          <div className="torneosStoryHighlights">
            <article className="storyHighlightCard">
              <strong>Momentos del torneo</strong>
              <p>Fotos de partidos, premios, actividad en pista y ritmo competitivo del club.</p>
            </article>
            <article className="storyHighlightCard">
              <strong>Ambiente de competicion</strong>
              <p>Una capa visual mas fuerte para acompanar la parte funcional de inscripciones.</p>
            </article>
          </div>
        </section>

        {tournamentPhotos.length > 0 && (
          <section className="torneosGallerySection" aria-label="Galeria de torneos">
            <div className="torneosGalleryHead">
              <div>
                <span className="torneosBlockEyebrow">Galeria visual</span>
                <h3>Momentos del torneo</h3>
              </div>
              <p>
                Las imagenes se leen solas desde <code>fotosTorneo</code> y cualquier foto nueva
                aparecera aqui al volver a arrancar o compilar.
              </p>
            </div>

            <div className="torneosGalleryGrid">
              {tournamentPhotos.map((photo, index) => (
                <article
                  className={`torneosGalleryCard${index === 0 ? " torneosGalleryCardFeatured" : ""}`}
                  key={photo.id}
                >
                  <img src={photo.src} alt={photo.title} loading="lazy" />
                  <div className="torneosGalleryOverlay" aria-hidden="true" />
                  <div className="torneosGalleryContent">
                    <span>{photo.highlight}</span>
                    <strong>{photo.title}</strong>
                    <p>{photo.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!loading && !err && (
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
              ? "No hay torneos en esta categoria por el momento."
              : "Aun no hay torneos publicados. Aparecera aqui en cuanto el club los cree."}
          </div>
        )}

        {!loading && !err && filteredTorneos.length > 0 && (
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
