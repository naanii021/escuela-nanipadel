import "./clases.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { getUser, isLogged } from "../services/auth";

const DAY_LABELS = { L: "Lunes", M: "Martes", X: "Miercoles", J: "Jueves", V: "Viernes", S: "Sabado", D: "Domingo" };
const STAFF_ROLES = ["admin", "profesor", "profe"];

const PUBLIC_LEVELS = [
  { title: "Ninos", text: "Aprendizaje seguro y divertido.", target: "Para peques que empiezan o ya compiten.", goal: "Objetivo: coordinacion, tecnica base y juego en equipo." },
  { title: "Iniciacion", text: "Golpes basicos y primeras situaciones reales.", target: "Para jugadores nuevos o con poca continuidad.", goal: "Objetivo: mantener peloteos y entender la pista." },
  { title: "Medio", text: "Consistencia, colocacion y decisiones.", target: "Para alumnos que ya juegan partidos.", goal: "Objetivo: ordenar el juego y reducir errores." },
  { title: "Avanzado", text: "Ritmo alto y patrones tacticos.", target: "Para jugadores con tecnica estable.", goal: "Objetivo: competir con mas intencion." },
  { title: "Competicion", text: "Entrenamiento exigente y especifico.", target: "Para jugadores de torneo.", goal: "Objetivo: preparacion tactica, fisica y mental." },
];

const CLASS_FORMATS = ["Grupos 1 dia/semana", "Grupos 2 dias/semana", "Clases particulares", "Tecnificacion", "Intensivos"];
const ORIENTATIVE_SCHEDULES = ["Mananas bajo demanda", "Tardes por niveles", "Fines de semana segun grupo", "Grupos reducidos por edad y ritmo"];

function formatDias(d1, d2) {
  if (!d2) return DAY_LABELS[d1] || d1 || "-";
  return `${DAY_LABELS[d1] || d1} y ${DAY_LABELS[d2] || d2}`;
}

