import "./clases.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { getUser, isLogged } from "../services/auth";

const DAY_LABELS = { L: "Lunes", M: "Martes", X: "Miercoles", J: "Jueves", V: "Viernes", S: "Sabado", D: "Domingo" };
const STAFF_ROLES = ["admin", "profesor", "profe"];
const CONTACT_HREF = "mailto:info@nanipadel.com";

const PUBLIC_LEVELS = [
  { title: "Ninos", text: "Aprendizaje seguro y divertido, con juegos, tecnica basica y habitos de pista." },
  { title: "Iniciacion", text: "Para quienes empiezan desde cero o quieren ganar confianza con los golpes basicos." },
  { title: "Medio", text: "Para jugadores que ya pelotean y buscan mejorar colocacion, consistencia y toma de decisiones." },
  { title: "Avanzado", text: "Ritmo alto, patrones tacticos y trabajo especifico para competir mejor." },
  { title: "Competicion", text: "Entrenamientos exigentes para jugadores que compiten o quieren preparar partidos." },
];

const CLASS_FORMATS = [
  { title: "Grupos 1 dia/semana", text: "Ideal para mantener ritmo y mejorar poco a poco.", badge: "Ritmo semanal", icon: "calendar" },
  { title: "Grupos 2 dias/semana", text: "La opcion mas completa para progresar con continuidad.", badge: "Mas progreso", icon: "repeat" },
  { title: "Clases particulares", text: "Entrenamientos personalizados para trabajar objetivos concretos.", badge: "A medida", icon: "target" },
  { title: "Tecnificacion", text: "Sesiones enfocadas en golpes, tactica y situaciones reales de partido.", badge: "Detalle tecnico", icon: "court" },
  { title: "Intensivos", text: "Entrenamientos puntuales para avanzar en periodos concretos.", badge: "Por temporada", icon: "spark" },
];

const METHOD_ITEMS = [
  { title: "Grupos organizados por nivel", text: "Buscamos que entrenes con alumnos de ritmo parecido para que la clase fluya." },
  { title: "Seguimiento del progreso", text: "El objetivo es que cada alumno sepa que esta trabajando y que debe reforzar." },
  { title: "Avisos y comunicacion con el profesor", text: "Cuando formes parte de la escuela, tendras tu zona para consultar informacion de clase." },
  { title: "Entrenamientos adaptados a cada grupo", text: "No todos los grupos necesitan lo mismo: ajustamos tecnica, tactica y partido." },
];

const PRICE_ITEMS = [
  { title: "Clases en grupo", text: "Consultar cuota segun dias y grupo" },
  { title: "Clases particulares", text: "Consultar disponibilidad" },
  { title: "Intensivos", text: "Segun temporada" },
  { title: "Tecnificacion", text: "Consultar plazas" },
];

const ORIENTATIVE_SCHEDULES = [
  { title: "Tardes entre semana", text: "La mayor parte de grupos se organiza en franjas de tarde." },
  { title: "Grupos por nivel", text: "Te orientamos hacia el grupo que mejor encaje con tu juego." },
  { title: "Opciones para ninos y adultos", text: "Clases pensadas para diferentes edades, objetivos y ritmos." },
  { title: "Intensivos puntuales", text: "Puede haber sesiones especiales en periodos concretos." },
];

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
const IcTarget = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>;
const IcRepeat = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>;
const IcSpark = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m12 3 1.9 5.3L19 10.2l-5.1 1.9L12 17.5l-1.9-5.4L5 10.2l5.1-1.9L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>;

function PublicFormatIcon({ type }) {
  const icons = {
    calendar: <IcCalendar />,
    repeat: <IcRepeat />,
    target: <IcTarget />,
    court: <IcCourt />,
    spark: <IcSpark />,
  };
  return icons[type] || <IcCourt />;
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
          {proxima && <div className={`cardProxima${proxima === "Hoy" ? " cardProximaHoy" : ""}`}><IcClock />Proxima: <strong>{proxima}</strong></div>}
        </div>
      </div>
    </article>
  );
}

