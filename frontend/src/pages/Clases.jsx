import "./clases.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import ClasesPublica from "../components/clases/ClasesPublica";
import ClasesAlumno from "../components/clases/ClasesAlumno";
import {
  DAY_LABELS, IcArrow, IcCalendar, IcClock, IcCourt, IcSearch, IcUser,
  formatDias, formatHora, nivelBadgeClass, nivelLabel, proximaDia,
} from "../components/clases/clasesComun";

const STAFF_ROLES = ["admin", "profesor", "profe"];

function capacidadReal(cupo, nivel) {
  if (Number(cupo) > 0) return Number(cupo);
  return nivel === "ninos" ? 6 : 4;
}

function occupancyInfo(alumnos, cupo, nivel) {
  const a = Number(alumnos || 0);
  const c = capacidadReal(cupo, nivel);
  const pct = c ? Math.round((a / c) * 100) : 0;
  const barCls = pct >= 90 ? "occHigh" : pct >= 60 ? "occMid" : "occLow";
  const statusCls = pct >= 90 ? "occStatusFull" : pct >= 60 ? "occStatusMid" : "occStatusFree";
  const label = pct >= 90 ? "Completo" : pct >= 60 ? "Casi lleno" : "Disponible";
  return { a, c, pct, barCls, statusCls, label };
}

