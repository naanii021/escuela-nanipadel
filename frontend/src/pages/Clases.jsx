import "./clases.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { isLogged, getToken, getUser } from "../services/auth";

const API_BASE = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, "")
  : "";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDias(d1, d2) {
  const map = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" };
  if (!d2) return map[d1] || d1;
  return `${map[d1] || d1} y ${map[d2] || d2}`;
}

function formatHora(horaInicio, duracionMin) {
  if (!horaInicio) return "—";
  const [hh, mm] = String(horaInicio).split(":");
  const start = new Date();
  start.setHours(Number(hh), Number(mm), 0, 0);
  const end = new Date(start.getTime() + Number(duracionMin || 60) * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function nivelLabel(nivel) {
  const map = { ninos: "Niños", iniciacion: "Iniciación", avanzado: "Avanzado", competicion: "Competición", avanzado_plus: "Avanzado +" };
  return map[nivel] || nivel || "—";
}

function nivelBadgeClass(nivel) {
  const map = { ninos: "badgeKids", iniciacion: "badgeInit", avanzado: "badgeAdv", competicion: "badgeComp", avanzado_plus: "badgePlus" };
  return map[nivel] || "badgeDefault";
}

function proximaDia(dia1, dia2) {
  const dayMap = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0 };
  const dayNames = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" };
  const today = new Date().getDay();
  const dias = [dia1, dia2].filter(Boolean);
  if (!dias.length) return null;

  const sorted = dias
    .map((d) => {
      const target = dayMap[d];
      if (target === undefined) return null;
      let diff = target - today;
      if (diff < 0) diff += 7;
      return { d, diff };
    })
    .filter(Boolean)
    .sort((a, b) => a.diff - b.diff);

  if (!sorted.length) return null;
  const { d, diff } = sorted[0];
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return dayNames[d] || null;
}

function occupancyInfo(alumnos, cupo) {
  const a = Number(alumnos || 0);
  const c = Number(cupo || 0);
  const pct = c ? Math.round((a / c) * 100) : 0;
  const barCls = pct >= 90 ? "occHigh" : pct >= 60 ? "occMid" : "occLow";
  const statusCls = pct >= 90 ? "occStatusFull" : pct >= 60 ? "occStatusMid" : "occStatusFree";
  const label = pct >= 90 ? "Completo" : pct >= 60 ? "Casi lleno" : "Disponible";
  return { a, c, pct, barCls, statusCls, label };
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const IcCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IcClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IcCourt = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
  </svg>
);
const IcUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IcSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IcArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
const IcLock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function Clases() {
  const [grupos, setGrupos] = useState([]);
  const [misClases, setMisClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [nivelFilt, setNivelFilt] = useState("");
  const [dia, setDia] = useState("");
  const [profesor, setProfesor] = useState("");

  const logged = isLogged();
  const user = getUser();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        const data = await apiGet("/api/grupos");
        if (!data.ok) throw new Error(data.message || "No se pudieron cargar las clases");
        setGrupos(data.grupos || []);

        if (isLogged()) {
          try {
            const res = await fetch(`${API_BASE}/api/clases/mis-clases`, {
              headers: { Authorization: `Bearer ${getToken()}` },
            });
            const misData = await res.json();
            if (misData.ok) setMisClases(misData.clases || []);
          } catch {
            // Silently skip if mis-clases fails
          }
        }
      } catch (e) {
        setErr(e.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const profesores = useMemo(() => {
    const map = new Map();
    grupos.forEach((g) => map.set(String(g.profesor_id), g.profesor));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [grupos]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return grupos.filter((g) => {
      const matchText = !text ||
        `${g.nombre} ${g.codigo} ${g.profesor} ${g.pista_habitual || ""}`.toLowerCase().includes(text);
      const matchNivel = !nivelFilt || g.nivel === nivelFilt;
      const matchDia = !dia || g.dia1 === dia || g.dia2 === dia;
      const matchProfesor = !profesor || String(g.profesor_id) === String(profesor);
      return matchText && matchNivel && matchDia && matchProfesor;
    });
  }, [grupos, q, nivelFilt, dia, profesor]);

  const hasFilters = q || nivelFilt || dia || profesor;
  const totalAlumnos = useMemo(
    () => grupos.reduce((sum, g) => sum + Number(g.alumnos || 0), 0),
    [grupos]
  );

  const clearFilters = () => { setQ(""); setNivelFilt(""); setDia(""); setProfesor(""); };

  return (
    <section className="clases">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="clasesHero">
        <div className="heroContent">
          <div className="heroText">
            <h1 className="heroTitle">
              Clases<span className="heroTitleAccent"> y Grupos</span>
            </h1>
            <p className="heroSub">
              {logged
                ? `Bienvenido, ${user?.nombre?.split(" ")[0] || "alumno"}. Consulta tus clases y explora todos los grupos.`
                : "Descubre los grupos, horarios y niveles de nuestra escuela de pádel."}
            </p>
            {!logged && (
              <Link to="/login" className="heroCtaBtn">
                <IcLock />
                Inicia sesión para ver tus clases
                <IcArrow />
              </Link>
            )}
          </div>
          <div className="heroStats">
            <div className="statCard">
              <strong>{loading ? "—" : grupos.length}</strong>
              <span>grupos activos</span>
            </div>
            <div className="statCard">
              <strong>{loading ? "—" : totalAlumnos}</strong>
              <span>alumnos inscritos</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MIS CLASES ───────────────────────────────────────────────────── */}
      {logged && (
        <section className="misClasesSection">
          <div className="misClasesHeader">
            <h2 className="misClasesTitle">Mis clases</h2>
            <p className="misClasesSub">
              {loading
                ? "Cargando..."
                : misClases.length > 0
                  ? `Tienes ${misClases.length} clase${misClases.length !== 1 ? "s" : ""} asignada${misClases.length !== 1 ? "s" : ""}`
                  : "Aún no tienes clases asignadas"}
            </p>
          </div>

          {loading && (
            <div className="misClasesSkeleton">
              {[1, 2].map((i) => <div className="misClaseSkeletonCard" key={i} />)}
            </div>
          )}

          {!loading && misClases.length > 0 && (
            <div className="misClasesGrid">
              {misClases.map((c) => {
                const proxima = proximaDia(c.dia1, c.dia2);
                return (
                  <div className="miClaseCard" key={c.id}>
                    <div className="miClaseTop">
                      <span className={`badge ${nivelBadgeClass(c.nivel)}`}>{nivelLabel(c.nivel)}</span>
                      <span className="codeTag">{c.codigo}</span>
                    </div>
                    <h3 className="miClaseNombre">{c.nombre}</h3>
                    <ul className="miClaseMeta">
                      <li><IcCalendar /><span>{formatDias(c.dia1, c.dia2)}</span></li>
                      <li><IcClock /><span>{formatHora(c.hora_inicio, c.duracion_min)}</span></li>
                      <li><IcCourt /><span>Pista {c.pista_habitual || "—"}</span></li>
                      <li><IcUser /><span>{c.profesor}</span></li>
                    </ul>
                    {proxima && (
                      <div className={`miClaseProxima${proxima === "Hoy" ? " proximaHoy" : ""}`}>
                        <IcClock />
                        Próxima: <strong>{proxima}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && misClases.length === 0 && (
            <div className="misClasesEmpty">
              <IcCalendar />
              <p>No tienes clases asignadas todavía. <strong>Contacta con la escuela</strong> para apuntarte a un grupo.</p>
            </div>
          )}
        </section>
      )}

      {/* ── TODOS LOS GRUPOS ─────────────────────────────────────────────── */}
      <div className="todosGruposSection">
        <div className="sectionHeaderRow">
          <h2 className="sectionTitle">
            {logged ? "Todos los grupos" : "Grupos disponibles"}
          </h2>
          {!loading && hasFilters && (
            <span className="resultsBadge">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── FILTROS ── */}
        <div className="filtersBar">
          <div className="searchWrap">
            <span className="searchIcon"><IcSearch /></span>
            <input
              className="searchInput"
              type="text"
              placeholder="Buscar grupo, profe, pista, código..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="searchClear" onClick={() => setQ("")} aria-label="Limpiar búsqueda">
                ×
              </button>
            )}
          </div>

          <select className="select" value={nivelFilt} onChange={(e) => setNivelFilt(e.target.value)}>
            <option value="">Nivel</option>
            <option value="ninos">Niños</option>
            <option value="iniciacion">Iniciación</option>
            <option value="avanzado">Avanzado</option>
            <option value="avanzado_plus">Avanzado +</option>
            <option value="competicion">Competición</option>
          </select>

          <select className="select" value={dia} onChange={(e) => setDia(e.target.value)}>
            <option value="">Día</option>
            <option value="L">Lunes</option>
            <option value="M">Martes</option>
            <option value="X">Miércoles</option>
            <option value="J">Jueves</option>
            <option value="V">Viernes</option>
            <option value="S">Sábado</option>
            <option value="D">Domingo</option>
          </select>

          <select className="select" value={profesor} onChange={(e) => setProfesor(e.target.value)}>
            <option value="">Profesor</option>
            {profesores.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {hasFilters && (
            <button className="btnClear" onClick={clearFilters}>Limpiar</button>
          )}
        </div>

        {/* ── ESTADOS ── */}
        {loading && (
          <div className="skeletonGrid">
            {Array.from({ length: 6 }).map((_, i) => <div className="skeletonCard" key={i} />)}
          </div>
        )}

        {!loading && err && (
          <div className="errorBox">
            <strong>Error al cargar</strong>
            <p>{err}</p>
          </div>
        )}

        {!loading && !err && filtered.length === 0 && (
          <div className="emptyBox">
            <IcSearch />
            <strong>Sin resultados</strong>
            <p>Prueba quitando algún filtro o busca por "pista 1", "competición"…</p>
          </div>
        )}

        {/* ── CARDS ── */}
        {!loading && !err && filtered.length > 0 && (
          <div className="listaClases">
            {filtered.map((g) => {
              const { a, c, pct, barCls, statusCls, label } = occupancyInfo(g.alumnos, g.cupo);
              const proxima = proximaDia(g.dia1, g.dia2);

              return (
                <article className="claseCard" key={g.id}>
                  <div className="cardTop">
                    <span className={`badge ${nivelBadgeClass(g.nivel)}`}>{nivelLabel(g.nivel)}</span>
                    <span className="codeTag">{g.codigo}</span>
                  </div>

                  <h3 className="cardTitle">{g.nombre}</h3>

                  <div className="metaGrid">
                    <div className="metaItem">
                      <span className="metaLabel"><IcCalendar /> Días</span>
                      <span className="metaValue">{formatDias(g.dia1, g.dia2)}</span>
                    </div>
                    <div className="metaItem">
                      <span className="metaLabel"><IcClock /> Hora</span>
                      <span className="metaValue">{formatHora(g.hora_inicio, g.duracion_min)}</span>
                    </div>
                    <div className="metaItem">
                      <span className="metaLabel"><IcCourt /> Pista</span>
                      <span className="metaValue">{g.pista_habitual || "—"}</span>
                    </div>
                    <div className="metaItem">
                      <span className="metaLabel"><IcUser /> Profesor</span>
                      <span className="metaValue">{g.profesor || "—"}</span>
                    </div>
                  </div>

                  <div className="cardFooter">
                    <div className="occupancyWrap">
                      <div className="occTopRow">
                        <div className={`occBar ${barCls}`}>
                          <span style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className={`occStatus ${statusCls}`}>{label}</span>
                      </div>
                      <div className="occCount">{a}/{c || "—"} alumnos</div>
                    </div>

                    {(proxima || !logged) && (
                      <div className="cardBottomRow">
                        {proxima && (
                          <div className={`cardProxima${proxima === "Hoy" ? " cardProximaHoy" : ""}`}>
                            <IcClock />
                            Próxima: <strong>{proxima}</strong>
                          </div>
                        )}
                        {!logged && (
                          <Link to="/login" className="cardLoginCta">
                            <IcLock />
                            Acceder
                          </Link>
                        )}
                      </div>
                    )}
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