function PublicClassesLanding({ notice }) {
  return (
    <section className="clases clasesPublicas">
      <header className="clasesHero publicHero">
        <div className="heroContent">
          <div className="heroText">
            <span className="publicEyebrow">Escuela NaniPadel</span>
            <h1 className="heroTitle">Clases de padel para todos los niveles</h1>
            <p className="heroSub">Entrena en grupos reducidos, mejora tu juego y encuentra el horario que mejor encaje contigo.</p>
            <div className="heroActions">
              <a href={CONTACT_HREF} className="heroCtaBtn">Solicitar informacion <IcArrow /></a>
              <a href="#niveles" className="heroSecondaryBtn">Ver niveles</a>
            </div>
            <div className="publicHeroBadges" aria-label="Tipos de clases disponibles">
              <span>Ninos y adultos</span>
              <span>Grupos por nivel</span>
              <span>Clases particulares</span>
              <span>Tecnificacion</span>
            </div>
          </div>
          <div className="publicHeroVisual" aria-hidden="true">
            <div className="courtCard">
              <div className="courtLines"><span /></div>
              <div className="trainingNote">
                <strong>Busca tu grupo</strong>
                <span>Te orientamos por nivel, edad y disponibilidad.</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {notice && (
        <div className="accountNotice">
          <strong>Tu cuenta aun no esta vinculada como alumno de la escuela.</strong>
          <p>{notice}</p>
          <a href={CONTACT_HREF} className="inlineHelpBtn">Contactar con el club</a>
        </div>
      )}

      <section className="publicSection">
        <div className="sectionHeaderStack">
          <span className="publicEyebrow">Formatos</span>
          <h2 className="sectionTitle">Que tipo de clase buscas?</h2>
          <p>Clases para ninos, adultos y jugadores de competicion, con opciones para entrenar de forma regular o trabajar objetivos concretos.</p>
        </div>
        <div className="publicFormatGrid">
          {CLASS_FORMATS.map((item) => (
            <article className="publicFormatCard" key={item.title}>
              <div className="publicIcon"><PublicFormatIcon type={item.icon} /></div>
              <span className="publicCardBadge">{item.badge}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection" id="niveles">
        <div className="sectionHeaderStack">
          <span className="publicEyebrow">Niveles</span>
          <h2 className="sectionTitle">Entrena con alumnos de tu nivel</h2>
          <p>Si no tienes claro donde encajas, cuentanos como juegas y te ayudamos a encontrar el grupo adecuado.</p>
        </div>
        <div className="publicGrid levelGrid">
          {PUBLIC_LEVELS.map((item) => (
            <article className="publicInfoCard" key={item.title}>
              <span>{item.title}</span>
              <p>{item.text}</p>
              <a href={CONTACT_HREF}>Consultar</a>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection publicMethod">
        <div className="sectionHeaderStack">
          <span className="publicEyebrow">Metodo</span>
          <h2 className="sectionTitle">Como trabajamos en la escuela</h2>
          <p>Clases con estructura, correcciones claras y ejercicios pensados para que notes mejora en pista.</p>
        </div>
        <div className="methodList">
          {METHOD_ITEMS.map((item, index) => (
            <article className="methodItem" key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="publicSection">
        <div className="sectionHeaderStack">
          <span className="publicEyebrow">Cuotas</span>
          <h2 className="sectionTitle">Precios orientativos</h2>
          <p>Te informamos segun grupo y horario. No publicamos precios cerrados porque dependen del formato y de la disponibilidad.</p>
        </div>
        <div className="publicPriceGrid">
          {PRICE_ITEMS.map((item) => (
            <article className="priceCard" key={item.title}>
              <h3>{item.title}</h3>
              <strong>{item.text}</strong>
            </article>
          ))}
        </div>
        <p className="publicNote">Las cuotas pueden variar segun el numero de dias, tipo de grupo y disponibilidad de pista.</p>
      </section>

      <section className="publicSection">
        <div className="sectionHeaderStack">
          <span className="publicEyebrow">Horarios</span>
          <h2 className="sectionTitle">Horarios generales</h2>
          <p>Trabajamos con franjas orientativas y disponibilidad por nivel. Para saber opciones reales, lo mejor es consultarlo con el club.</p>
        </div>
        <div className="scheduleGrid">
          {ORIENTATIVE_SCHEDULES.map((item) => (
            <article className="scheduleCard" key={item.title}>
              <IcClock />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="clasesCta">
        <span className="publicEyebrow">Contacto</span>
        <h2>Quieres encontrar tu grupo?</h2>
        <p>Cuentanos tu nivel, disponibilidad y edad, y te ayudamos a buscar la mejor opcion dentro de la escuela.</p>
        <div className="heroActions">
          <a href={CONTACT_HREF} className="heroCtaBtn">Solicitar informacion</a>
          <a href={CONTACT_HREF} className="heroSecondaryBtn">Contactar con el club</a>
        </div>
      </section>

      <section className="publicLoginBox">
        <div>
          <h2>Ya eres alumno?</h2>
          <p>Entra a tu zona de clases para consultar tu informacion.</p>
        </div>
        <Link to="/login" className="heroSecondaryBtn">Entrar a mi zona de clases</Link>
      </section>
    </section>
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
    <section className="clases">
      <header className="clasesHero staffHero">
        <div className="heroContent">
          <div className="heroText">
            <h1 className="heroTitle">Resumen de clases</h1>
            <p className="heroSub">Un vistazo rapido a los grupos, alumnos y tareas pendientes de la escuela.</p>
            <Link to="/panel" className="heroCtaBtn">Ir al panel <IcArrow /></Link>
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
          <p className="panelHint">Para editar grupos, alumnos o avisos, entra en el panel.</p>
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

        {loading && <div className="skeletonGrid">{Array.from({ length: 4 }).map((_, i) => <div className="skeletonCard" key={i} />)}</div>}
        {!loading && err && <div className="errorBox"><strong>No hemos podido cargar la informacion.</strong><p>{err}</p></div>}
        {!loading && !err && filtered.length === 0 && <div className="emptyBox"><IcSearch /><strong>Sin resultados</strong><p>No hay grupos para los filtros seleccionados.</p></div>}
        {!loading && !err && filtered.length > 0 && <div className="listaClases">{filtered.map((g) => <GroupCard key={g.id} grupo={g} />)}</div>}
      </section>
    </section>
  );
}

function StudentClassesDashboard({ classData, user, loading }) {
  const alumno = classData?.alumno || {};
  const grupo = classData?.grupo || null;
  const misClases = classData?.clases || [];
  const avisos = classData?.avisos || [];
  const recuperaciones = classData?.recuperaciones || [];
  const proximasSesiones = classData?.proximasSesiones || classData?.proximas_clases || [];
  const asistenciaReciente = classData?.asistenciaReciente || classData?.asistencia || [];

  return (
    <section className="clases">
      <header className="clasesHero">
        <div className="heroContent">
          <div className="heroText">
            <h1 className="heroTitle">Mis clases</h1>
            <p className="heroSub">Aqui puedes consultar tu grupo, tus horarios y los avisos del profesor.</p>
          </div>
          <div className="heroStats">
            <div className="statCard"><strong>{loading ? "-" : misClases.length}</strong><span>grupos</span></div>
            <div className="statCard"><strong>{recuperaciones.length}</strong><span>recuperaciones</span></div>
          </div>
        </div>
      </header>

      <section className="studentProfileCard">
        <div>
          <span className={`badge ${nivelBadgeClass(alumno.nivel_juego || alumno.nivel || grupo?.nivel)}`}>{nivelLabel(alumno.nivel_juego || alumno.nivel || grupo?.nivel)}</span>
          <h2>{[alumno.nombre, alumno.apellidos].filter(Boolean).join(" ") || "Alumno"}</h2>
          <p>{classData?.mensaje || "Estos son los datos principales de tu clase en la escuela."}</p>
        </div>
        <div className="studentInfoGrid">
          <div><span>Grupo</span><strong>{grupo?.nombre || "Aun sin grupo asignado"}</strong></div>
          <div><span>Profesor</span><strong>{classData?.profesor?.nombre || grupo?.profesor || "No disponible"}</strong></div>
          <div><span>Dias</span><strong>{grupo ? formatDias(grupo.dia1, grupo.dia2) : "No disponible"}</strong></div>
          <div><span>Horario</span><strong>{grupo ? formatHora(grupo.hora_inicio, grupo.duracion_min) : "No disponible"}</strong></div>
          <div><span>Pista</span><strong>{classData?.pista || grupo?.pista_habitual || "No disponible"}</strong></div>
          <div><span>Estado</span><strong>{Number(alumno.activo ?? 1) ? "Activo" : "Inactivo"}</strong></div>
        </div>
      </section>

      <section className="studentPanels">
        <div className="studentPanel">
          <h2>Proximas clases</h2>
          {proximasSesiones.length ? proximasSesiones.map((sesion) => (
            <article className="studentMiniRow" key={sesion.id}>
              <strong>{sesion.fecha || "Fecha pendiente"}</strong>
              <span>{formatHora(sesion.hora_inicio, sesion.duracion_min || grupo?.duracion_min || 60)} - {sesion.pista_habitual || grupo?.pista_habitual || "Pista pendiente"} - {sesion.estado || "programada"}</span>
            </article>
          )) : <p className="softEmpty">Todavia no hay proximas clases registradas.</p>}
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
          <h2>Asistencia reciente</h2>
          {asistenciaReciente.length ? asistenciaReciente.map((asistencia) => (
            <article className="studentMiniRow" key={asistencia.id}>
              <strong>{asistencia.grupo || "Clase"}</strong>
              <span>{asistencia.fecha || "Fecha pendiente"} - {asistencia.estado || "sin estado"}</span>
            </article>
          )) : <p className="softEmpty">Todavia no hay asistencia registrada.</p>}
        </div>
      </section>

      <section className="studentHelpPanel">
        <div>
          <h2>Necesitas ayuda con tus clases?</h2>
          <p>Contacta con el club o consulta con tu profesor para cambios de grupo, recuperaciones o dudas de horario.</p>
        </div>
        <div className="heroActions">
          <a href={CONTACT_HREF} className="heroCtaBtn">Contactar con el club</a>
          <a href={CONTACT_HREF} className="heroSecondaryBtn">Necesito ayuda con mis clases</a>
        </div>
      </section>
    </section>
  );
}

export default function Clases() {
  const [publicData, setPublicData] = useState(null);
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
          const data = await apiGet("/api/clases/publica");
          setPublicData(data);
          setClassData({ tipoVista: "publica" });
          return;
        }

        // Con sesion, el backend decide la vista y filtra los datos autorizados.
        const profile = await apiGet("/api/clases/mis-clases");
        setClassData(profile);
        if (profile.tipoVista === "profesor" || profile.tipoVista === "admin") {
          setGrupos(profile.resumen_profesor?.grupos || profile.resumen?.gruposAsignados || []);
        }
        if (profile.tipoVista === "sin_vincular") {
          const data = await apiGet("/api/clases/publica");
          setPublicData(data);
        }
      } catch (e) {
        setErr(e.message || "Intentalo de nuevo en unos segundos.");
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
    return <PublicClassesLanding publicData={publicData} notice={tipoVista === "sin_vincular" ? classData?.mensaje : null} />;
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

  return <StudentClassesDashboard classData={classData} user={user} loading={loading} />;
}