function formatHora(horaInicio, duracionMin) {
  if (!horaInicio) return "-";
  const [hh, mm] = String(horaInicio).split(":");
  const start = new Date();
  start.setHours(Number(hh), Number(mm), 0, 0);
  const end = new Date(start.getTime() + Number(duracionMin || 60) * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function nivelLabel(nivel) {
  const map = { ninos: "Ninos", iniciacion: "Iniciacion", medio: "Medio", avanzado: "Avanzado", competicion: "Competicion", avanzado_plus: "Avanzado +" };
  return map[nivel] || nivel || "-";
}

function nivelBadgeClass(nivel) {
  const map = { ninos: "badgeKids", iniciacion: "badgeInit", medio: "badgeInit", avanzado: "badgeAdv", competicion: "badgeComp", avanzado_plus: "badgePlus" };
  return map[nivel] || "badgeDefault";
}

function proximaDia(dia1, dia2) {
  const dayMap = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0 };
  const today = new Date().getDay();
  const dias = [dia1, dia2].filter(Boolean);
  const next = dias
    .map((d) => {
      const target = dayMap[d];
      if (target === undefined) return null;
      let diff = target - today;
      if (diff < 0) diff += 7;
      return { d, diff };
    })
    .filter(Boolean)
    .sort((a, b) => a.diff - b.diff)[0];

  if (!next) return null;
  if (next.diff === 0) return "Hoy";
  if (next.diff === 1) return "Manana";
  return DAY_LABELS[next.d] || null;
}

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

const IcCalendar = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcClock = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcCourt = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="2" y1="12" x2="22" y2="12"/></svg>;
const IcUser = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IcArrow = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
const IcLock = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

function GroupCard({ grupo, showLogin }) {
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
          <div className="metaItem"><span className="metaLabel"><IcCalendar /> Dias</span><span className="metaValue">{formatDias(grupo.dia1, grupo.dia2)}</span></div>
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
          {(proxima || showLogin) && (
            <div className="cardBottomRow">
              {proxima && <div className={`cardProxima${proxima === "Hoy" ? " cardProximaHoy" : ""}`}><IcClock />Proxima: <strong>{proxima}</strong></div>}
              {showLogin && <Link to="/login" className="cardLoginCta"><IcLock />Iniciar sesion</Link>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Clases() {
  const [grupos, setGrupos] = useState([]);
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [nivelFilt, setNivelFilt] = useState("");
  const [dia, setDia] = useState("");
  const [profesor, setProfesor] = useState("");

  const logged = isLogged();
  const user = getUser();
  const role = String(user?.rol || "").toLowerCase();
  const isStaff = STAFF_ROLES.includes(role);
  const misClases = classData?.clases || [];
  const staffSummary = classData?.resumen_profesor || null;
  const avisos = classData?.avisos || [];
  const recuperaciones = classData?.recuperaciones || [];
  const proximasSesiones = classData?.proximasSesiones || classData?.proximas_clases || [];
  const asistenciaReciente = classData?.asistenciaReciente || classData?.asistencia || [];

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
            const profile = await apiGet("/api/clases/mis-clases");
            if (profile.ok) setClassData(profile);
          } catch {
            setClassData(null);
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

  const hasFilters = q || nivelFilt || dia || profesor;
  const clearFilters = () => { setQ(""); setNivelFilt(""); setDia(""); setProfesor(""); };

  const groupExplorer = (title, showLogin = false) => (
    <div className="todosGruposSection" id="niveles">
      <div className="sectionHeaderRow">
        <h2 className="sectionTitle">{title}</h2>
        {!loading && hasFilters && <span className="resultsBadge">{filtered.length} resultados</span>}
      </div>

      <div className="filtersBar">
        <div className="searchWrap">
          <span className="searchIcon"><IcSearch /></span>
          <input className="searchInput" type="text" placeholder="Buscar grupo, profe, pista, codigo..." value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="searchClear" onClick={() => setQ("")} aria-label="Limpiar busqueda">x</button>}
        </div>
        <select className="select" value={nivelFilt} onChange={(e) => setNivelFilt(e.target.value)}>
          <option value="">Nivel</option>
          <option value="ninos">Ninos</option>
          <option value="iniciacion">Iniciacion</option>
          <option value="medio">Medio</option>
          <option value="avanzado">Avanzado</option>
          <option value="avanzado_plus">Avanzado +</option>
          <option value="competicion">Competicion</option>
        </select>
        <select className="select" value={dia} onChange={(e) => setDia(e.target.value)}>
          <option value="">Dia</option>
          {Object.entries(DAY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="select" value={profesor} onChange={(e) => setProfesor(e.target.value)}>
          <option value="">Profesor</option>
          {profesores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {hasFilters && <button className="btnClear" onClick={clearFilters}>Limpiar</button>}
      </div>

      {loading && <div className="skeletonGrid">{Array.from({ length: 6 }).map((_, i) => <div className="skeletonCard" key={i} />)}</div>}
      {!loading && err && <div className="errorBox"><strong>Error al cargar</strong><p>{err}</p></div>}
      {!loading && !err && filtered.length === 0 && <div className="emptyBox"><IcSearch /><strong>Sin resultados</strong><p>Prueba quitando algun filtro o busca por pista, nivel o profesor.</p></div>}
      {!loading && !err && filtered.length > 0 && <div className="listaClases">{filtered.map((g) => <GroupCard key={g.id} grupo={g} showLogin={showLogin} />)}</div>}
    </div>
  );

  if (!logged || (!isStaff && classData?.tipo === "usuario")) {
    return (
      <section className="clases clasesPublicas">
        <header className="clasesHero publicHero">
          <div className="heroContent">
            <div className="heroText">
              <h1 className="heroTitle">Clases de padel para todos los niveles</h1>
              <p className="heroSub">Entrena en grupos reducidos, mejora tu juego y encuentra tu horario ideal.</p>
              <div className="heroActions">
                <Link to="/contacto" className="heroCtaBtn">Solicitar informacion <IcArrow /></Link>
                <a href="#niveles" className="heroSecondaryBtn">Ver niveles</a>
              </div>
            </div>
            <div className="heroStats">
              <div className="statCard"><strong>{loading ? "-" : grupos.length}</strong><span>grupos activos</span></div>
              <div className="statCard"><strong>5</strong><span>niveles</span></div>
            </div>
          </div>
        </header>

        {logged && classData?.mensaje && (
          <div className="accountNotice">
            <strong>Cuenta sin ficha de alumno vinculada</strong>
            <p>{classData.mensaje}</p>
          </div>
        )}

        <section className="publicSection">
          <div className="sectionHeaderRow"><h2 className="sectionTitle">Niveles de escuela</h2></div>
          <div className="publicGrid">
            {PUBLIC_LEVELS.map((item) => (
              <article className="publicInfoCard" key={item.title}>
                <span>{item.title}</span>
                <h3>{item.text}</h3>
                <p>{item.target}</p>
                <small>{item.goal}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="publicSplit">
          <div className="publicPanel"><h2>Formatos de clase</h2><div className="chipList">{CLASS_FORMATS.map((item) => <span key={item}>{item}</span>)}</div></div>
          <div className="publicPanel"><h2>Precios orientativos</h2><p>Las cuotas dependen del formato, edad y frecuencia. Cerramos precio al solicitar plaza.</p><strong>Consultar con la escuela</strong></div>
          <div className="publicPanel"><h2>Horarios orientativos</h2><div className="chipList">{ORIENTATIVE_SCHEDULES.map((item) => <span key={item}>{item}</span>)}</div></div>
        </section>

        {groupExplorer("Explora grupos y horarios", true)}

        <section className="clasesCta">
          <h2>Quieres apuntarte?</h2>
          <p>Cuentanos tu nivel y disponibilidad y buscamos el grupo que mejor encaje contigo.</p>
          <div className="heroActions">
            <Link to="/contacto" className="heroCtaBtn">Contactar con la escuela</Link>
            <Link to="/login" className="heroSecondaryBtn">Solicitar plaza</Link>
          </div>
        </section>
      </section>
    );
  }

  if (isStaff) {
    const hoy = staffSummary?.clases_hoy || [];
    return (
      <section className="clases">
        <header className="clasesHero staffHero">
          <div className="heroContent">
            <div className="heroText">
              <h1 className="heroTitle">Resumen de clases</h1>
              <p className="heroSub">Vista rapida para profesores y administracion. El trabajo completo sigue en el panel interno.</p>
              <Link to="/gestion" className="heroCtaBtn">Ir al panel de profesor <IcArrow /></Link>
            </div>
            <div className="heroStats">
              <div className="statCard"><strong>{staffSummary?.stats?.clases_hoy || 0}</strong><span>hoy</span></div>
              <div className="statCard"><strong>{staffSummary?.stats?.grupos || 0}</strong><span>grupos</span></div>
              <div className="statCard"><strong>{staffSummary?.stats?.alumnos || 0}</strong><span>alumnos</span></div>
            </div>
          </div>
        </header>

        <section className="staffDashboard">
          <div className="staffPanel">
            <h2>Clases de hoy</h2>
            {hoy.length ? hoy.map((g) => <article className="staffRow" key={g.id}><strong>{g.nombre}</strong><span>{formatHora(g.hora_inicio, g.duracion_min)} - {g.pista_habitual || "Pista pendiente"} - {g.alumnos || 0} alumnos</span></article>) : <p className="softEmpty">No hay clases programadas para hoy.</p>}
          </div>
          <div className="staffPanel">
            <h2>Seguimiento</h2>
            <div className="miniMetric"><span>Avisos activos</span><strong>{staffSummary?.stats?.avisos || 0}</strong></div>
            <div className="miniMetric"><span>Recuperaciones pendientes</span><strong>{staffSummary?.stats?.recuperaciones || 0}</strong></div>
            <p className="panelHint">Los avisos y recuperaciones ya se leen desde MySQL si las tablas existen.</p>
          </div>
        </section>

        {groupExplorer("Grupos de referencia")}
      </section>
    );
  }

  return (
    <section className="clases">
      <header className="clasesHero">
        <div className="heroContent">
          <div className="heroText">
            <h1 className="heroTitle">Mis clases</h1>
            <p className="heroSub">Bienvenido, {classData?.alumno?.nombre || user?.nombre?.split(" ")[0] || "alumno"}. Consulta tus horarios, grupo, profesor y seguimiento.</p>
          </div>
          <div className="heroStats">
            <div className="statCard"><strong>{loading ? "-" : misClases.length}</strong><span>grupos asignados</span></div>
            <div className="statCard"><strong>{recuperaciones.length}</strong><span>recuperaciones</span></div>
          </div>
        </div>
      </header>

      <section className="misClasesSection">
        <div className="misClasesHeader">
          <h2 className="misClasesTitle">Zona personal de clases</h2>
          <p className="misClasesSub">{loading ? "Cargando..." : misClases.length ? `Tienes ${misClases.length} grupo${misClases.length !== 1 ? "s" : ""} asignado${misClases.length !== 1 ? "s" : ""}` : "Aun no tienes clases asignadas"}</p>
        </div>
        {loading && <div className="misClasesSkeleton">{[1, 2].map((i) => <div className="misClaseSkeletonCard" key={i} />)}</div>}
        {!loading && misClases.length > 0 && <div className="misClasesGrid">{misClases.map((c) => <div className="miClaseCard" key={c.id} data-nivel={c.nivel || "default"}><div className="miClaseTop"><span className={`badge ${nivelBadgeClass(c.nivel)}`}>{nivelLabel(c.nivel)}</span><span className="codeTag">{c.codigo}</span></div><h3 className="miClaseNombre">{c.nombre}</h3><ul className="miClaseMeta"><li><IcCalendar /><span>{formatDias(c.dia1, c.dia2)}</span></li><li><IcClock /><span>{formatHora(c.hora_inicio, c.duracion_min)}</span></li><li><IcCourt /><span>Pista {c.pista_habitual || "-"}</span></li><li><IcUser /><span>{c.profesor}</span></li></ul><div className={`miClaseProxima${proximaDia(c.dia1, c.dia2) === "Hoy" ? " proximaHoy" : ""}`}><IcClock />Proxima: <strong>{proximaDia(c.dia1, c.dia2) || "Pendiente"}</strong></div></div>)}</div>}
        {!loading && misClases.length === 0 && <div className="misClasesEmpty"><IcCalendar /><p>Aun no tienes grupo asignado. <strong>Contacta con la escuela</strong> para que te asignen horario.</p></div>}
      </section>

      <section className="studentPanels">
        <div className="studentPanel">
          <h2>Proxima clase</h2>
          {proximasSesiones[0] ? (
            <p><strong>{proximasSesiones[0].fecha}</strong> - {formatHora(proximasSesiones[0].hora_inicio, proximasSesiones[0].duracion_min || 60)} - {proximasSesiones[0].pista_habitual || "Pista pendiente"} - {proximasSesiones[0].profesor || "Profesor pendiente"}</p>
          ) : misClases[0] ? (
            <p><strong>{proximaDia(misClases[0].dia1, misClases[0].dia2) || "Pendiente"}</strong> - {formatHora(misClases[0].hora_inicio, misClases[0].duracion_min)} - {misClases[0].pista_habitual || "Pista pendiente"} - {misClases[0].profesor}</p>
          ) : (
            <p className="softEmpty">Todavia no hay proximas clases registradas.</p>
          )}
        </div>
        <div className="studentPanel">
          <h2>Avisos del profesor</h2>
          {avisos.length ? avisos.map((aviso) => (
            <article className="studentMiniRow" key={aviso.id}>
              <strong>{aviso.titulo}</strong>
              <span>{aviso.mensaje}</span>
            </article>
          )) : <p className="softEmpty">No tienes avisos nuevos.</p>}
        </div>
        <div className="studentPanel">
          <h2>Recuperaciones pendientes</h2>
          {recuperaciones.length ? recuperaciones.map((recuperacion) => (
            <article className="studentMiniRow" key={recuperacion.id}>
              <strong>{recuperacion.motivo || "Recuperacion"}</strong>
              <span>{recuperacion.fecha_original || "Fecha pendiente"} - {recuperacion.estado || "pendiente"}</span>
            </article>
          )) : <p className="positiveEmpty">No tienes clases pendientes de recuperar.</p>}
        </div>
        <div className="studentPanel">
          <h2>Historial y asistencia</h2>
          {asistenciaReciente.length ? asistenciaReciente.map((asistencia) => (
            <article className="studentMiniRow" key={asistencia.id}>
              <strong>{asistencia.grupo || "Clase"}</strong>
              <span>{asistencia.fecha || "Fecha pendiente"} - {asistencia.estado || "sin estado"}</span>
            </article>
          )) : <p className="softEmpty">Todavia no hay asistencia registrada.</p>}
        </div>
      </section>
    </section>
  );
}
