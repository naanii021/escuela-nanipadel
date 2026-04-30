import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import { getToken, getUser, logout } from "../services/auth";
import "./panelProfesor.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];

const IcSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

function canAccess(user) {
  return STAFF_ROLES.includes(String(user?.rol || "").toLowerCase());
}

function formatDias(d1, d2) {
  const map = { L: "Lunes", M: "Martes", X: "Miercoles", J: "Jueves", V: "Viernes", S: "Sabado", D: "Domingo" };
  return [d1, d2].filter(Boolean).map((dia) => map[dia] || dia).join(" y ") || "-";
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
  const map = {
    ninos: "Ninos",
    iniciacion: "Iniciacion",
    avanzado: "Avanzado",
    avanzado_plus: "Avanzado +",
    competicion: "Competicion",
  };
  return map[nivel] || nivel || "-";
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

export default function PanelProfesor() {
  const navigate = useNavigate();
  const user = getUser();
  const token = getToken();
  const userId = user?.id;
  const userRole = user?.rol;

  const [activeView, setActiveView] = useState("grupos");
  const [alumnos, setAlumnos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [stats, setStats] = useState({ totalAlumnos: 0, totalGrupos: 0, gruposActivos: 0 });
  const [scope, setScope] = useState("profesor");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [nivel, setNivel] = useState("");
  const [profesor, setProfesor] = useState("");
  const [grupo, setGrupo] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!canAccess({ rol: userRole })) {
      navigate("/", { replace: true });
      return;
    }

    const loadPanel = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiGet("/api/gestion/resumen");

        setAlumnos(data.alumnos || []);
        setGrupos(data.grupos || []);
        setStats(data.stats || { totalAlumnos: 0, totalGrupos: 0, gruposActivos: 0 });
        setScope(data.scope || "profesor");
        setSelectedGroupId((data.grupos || [])[0]?.id || null);
      } catch (e) {
        const message = String(e.message || "");
        if (message.includes("401") || message.includes("No autorizado") || message.includes("Token")) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setError(message || "No se pudo cargar la zona privada");
      } finally {
        setLoading(false);
      }
    };

    loadPanel();
  }, [navigate, token, userId, userRole]);

  const profesores = useMemo(() => {
    const names = new Set();
    grupos.forEach((g) => {
      if (g.profesor) names.add(g.profesor);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [grupos]);

  const niveles = useMemo(() => {
    const values = new Set();
    [...alumnos, ...grupos].forEach((item) => {
      if (item.nivel) values.add(item.nivel);
    });
    return Array.from(values).sort();
  }, [alumnos, grupos]);

  const gruposOptions = useMemo(
    () => grupos.map((item) => ({ id: String(item.id), nombre: item.nombre || item.codigo || `Grupo ${item.id}` })),
    [grupos]
  );

  const filteredAlumnos = useMemo(() => {
    const text = normalize(search);

    return alumnos.filter((alumno) => {
      const matchText =
        !text ||
        normalize(`${alumno.nombre} ${alumno.apellidos} ${alumno.grupos} ${alumno.profesores}`).includes(text);
      const matchNivel = !nivel || alumno.nivel === nivel;
      const matchProfesor = !profesor || normalize(alumno.profesores).includes(normalize(profesor));
      const matchGrupo = !grupo || String(alumno.grupo_ids || "").split(",").includes(String(grupo));

      return matchText && matchNivel && matchProfesor && matchGrupo;
    });
  }, [alumnos, search, nivel, profesor, grupo]);

  const filteredGrupos = useMemo(() => {
    const text = normalize(search);

    return grupos.filter((item) => {
      const alumnosText = (item.alumnos || []).map((alumno) => `${alumno.nombre} ${alumno.apellidos}`).join(" ");
      const matchText = !text || normalize(`${item.nombre} ${item.codigo} ${item.profesor} ${item.pista_habitual} ${alumnosText}`).includes(text);
      const matchNivel = !nivel || item.nivel === nivel;
      const matchProfesor = !profesor || item.profesor === profesor;
      const matchGrupo = !grupo || String(item.id) === String(grupo);

      return matchText && matchNivel && matchProfesor && matchGrupo;
    });
  }, [grupos, search, nivel, profesor, grupo]);

  const selectedGroup = useMemo(
    () => filteredGrupos.find((item) => String(item.id) === String(selectedGroupId)) || filteredGrupos[0] || null,
    [filteredGrupos, selectedGroupId]
  );

  const hasFilters = search || nivel || profesor || grupo;

  const clearFilters = () => {
    setSearch("");
    setNivel("");
    setProfesor("");
    setGrupo("");
  };

  if (!token || !canAccess({ rol: userRole })) {
    return null;
  }

  return (
    <section className="staffPanel">
      <header className="staffHero">
        <div>
          <span className="staffEyebrow">Zona privada</span>
          <h1>Gestion de escuela</h1>
          <p>
            {scope === "admin"
              ? "Vista completa de alumnos, grupos y profesorado."
              : "Tus grupos asignados y los alumnos vinculados a tus clases."}
          </p>
        </div>

        <div className="staffSummary">
          <div>
            <strong>{loading ? "-" : stats.totalGrupos}</strong>
            <span>Grupos</span>
          </div>
          <div>
            <strong>{loading ? "-" : stats.totalAlumnos}</strong>
            <span>Alumnos</span>
          </div>
          <div>
            <strong>{String(user?.rol || "").toUpperCase()}</strong>
            <span>Rol</span>
          </div>
        </div>
      </header>

      <div className="staffToolbar">
        <div className="staffTabs" aria-label="Vistas del panel">
          <button className={activeView === "grupos" ? "active" : ""} onClick={() => setActiveView("grupos")}>
            Grupos
          </button>
          <button className={activeView === "alumnos" ? "active" : ""} onClick={() => setActiveView("alumnos")}>
            Alumnos
          </button>
        </div>

        <div className="staffSearch">
          <span aria-hidden="true"><IcSearch /></span>
          <input
            type="search"
            placeholder="Buscar alumno, grupo, profesor o pista"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="staffFilters">
        <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Todos los niveles</option>
          {niveles.map((item) => (
            <option key={item} value={item}>{nivelLabel(item)}</option>
          ))}
        </select>

        <select value={profesor} onChange={(e) => setProfesor(e.target.value)}>
          <option value="">Todos los profesores</option>
          {profesores.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Todos los grupos</option>
          {gruposOptions.map((item) => (
            <option key={item.id} value={item.id}>{item.nombre}</option>
          ))}
        </select>

        {hasFilters && <button onClick={clearFilters}>Limpiar filtros</button>}
      </div>

      {loading && (
        <div className="staffSkeletonGrid">
          {[1, 2, 3].map((item) => <div className="staffSkeleton" key={item} />)}
        </div>
      )}

      {!loading && error && (
        <div className="staffError">
          <strong>No se pudo cargar el panel</strong>
          <p>{error}</p>
          <Link to="/login">Volver a iniciar sesion</Link>
        </div>
      )}

      {!loading && !error && activeView === "grupos" && (
        <div className="groupsWorkspace">
          <aside className="groupList" aria-label="Listado de grupos">
            <div className="panelSectionTitle">
              <h2>Grupos</h2>
              <span>{filteredGrupos.length} resultados</span>
            </div>

            {filteredGrupos.map((item) => (
              <button
                key={item.id}
                className={String(selectedGroup?.id) === String(item.id) ? "groupListItem active" : "groupListItem"}
                onClick={() => setSelectedGroupId(item.id)}
              >
                <span className="groupListTop">
                  <strong>{item.nombre}</strong>
                  <small>{item.alumnos?.length || 0}/{item.cupo || "-"} alumnos</small>
                </span>
                <span>{nivelLabel(item.nivel)} - {formatDias(item.dia1, item.dia2)} - {formatHora(item.hora_inicio, item.duracion_min)}</span>
              </button>
            ))}

            {filteredGrupos.length === 0 && <div className="staffEmpty">No hay grupos con estos filtros.</div>}
          </aside>

          <main className="groupDetail">
            {selectedGroup ? (
              <>
                <div className="groupDetailHeader">
                  <div>
                    <span className="levelPill">{nivelLabel(selectedGroup.nivel)}</span>
                    <h2>{selectedGroup.nombre}</h2>
                    <p>{selectedGroup.codigo || "Sin codigo"} - {selectedGroup.profesor || "Profesor sin asignar"}</p>
                  </div>
                  <div className="groupCapacity">
                    <strong>{selectedGroup.alumnos?.length || 0}</strong>
                    <span>alumnos</span>
                  </div>
                </div>

                <div className="groupMetaGrid">
                  <div><span>Dias</span><strong>{formatDias(selectedGroup.dia1, selectedGroup.dia2)}</strong></div>
                  <div><span>Horario</span><strong>{formatHora(selectedGroup.hora_inicio, selectedGroup.duracion_min)}</strong></div>
                  <div><span>Pista</span><strong>{selectedGroup.pista_habitual || "-"}</strong></div>
                  <div><span>Cupo</span><strong>{selectedGroup.cupo || "-"}</strong></div>
                </div>

                <div className="studentsGrid">
                  {(selectedGroup.alumnos || []).map((alumno) => (
                    <article className="studentMiniCard" key={alumno.id}>
                      <div className="studentAvatar">{(alumno.nombre || "A").charAt(0)}</div>
                      <div>
                        <h3>{alumno.nombre} {alumno.apellidos}</h3>
                        <p>{nivelLabel(alumno.nivel || selectedGroup.nivel)}</p>
                        {(alumno.telefono || alumno.email) && <small>{alumno.telefono || alumno.email}</small>}
                      </div>
                    </article>
                  ))}
                </div>

                {(!selectedGroup.alumnos || selectedGroup.alumnos.length === 0) && (
                  <div className="staffEmpty">Este grupo no tiene alumnos asignados.</div>
                )}
              </>
            ) : (
              <div className="staffEmpty">Selecciona un grupo para ver el detalle.</div>
            )}
          </main>
        </div>
      )}

      {!loading && !error && activeView === "alumnos" && (
        <div className="studentsPanel">
          <div className="panelSectionTitle">
            <h2>Alumnos</h2>
            <span>{filteredAlumnos.length} resultados</span>
          </div>

          <div className="studentsTable">
            <div className="studentsTableHead">
              <span>Alumno</span>
              <span>Nivel</span>
              <span>Grupo</span>
              <span>Profesor</span>
              <span>Horario / pista</span>
            </div>

            {filteredAlumnos.map((alumno) => (
              <article className="studentRow" key={alumno.id}>
                <div className="studentIdentity">
                  <div className="studentAvatar">{(alumno.nombre || "A").charAt(0)}</div>
                  <div>
                    <strong>{alumno.nombre} {alumno.apellidos}</strong>
                    <small>{alumno.telefono || alumno.email || "Sin contacto"}</small>
                  </div>
                </div>
                <span className="levelPill">{nivelLabel(alumno.nivel)}</span>
                <span>{alumno.grupos || "-"}</span>
                <span>{alumno.profesores || "-"}</span>
                <span>{alumno.horarios || "-"}{alumno.pistas ? ` - Pista ${alumno.pistas}` : ""}</span>
              </article>
            ))}
          </div>

          {filteredAlumnos.length === 0 && <div className="staffEmpty">No hay alumnos con estos filtros.</div>}
        </div>
      )}
    </section>
  );
}