function GroupCard({ grupo }) {
  const { a, c, pct, barCls, statusCls, label } = occupancyInfo(grupo.alumnos, grupo.cupo, grupo.nivel);
  const proxima = proximaDia(grupo.dia1, grupo.dia2);

  return (
    <article className="claseCard" data-nivel={grupo.nivel || "default"}>
      <div className="cardTop">
        <span className={`badge ${nivelBadgeClass(grupo.nivel)}`}>{nivelLabel(grupo.nivel)}</span>
        <span className="codeTag">{grupo.codigo}</span>
      </div>
      <div className="cardBody">
        <h3 className="cardTitle">{grupo.nombre}</h3>
        <div className="metaGrid">
          <div className="metaItem"><span className="metaLabel"><IcCalendar /> Días</span><span className="metaValue">{formatDias(grupo.dia1, grupo.dia2)}</span></div>
          <div className="metaItem"><span className="metaLabel"><IcClock /> Hora</span><span className="metaValue">{formatHora(grupo.hora_inicio, grupo.duracion_min)}</span></div>
          <div className="metaItem"><span className="metaLabel"><IcCourt /> Pista</span><span className="metaValue">{grupo.pista_habitual || "-"}</span></div>
          <div className="metaItem"><span className="metaLabel"><IcUser /> Profesor</span><span className="metaValue">{grupo.profesor || "-"}</span></div>
        </div>
        <div className="cardFooter">
          <div className="occupancyWrap">
            <div className="occTopRow">
              <div className={`occBar ${barCls}`}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <span className={`occStatus ${statusCls}`}>{label}</span>
            </div>
            <div className="occCount">{a}/{c || "-"} alumnos</div>
          </div>
          <div className="cardBottomRow">
            {proxima && <div className={`cardProxima${proxima === "Hoy" ? " cardProximaHoy" : ""}`}><IcClock />Próxima: <strong>{proxima}</strong></div>}
            <Link to="/panel" className="cardLoginCta">Gestionar <IcArrow /></Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function StaffClassesSummary({ classData, grupos, loading, err, q, setQ, nivelFilt, setNivelFilt, dia, setDia, profesor, setProfesor, clearFilters, hasFilters }) {
  const staffSummary = classData?.resumen_profesor || null;
  const hoy = staffSummary?.clases_hoy || [];
  const profesores = useMemo(() => {
    const map = new Map();
    grupos.forEach((g) => {
      if (g.profesor_id) map.set(String(g.profesor_id), g.profesor);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [grupos]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return grupos.filter((g) => {
      const matchText = !text || `${g.nombre} ${g.codigo} ${g.profesor} ${g.pista_habitual || ""}`.toLowerCase().includes(text);
      const matchNivel = !nivelFilt || g.nivel === nivelFilt;
      const matchDia = !dia || g.dia1 === dia || g.dia2 === dia;
      const matchProfesor = !profesor || String(g.profesor_id) === String(profesor);
      return matchText && matchNivel && matchDia && matchProfesor;
    });
  }, [grupos, q, nivelFilt, dia, profesor]);

  return (
    <section className="clases clasesStaff">
      <header className="clasesHero staffHero">
        <div className="heroContent">
          <div className="heroText">
            <h1 className="heroTitle">Clases</h1>
            <p className="heroSub">Resumen rápido de grupos, clases de hoy y seguimiento de la escuela.</p>
            <Link to="/panel" className="heroCtaBtn staffPanelCta">Ir al panel <IcArrow /></Link>
          </div>
          <div className="heroStats">
            <div className="statCard"><span>Hoy</span><strong>{staffSummary?.stats?.clases_hoy || 0}</strong></div>
            <div className="statCard"><span>Grupos</span><strong>{staffSummary?.stats?.grupos || 0}</strong></div>
            <div className="statCard"><span>Alumnos</span><strong>{staffSummary?.stats?.alumnos || 0}</strong></div>
          </div>
        </div>
      </header>

      <section className="staffDashboard">
        <div className="staffPanel todayPanel">
          <div className="staffPanelHead">
            <div>
              <span>Agenda</span>
              <h2>Clases de hoy</h2>
            </div>
            <strong>{hoy.length}</strong>
          </div>
          {hoy.length ? hoy.map((g) => (
            <article className="staffClassRow" key={g.id}>
              <div>
                <strong>{g.nombre}</strong>
                <span>{nivelLabel(g.nivel)} · {g.profesor || "Profesor sin asignar"}</span>
              </div>
              <div className="staffClassChips">
                <span><IcClock /> {formatHora(g.hora_inicio, g.duracion_min)}</span>
                <span><IcCourt /> {g.pista_habitual || "Pista pendiente"}</span>
                <span><IcUser /> {g.alumnos || 0}</span>
              </div>
            </article>
          )) : <p className="softEmpty">No hay clases programadas para hoy.</p>}
        </div>
        <div className="staffPanel trackingPanel">
          <div className="staffPanelHead">
            <div>
              <span>Control</span>
              <h2>Seguimiento</h2>
            </div>
          </div>
          <div className="trackingMiniGrid">
            <Link to="/avisos" className="miniMetric miniMetricLink">
              <span>Avisos activos</span>
              <strong>{staffSummary?.stats?.avisos || 0}</strong>
            </Link>
            <Link to="/panel" className="miniMetric miniMetricLink">
              <span>Recuperaciones pendientes</span>
              <strong>{staffSummary?.stats?.recuperaciones || 0}</strong>
            </Link>
            <Link to="/panel" className="miniMetric miniMetricAction">
              <span>Gestión</span>
              <strong>Panel</strong>
            </Link>
          </div>
          <p className="panelHint">Gestiona grupos, alumnos y avisos desde el panel.</p>
        </div>
      </section>

      <section className="todosGruposSection">
        <div className="sectionHeaderRow">
          <h2 className="sectionTitle">Grupos asignados</h2>
          {!loading && hasFilters && <span className="resultsBadge">{filtered.length} resultados</span>}
        </div>
        <div className="filtersBar">
          <div className="searchWrap">
            <span className="searchIcon"><IcSearch /></span>
            <input className="searchInput" type="text" placeholder="Buscar grupo, profe, pista, código..." value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="searchClear" onClick={() => setQ("")} aria-label="Limpiar búsqueda">x</button>}
          </div>
          <select className="select" value={nivelFilt} onChange={(e) => setNivelFilt(e.target.value)}>
            <option value="">Nivel</option>
            <option value="ninos">Niños</option>
            <option value="iniciacion">Iniciación</option>
            <option value="medio">Medio</option>
            <option value="avanzado">Avanzado</option>
            <option value="avanzado_plus">Avanzado +</option>
            <option value="competicion">Competición</option>
          </select>
          <select className="select" value={dia} onChange={(e) => setDia(e.target.value)}>
            <option value="">Día</option>
            {Object.entries(DAY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="select" value={profesor} onChange={(e) => setProfesor(e.target.value)}>
            <option value="">Profesor</option>
            {profesores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {hasFilters && <button className="btnClear" onClick={clearFilters}>Limpiar</button>}
        </div>

        {loading && <div className="skeletonGrid">{Array.from({ length: 4 }).map((_, i) => <div className="skeletonCard" key={i} />)}</div>}
        {!loading && err && <div className="errorBox"><strong>No hemos podido cargar la información.</strong><p>{err}</p></div>}
        {!loading && !err && filtered.length === 0 && <div className="emptyBox"><IcSearch /><strong>Sin resultados</strong><p>No hay grupos para los filtros seleccionados.</p></div>}
        {!loading && !err && filtered.length > 0 && <div className="listaClases">{filtered.map((g) => <GroupCard key={g.id} grupo={g} />)}</div>}
      </section>
    </section>
  );
}

export default function Clases() {
  const [classData, setClassData] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [nivelFilt, setNivelFilt] = useState("");
  const [dia, setDia] = useState("");
  const [profesor, setProfesor] = useState("");

  const logged = isLogged();
  const user = getUser();
  const role = String(user?.rol || "").toLowerCase();
  const isLocalStaff = STAFF_ROLES.includes(role);
  const tipoVista = classData?.tipoVista || (logged ? null : "publica");
  const hasFilters = q || nivelFilt || dia || profesor;
  const clearFilters = () => { setQ(""); setNivelFilt(""); setDia(""); setProfesor(""); };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        if (!isLogged()) {
          setClassData({ tipoVista: "publica" });
          return;
        }

        // Con sesión, el backend decide la vista y filtra los datos autorizados.
        const profile = await apiGet("/api/clases/mis-clases");
        setClassData(profile);
        if (profile.tipoVista === "profesor" || profile.tipoVista === "admin") {
          setGrupos(profile.resumen_profesor?.grupos || profile.resumen?.gruposAsignados || []);
        }
      } catch (e) {
        setErr(e.message || "Inténtalo de nuevo en unos segundos.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading && !classData) {
    return (
      <section className="clases">
        <header className="clasesHero"><div className="skeletonCard" /></header>
        <div className="skeletonGrid">{Array.from({ length: 4 }).map((_, i) => <div className="skeletonCard" key={i} />)}</div>
      </section>
    );
  }

  if (err && !classData) {
    return <section className="clases"><div className="errorBox"><strong>No hemos podido cargar tus clases.</strong><p>{err}</p></div></section>;
  }

  if (tipoVista === "publica" || tipoVista === "sin_vincular") {
    return <ClasesPublica notice={tipoVista === "sin_vincular" ? classData?.mensaje : null} />;
  }

  if (tipoVista === "profesor" || tipoVista === "admin" || isLocalStaff) {
    return (
      <StaffClassesSummary
        classData={classData}
        grupos={grupos}
        loading={loading}
        err={err}
        q={q}
        setQ={setQ}
        nivelFilt={nivelFilt}
        setNivelFilt={setNivelFilt}
        dia={dia}
        setDia={setDia}
        profesor={profesor}
        setProfesor={setProfesor}
        clearFilters={clearFilters}
        hasFilters={hasFilters}
      />
    );
  }

  return <ClasesAlumno classData={classData} loading={loading} />;
}
