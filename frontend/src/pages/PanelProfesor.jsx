import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut } from "../services/api";
import { getToken, getUser, logout } from "../services/auth";
import "./panelProfesor.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];
const NIVELES = ["ninos", "iniciacion", "avanzado", "avanzado_plus", "competicion"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const GAME_LEVELS = [
  { value: "", label: "Sin nivel de juego" },
  { value: 0, label: "0 - Iniciación" },
  { value: 1, label: "1 - Principiante" },
  { value: 2, label: "2 - Medio bajo" },
  { value: 3, label: "3 - Medio" },
  { value: 4, label: "4 - Medio alto" },
  { value: 5, label: "5 - Avanzado" },
  { value: 6, label: "6 - Competición / profesional" },
];
const GROUP_QUICK_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "ninos", label: "Niños" },
  { key: "iniciacion", label: "Iniciación" },
  { key: "avanzado", label: "Avanzado" },
  { key: "competicion", label: "Competición" },
  { key: "con-huecos", label: "Con huecos" },
  { key: "completos", label: "Completos" },
  { key: "inactivos", label: "Inactivos" },
];
const STUDENT_QUICK_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "sin-acceso", label: "Sin acceso" },
  { key: "con-acceso", label: "Con acceso" },
  { key: "activos", label: "Activos" },
  { key: "inactivos", label: "Inactivos" },
  ...NIVELES.map((item) => ({ key: `nivel:${item}`, label: nivelLabel(item) })),
];
const PANEL_SECTIONS = [
  { key: "gestion", label: "Grupos y alumnos" },
  { key: "horario", label: "Horario semanal" },
  { key: "control", label: "Control de clases" },
  { key: "recuperaciones", label: "Recuperaciones" },
  { key: "seguimiento", label: "Seguimiento" },
];
const WEEK_DAYS = [
  { key: "L", label: "Lunes" },
  { key: "M", label: "Martes" },
  { key: "X", label: "Miércoles" },
  { key: "J", label: "Jueves" },
  { key: "V", label: "Viernes" },
  { key: "S", label: "Sábado" },
];
const ATTENDANCE_STATUS = [
  { key: "presente", label: "Presente", tone: "positive" },
  { key: "falta", label: "Falta", tone: "negative" },
  { key: "justificada", label: "Falta justificada", tone: "warning" },
  { key: "recuperar", label: "Pendiente recuperar", tone: "warning" },
];
const CLASS_STATUS = [
  { key: "programada", label: "Programada", tone: "neutral" },
  { key: "dada", label: "Clase dada", tone: "positive" },
  { key: "lluvia", label: "Cancelada por lluvia", tone: "negative" },
  { key: "profesor", label: "Cancelada por profesor", tone: "negative" },
  { key: "festivo", label: "Cancelada por festivo", tone: "warning" },
  { key: "recuperar", label: "Pendiente de recuperar", tone: "warning" },
];

const emptyGroupForm = {
  codigo: "",
  nombre: "",
  nivel: "iniciacion",
  profesor_id: "",
  dia1: "L",
  dia2: "",
  hora_inicio: "18:00",
  duracion_min: 60,
  pista_habitual: "",
  cupo: 4,
  activo: 1,
};

const emptyStudentForm = {
  nombre: "",
  apellidos: "",
  nivel: "iniciacion",
  nivel_juego: "",
  telefono: "",
  email: "",
  activo: 1,
  observaciones: "",
  grupo_id: "",
};

const emptyAccessForm = {
  email: "",
  password: "",
};

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
  const map = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" };
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
    ninos: "Niños",
    iniciacion: "Iniciación",
    avanzado: "Avanzado",
    avanzado_plus: "Avanzado +",
    competicion: "Competición",
  };
  return map[nivel] || nivel || "-";
}

function nivelClass(nivel) {
  return `levelPill level-${String(nivel || "default").replace("_", "-")}`;
}

function gameLevelLabel(value) {
  const found = GAME_LEVELS.find((item) => String(item.value) === String(value));
  return found ? found.label : "Sin nivel de juego";
}

function initials(nombre, apellidos = "") {
  return `${String(nombre || "A").charAt(0)}${String(apellidos || "").charAt(0)}`.toUpperCase();
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function getGroupDays(group) {
  return [group?.dia1, group?.dia2].filter(Boolean);
}

function toGroupForm(group) {
  return {
    codigo: group.codigo || "",
    nombre: group.nombre || "",
    nivel: group.nivel || "iniciacion",
    profesor_id: group.profesor_id || "",
    dia1: group.dia1 || "L",
    dia2: group.dia2 || "",
    hora_inicio: String(group.hora_inicio || "18:00").slice(0, 5),
    duracion_min: group.duracion_min || 60,
    pista_habitual: group.pista_habitual || "",
    cupo: group.cupo || 4,
    activo: Number(group.activo ?? 1),
  };
}

export default function PanelProfesor() {
  const navigate = useNavigate();
  const user = getUser();
  const token = getToken();
  const userRole = user?.rol;
  const isAdmin = String(userRole || "").toLowerCase() === "admin";

  const [activeSection, setActiveSection] = useState("gestion");
  const [activeView, setActiveView] = useState("grupos");
  const [alumnos, setAlumnos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [catalogos, setCatalogos] = useState({ profesores: [], pistas: [], alumnos: [] });
  const [stats, setStats] = useState({ totalAlumnos: 0, totalGrupos: 0, gruposActivos: 0 });
  const [scope, setScope] = useState("profesor");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [nivel, setNivel] = useState("");
  const [profesor, setProfesor] = useState("");
  const [grupo, setGrupo] = useState("");
  const [groupQuickFilter, setGroupQuickFilter] = useState("todos");
  const [studentQuickFilter, setStudentQuickFilter] = useState("todos");
  const [studentProfile, setStudentProfile] = useState(null);

  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({});
  const [accessFormOpen, setAccessFormOpen] = useState(false);
  const [accessStudent, setAccessStudent] = useState(null);
  const [accessForm, setAccessForm] = useState(emptyAccessForm);
  const [studentToAdd, setStudentToAdd] = useState("");
  const [controlGroupId, setControlGroupId] = useState("");
  const [controlDate, setControlDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classStatus, setClassStatus] = useState("programada");
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [trackingGroupId, setTrackingGroupId] = useState("");

  const loadPanel = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/api/gestion/resumen");

      setAlumnos(data.alumnos || []);
      setGrupos(data.grupos || []);
      setCatalogos(data.catalogos || { profesores: [], pistas: [], alumnos: [] });
      setStats(data.stats || { totalAlumnos: 0, totalGrupos: 0, gruposActivos: 0 });
      setScope(data.scope || "profesor");
      setSelectedGroupId((current) => current || (data.grupos || [])[0]?.id || null);
      setControlGroupId((current) => current || (data.grupos || [])[0]?.id || "");
      setTrackingGroupId((current) => current || (data.grupos || [])[0]?.id || "");
    } catch (e) {
      const message = String(e.message || "");
      if (message.includes("401") || message.includes("No autorizado") || message.includes("Token")) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(message || "No hemos podido cargar el panel de la escuela.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!canAccess({ rol: userRole })) {
      navigate("/", { replace: true });
      return;
    }

    loadPanel();
  }, [loadPanel, navigate, token, userRole]);

  const profesores = useMemo(() => {
    const source = catalogos.profesores?.length
      ? catalogos.profesores.map((item) => ({ id: item.id, name: item.nombre_completo || `${item.nombre} ${item.apellidos || ""}`.trim() }))
      : grupos.map((item) => ({ id: item.profesor_id, name: item.profesor })).filter((item) => item.id && item.name);

    return Array.from(new Map(source.map((item) => [String(item.id), item])).values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogos.profesores, grupos]);

  const niveles = useMemo(() => {
    const values = new Set(NIVELES);
    [...alumnos, ...grupos].forEach((item) => {
      if (item.nivel) values.add(item.nivel);
    });
    return Array.from(values);
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
      const matchQuick =
        studentQuickFilter === "todos" ||
        (studentQuickFilter === "sin-acceso" && !alumno.usuario_id) ||
        (studentQuickFilter === "con-acceso" && alumno.usuario_id) ||
        (studentQuickFilter === "activos" && Number(alumno.activo ?? 1) === 1) ||
        (studentQuickFilter === "inactivos" && Number(alumno.activo ?? 1) === 0) ||
        (studentQuickFilter.startsWith("nivel:") && alumno.nivel === studentQuickFilter.replace("nivel:", ""));

      return matchText && matchNivel && matchProfesor && matchGrupo && matchQuick;
    });
  }, [alumnos, search, nivel, profesor, grupo, studentQuickFilter]);

  const filteredGrupos = useMemo(() => {
    const text = normalize(search);

    return grupos.filter((item) => {
      const alumnosText = (item.alumnos || []).map((alumno) => `${alumno.nombre} ${alumno.apellidos}`).join(" ");
      const matchText = !text || normalize(`${item.nombre} ${item.codigo} ${item.profesor} ${item.pista_habitual} ${alumnosText}`).includes(text);
      const matchNivel = !nivel || item.nivel === nivel;
      const matchProfesor = !profesor || String(item.profesor_id) === String(profesor) || item.profesor === profesor;
      const matchGrupo = !grupo || String(item.id) === String(grupo);
      const ocupacion = item.alumnos?.length || 0;
      const cupo = Number(item.cupo || 0);
      const matchQuick =
        groupQuickFilter === "todos" ||
        item.nivel === groupQuickFilter ||
        (groupQuickFilter === "avanzado" && item.nivel === "avanzado_plus") ||
        (groupQuickFilter === "con-huecos" && Number(item.activo ?? 1) === 1 && (!cupo || ocupacion < cupo)) ||
        (groupQuickFilter === "completos" && cupo > 0 && ocupacion >= cupo) ||
        (groupQuickFilter === "inactivos" && Number(item.activo ?? 1) === 0);

      return matchText && matchNivel && matchProfesor && matchGrupo && matchQuick;
    });
  }, [grupos, search, nivel, profesor, grupo, groupQuickFilter]);

  const groupedFilteredGrupos = useMemo(() => {
    const labels = [...NIVELES, "otros"];
    return labels
      .map((level) => ({
        key: level,
        label: level === "otros" ? "Otros" : nivelLabel(level),
        items: filteredGrupos.filter((item) => (NIVELES.includes(item.nivel) ? item.nivel : "otros") === level),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredGrupos]);

  const panelMetrics = useMemo(() => {
    const gruposConHuecos = grupos.filter((item) => {
      const cupo = Number(item.cupo || 0);
      return Number(item.activo ?? 1) === 1 && (!cupo || (item.alumnos?.length || 0) < cupo);
    }).length;
    const alumnosSinAcceso = alumnos.filter((item) => !item.usuario_id).length;

    return {
      totalGrupos: stats.totalGrupos || grupos.length,
      totalAlumnos: stats.totalAlumnos || alumnos.length,
      gruposConHuecos,
      alumnosSinAcceso,
    };
  }, [alumnos, grupos, stats.totalAlumnos, stats.totalGrupos]);

  const weeklySchedule = useMemo(() => {
    const base = Object.fromEntries(WEEK_DAYS.map((day) => [day.key, []]));

    grupos
      .filter((item) => Number(item.activo ?? 1) === 1)
      .forEach((group) => {
        getGroupDays(group).forEach((day) => {
          if (base[day]) base[day].push(group);
        });
      });

    Object.values(base).forEach((dayGroups) => {
      dayGroups.sort((a, b) => String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")));
    });

    return base;
  }, [grupos]);

  const selectedGroup = useMemo(
    () => filteredGrupos.find((item) => String(item.id) === String(selectedGroupId)) || filteredGrupos[0] || null,
    [filteredGrupos, selectedGroupId]
  );

  const controlGroup = useMemo(
    () => grupos.find((item) => String(item.id) === String(controlGroupId)) || grupos[0] || null,
    [controlGroupId, grupos]
  );

  const trackingGroup = useMemo(
    () => grupos.find((item) => String(item.id) === String(trackingGroupId)) || selectedGroup || grupos[0] || null,
    [grupos, selectedGroup, trackingGroupId]
  );

  const studentsAvailableForGroup = useMemo(() => {
    if (!selectedGroup) return [];
    const assigned = new Set((selectedGroup.alumnos || []).map((alumno) => String(alumno.id)));
    return (catalogos.alumnos || []).filter((alumno) => !assigned.has(String(alumno.id)));
  }, [catalogos.alumnos, selectedGroup]);

  const studentProfileGroup = useMemo(() => {
    if (!studentProfile) return null;
    const firstGroupId = String(studentProfile.grupo_ids || "").split(",").filter(Boolean)[0];
    if (!firstGroupId) return null;
    return grupos.find((item) => String(item.id) === String(firstGroupId)) || null;
  }, [grupos, studentProfile]);

  const hasFilters = search || nivel || profesor || grupo || groupQuickFilter !== "todos" || studentQuickFilter !== "todos";

  const clearFilters = () => {
    setSearch("");
    setNivel("");
    setProfesor("");
    setGrupo("");
    setGroupQuickFilter("todos");
    setStudentQuickFilter("todos");
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm);
    setGroupFormOpen(true);
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm(toGroupForm(group));
    setGroupFormOpen(true);
  };

  const saveGroup = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    try {
      setSaving(true);
      if (editingGroup) {
        await apiPut(`/api/gestion/grupos/${editingGroup.id}`, groupForm);
        showNotice("Grupo guardado.");
      } else {
        const data = await apiPost("/api/gestion/grupos", groupForm);
        setSelectedGroupId(data.id);
        showNotice("Grupo creado.");
      }

      setGroupFormOpen(false);
      await loadPanel();
    } catch (e) {
      setError(e.message || "No hemos podido guardar el grupo.");
    } finally {
      setSaving(false);
    }
  };

  const deactivateGroup = async (group) => {
    if (!isAdmin || !group) return;
    const confirmed = window.confirm(`¿Quieres desactivar el grupo "${group.nombre}"?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiDelete(`/api/gestion/grupos/${group.id}`);
      setSelectedGroupId(null);
      showNotice("Grupo desactivado.");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No hemos podido desactivar el grupo.");
    } finally {
      setSaving(false);
    }
  };

  const addStudentToGroup = async () => {
    if (!isAdmin || !selectedGroup || !studentToAdd) return;

    try {
      setSaving(true);
      await apiPost(`/api/gestion/grupos/${selectedGroup.id}/alumnos`, { alumno_id: studentToAdd });
      setStudentToAdd("");
      showNotice("Alumno anadido al grupo.");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No hemos podido añadir el alumno al grupo.");
    } finally {
      setSaving(false);
    }
  };

  const removeStudentFromGroup = async (alumno) => {
    if (!isAdmin || !selectedGroup || !alumno) return;
    const confirmed = window.confirm(`¿Quieres quitar a ${alumno.nombre} ${alumno.apellidos} de este grupo?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiDelete(`/api/gestion/grupos/${selectedGroup.id}/alumnos/${alumno.id}`);
      showNotice("Alumno quitado del grupo.");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No hemos podido quitar el alumno del grupo.");
    } finally {
      setSaving(false);
    }
  };

  const openEditStudent = (student) => {
    setCreatingStudent(false);
    setSelectedStudent(student);
    setStudentForm({
      nombre: student.nombre || "",
      apellidos: student.apellidos || "",
      nivel: student.nivel || "iniciacion",
      nivel_juego: student.nivel_juego ?? "",
      telefono: student.telefono || "",
      email: student.email || "",
      activo: Number(student.activo ?? 1),
    });
    setStudentFormOpen(true);
  };

  const openNewStudent = () => {
    setCreatingStudent(true);
    setSelectedStudent(null);
    setStudentForm({
      ...emptyStudentForm,
      grupo_id: selectedGroup?.id || "",
    });
    setStudentFormOpen(true);
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    try {
      setSaving(true);
      if (creatingStudent) {
        const data = await apiPost("/api/gestion/alumnos", studentForm);

        if (studentForm.grupo_id && data.id) {
          await apiPost(`/api/gestion/grupos/${studentForm.grupo_id}/alumnos`, { alumno_id: data.id });
        }

        showNotice(studentForm.grupo_id ? "Alumno creado y asignado al grupo." : "Alumno creado.");
      } else if (selectedStudent) {
        await apiPut(`/api/gestion/alumnos/${selectedStudent.id}`, studentForm);
        showNotice("Alumno guardado.");
      }

      setStudentFormOpen(false);
      await loadPanel();
    } catch (e) {
      setError(e.message || "No hemos podido guardar el alumno.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateAccess = (student) => {
    setAccessStudent(student);
    setAccessForm({
      email: student.email || "",
      password: "",
    });
    setAccessFormOpen(true);
  };

  const saveAccess = async (event) => {
    event.preventDefault();
    if (!isAdmin || !accessStudent) return;

    try {
      setSaving(true);
      await apiPost(`/api/gestion/alumnos/${accessStudent.id}/crear-acceso`, accessForm);
      setAccessFormOpen(false);
      showNotice("Acceso creado para el alumno.");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No hemos podido crear el acceso del alumno.");
    } finally {
      setSaving(false);
    }
  };

  if (!token || !canAccess({ rol: userRole })) {
    return null;
  }

  return (
    <section className="staffPanel">
      <header className="staffHero">
        <div className="staffHeroText">
          <span className="staffEyebrow">Panel de escuela</span>
          <h1>Gestión de la escuela</h1>
          <p>
            {scope === "admin"
              ? "Organiza grupos, alumnos, horarios y accesos desde un mismo sitio."
              : "Consulta tus grupos, alumnos y tareas de clase."}
          </p>
        </div>

        <div className="staffSummary">
          <div className="metricCard"><span>Grupos totales</span><strong>{loading ? "-" : panelMetrics.totalGrupos}</strong></div>
          <div className="metricCard"><span>Alumnos totales</span><strong>{loading ? "-" : panelMetrics.totalAlumnos}</strong></div>
          <div className="metricCard"><span>Grupos con huecos</span><strong>{loading ? "-" : panelMetrics.gruposConHuecos}</strong></div>
          <div className="metricCard"><span>Sin acceso</span><strong>{loading ? "-" : panelMetrics.alumnosSinAcceso}</strong></div>
        </div>
      </header>

      {notice && <div className="staffNotice">{notice}</div>}

      <nav className="staffSectionNav" aria-label="Secciones de gestión">
        {PANEL_SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            className={activeSection === section.key ? "active" : ""}
            onClick={() => setActiveSection(section.key)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === "gestion" && (
        <>
      <div className="staffToolbar">
        <div className="staffTabs" aria-label="Vistas del panel">
          <button className={activeView === "grupos" ? "active" : ""} onClick={() => setActiveView("grupos")}>Grupos</button>
          <button className={activeView === "alumnos" ? "active" : ""} onClick={() => setActiveView("alumnos")}>Alumnos</button>
        </div>

        <div className="staffSearch">
          <span aria-hidden="true"><IcSearch /></span>
          <input type="search" placeholder="Buscar alumno, grupo, profesor o pista" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isAdmin && (
          <div className="staffActions">
            <button className="staffSecondaryBtn" onClick={openNewStudent}>Crear alumno</button>
            <button className="staffPrimaryBtn" onClick={openNewGroup}>Crear grupo</button>
          </div>
        )}
      </div>

      <div className="staffFilters">
        <div className="quickFilters" aria-label={activeView === "grupos" ? "Filtros rápidos de grupos" : "Filtros rápidos de alumnos"}>
          {(activeView === "grupos" ? GROUP_QUICK_FILTERS : STUDENT_QUICK_FILTERS).map((item) => {
            const active = activeView === "grupos" ? groupQuickFilter === item.key : studentQuickFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={active ? "quickFilterChip active" : "quickFilterChip"}
                onClick={() => activeView === "grupos" ? setGroupQuickFilter(item.key) : setStudentQuickFilter(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Todos los niveles</option>
          {niveles.map((item) => <option key={item} value={item}>{nivelLabel(item)}</option>)}
        </select>

        <select value={profesor} onChange={(e) => setProfesor(e.target.value)}>
          <option value="">Todos los profesores</option>
          {profesores.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
        </select>

        <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Todos los grupos</option>
          {gruposOptions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>

        {hasFilters && <button onClick={clearFilters}>Limpiar filtros</button>}
      </div>

      {loading && <div className="staffSkeletonGrid">{[1, 2, 3].map((item) => <div className="staffSkeleton" key={item} />)}</div>}

      {!loading && error && (
        <div className="staffError">
          <strong>No hemos podido cargar el panel</strong>
          <p>{error}</p>
          <Link to="/login">Volver a iniciar sesión</Link>
        </div>
      )}

      {!loading && !error && activeView === "grupos" && (
        <div className="groupsWorkspace">
          <aside className="groupList" aria-label="Listado de grupos">
            <div className="panelSectionTitle"><h2>Grupos</h2><span>{filteredGrupos.length} resultados</span></div>

            {groupedFilteredGrupos.map((section) => (
              <div className="groupLevelSection" key={section.key}>
                <div className="groupLevelHeading">
                  <span>{section.label}</span>
                  <small>{section.items.length}</small>
                </div>
                {section.items.map((item) => (
                  <button key={item.id} className={String(selectedGroup?.id) === String(item.id) ? "groupListItem active" : "groupListItem"} data-level={item.nivel || "default"} onClick={() => setSelectedGroupId(item.id)}>
                    <span className="groupListTop">
                      <strong>{item.nombre}</strong>
                      <small>{item.alumnos?.length || 0}/{item.cupo || "-"}</small>
                    </span>
                    <span className="groupListMeta">
                      <span className={nivelClass(item.nivel)}>{nivelLabel(item.nivel)}</span>
                      <span>{formatDias(item.dia1, item.dia2)}</span>
                      <span>{formatHora(item.hora_inicio, item.duracion_min)}</span>
                      <span>{item.pista_habitual || "Sin pista"}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {filteredGrupos.length === 0 && <div className="staffEmpty">No hay grupos que coincidan con estos filtros.</div>}
          </aside>

          <main className="groupDetail">
            {selectedGroup ? (
              <>
                <div className="groupDetailHeader">
                  <div className="groupTitleBlock">
                    <span className={nivelClass(selectedGroup.nivel)}>{nivelLabel(selectedGroup.nivel)}</span>
                    <h2>{selectedGroup.nombre}</h2>
                    <p className="groupSubtitle">
                      <span>{selectedGroup.codigo || "Sin código"}</span>
                      <span>{selectedGroup.profesor || "Profesor sin asignar"}</span>
                    </p>
                  </div>
                  <div className="groupHeaderActions">
                    {isAdmin && (
                      <>
                        <button className="staffSecondaryBtn" onClick={() => openEditGroup(selectedGroup)}>Editar</button>
                        <button className="staffDangerBtn" onClick={() => deactivateGroup(selectedGroup)} disabled={saving}>Desactivar</button>
                      </>
                    )}
                    <div className="groupCapacity"><strong>{selectedGroup.alumnos?.length || 0}</strong><span>alumnos</span></div>
                  </div>
                </div>

                <div className="groupMetaGrid">
                  <div><span>Profesor</span><strong>{selectedGroup.profesor || "No disponible"}</strong></div>
                  <div><span>Días</span><strong>{formatDias(selectedGroup.dia1, selectedGroup.dia2)}</strong></div>
                  <div><span>Horario</span><strong>{formatHora(selectedGroup.hora_inicio, selectedGroup.duracion_min)}</strong></div>
                  <div><span>Pista</span><strong>{selectedGroup.pista_habitual || "-"}</strong></div>
                  <div><span>Cupo</span><strong>{selectedGroup.cupo || "-"}</strong></div>
                  <div><span>Estado</span><strong>{Number(selectedGroup.activo ?? 1) === 1 ? "Activo" : "Inactivo"}</strong></div>
                </div>

                {isAdmin && (
                  <div className="addStudentBar">
                    <select value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)}>
                      <option value="">Añadir alumno existente</option>
                      {studentsAvailableForGroup.map((alumno) => (
                        <option key={alumno.id} value={alumno.id}>{alumno.nombre} {alumno.apellidos} - {nivelLabel(alumno.nivel)}</option>
                      ))}
                    </select>
                    <button onClick={addStudentToGroup} disabled={!studentToAdd || saving}>Añadir alumno</button>
                  </div>
                )}

                <div className="groupStudentsHeader">
                  <h3>Alumnos asignados</h3>
                  <span>{selectedGroup.alumnos?.length || 0} en este grupo</span>
                </div>

                <div className="studentsGrid">
                  {(selectedGroup.alumnos || []).map((alumno) => (
                    <article className="studentMiniCard" data-level={alumno.nivel || selectedGroup.nivel || "default"} key={alumno.id}>
                      <div className="studentMark">{initials(alumno.nombre, alumno.apellidos)}</div>
                      <div>
                        <h3>{alumno.nombre} {alumno.apellidos}</h3>
                        <p>{nivelLabel(alumno.nivel || selectedGroup.nivel)}</p>
                        {(alumno.telefono || alumno.email) && <small>{alumno.telefono || alumno.email}</small>}
                      </div>
                      {isAdmin && <button className="miniDangerBtn" onClick={() => removeStudentFromGroup(alumno)}>Quitar</button>}
                    </article>
                  ))}
                </div>

                {(!selectedGroup.alumnos || selectedGroup.alumnos.length === 0) && <div className="staffEmpty">Este grupo todavía no tiene alumnos asignados.</div>}
              </>
            ) : (
              <div className="staffEmpty">Selecciona un grupo para ver su detalle.</div>
            )}
          </main>
        </div>
      )}

      {!loading && !error && activeView === "alumnos" && (
        <div className="studentsPanel">
          <div className="panelSectionTitle"><h2>Alumnos</h2><span>{filteredAlumnos.length} resultados</span></div>

          <div className="studentsTable">
            <div className={isAdmin ? "studentsTableHead studentsTableHeadAdmin" : "studentsTableHead"}>
              <span>Alumno</span><span>Nivel</span><span>Juego</span><span>Acceso</span><span>Grupo</span><span>Profesor</span><span>Horario / pista</span><span>Acciones</span>
            </div>

            {filteredAlumnos.map((alumno) => (
              <article className={isAdmin ? "studentRow studentRowAdmin" : "studentRow"} key={alumno.id}>
                <div className="studentIdentity">
                  <div className="studentMark" data-level={alumno.nivel || "default"}>{initials(alumno.nombre, alumno.apellidos)}</div>
                  <div><strong>{alumno.nombre} {alumno.apellidos}</strong><small>{alumno.telefono || alumno.email || "Sin contacto"}</small></div>
                </div>
                <span className={nivelClass(alumno.nivel)}>{nivelLabel(alumno.nivel)}</span>
                <span className="studentCell">{gameLevelLabel(alumno.nivel_juego)}</span>
                <span className={alumno.usuario_id ? "accessBadge accessOn" : "accessBadge accessOff"}>{alumno.usuario_id ? "Con acceso" : "Sin acceso"}</span>
                <span className="studentCell">{alumno.grupos || "-"}</span>
                <span className="studentCell">{alumno.profesores || "-"}</span>
                <span className="studentCell">{alumno.horarios || "-"}{alumno.pistas ? ` - Pista ${alumno.pistas}` : ""}</span>
                <div className="rowActions">
                  <button className="staffSecondaryBtn" onClick={() => setStudentProfile(alumno)}>Ver ficha</button>
                  {isAdmin && (
                    <>
                      {!alumno.usuario_id && <button className="staffPrimaryBtn" onClick={() => openCreateAccess(alumno)}>Crear acceso</button>}
                      <button className="staffSecondaryBtn" onClick={() => openEditStudent(alumno)}>Editar</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          {filteredAlumnos.length === 0 && <div className="staffEmpty">No hay alumnos que coincidan con estos filtros.</div>}
        </div>
      )}
        </>
      )}

      {!loading && !error && activeSection === "horario" && (
        <section className="schoolOpsPanel">
          <div className="opsPanelHeader">
            <div>
              <span className="staffEyebrow">Agenda semanal</span>
              <h2>Horario semanal</h2>
              <p>Organiza la semana con los grupos activos de la escuela.</p>
            </div>
            <span className="opsCounter">{grupos.filter((item) => Number(item.activo ?? 1) === 1).length} grupos activos</span>
          </div>

          <div className="weeklyGrid">
            {WEEK_DAYS.map((day) => (
              <article className="weekDayColumn" key={day.key}>
                <div className="weekDayHeader">
                  <strong>{day.label}</strong>
                  <span>{weeklySchedule[day.key]?.length || 0}</span>
                </div>

                <div className="dayClassStack">
                  {(weeklySchedule[day.key] || []).map((group) => (
                    <button
                      type="button"
                      className="scheduleClassCard"
                      data-level={group.nivel || "default"}
                      key={`${day.key}-${group.id}`}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setControlGroupId(group.id);
                        setActiveSection("control");
                      }}
                    >
                      <span className="scheduleTime">{String(group.hora_inicio || "").slice(0, 5) || "-"}</span>
                      <strong>{group.nombre}</strong>
                      <span className={nivelClass(group.nivel)}>{nivelLabel(group.nivel)}</span>
                      <small>{group.profesor || "Profesor sin asignar"}</small>
                      <small>{group.pista_habitual || "Sin pista"} · {group.alumnos?.length || 0}/{group.cupo || "-"}</small>
                    </button>
                  ))}

                  {(!weeklySchedule[day.key] || weeklySchedule[day.key].length === 0) && (
                    <div className="emptyDay">Sin clases</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && activeSection === "control" && (
        <section className="schoolOpsPanel">
          <div className="opsPanelHeader">
            <div>
              <span className="staffEyebrow">Sesión diaria</span>
              <h2>Control de clases</h2>
              <p>Pasa lista y revisa el estado de la clase desde una vista clara.</p>
            </div>
            <span className="opsCounter">{controlGroup?.alumnos?.length || 0} alumnos</span>
          </div>

          <div className="controlLayout">
            <aside className="sessionPanel">
              <label>
                Grupo
                <select value={controlGroup?.id || ""} onChange={(e) => setControlGroupId(e.target.value)}>
                  {gruposOptions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
              <label>
                Fecha
                <input type="date" value={controlDate} onChange={(e) => setControlDate(e.target.value)} />
              </label>

              {controlGroup && (
                <div className="sessionSummary">
                  <span className={nivelClass(controlGroup.nivel)}>{nivelLabel(controlGroup.nivel)}</span>
                  <h3>{controlGroup.nombre}</h3>
                  <p>{formatDias(controlGroup.dia1, controlGroup.dia2)} · {formatHora(controlGroup.hora_inicio, controlGroup.duracion_min)}</p>
                  <p>{controlGroup.profesor || "Profesor sin asignar"} · {controlGroup.pista_habitual || "Sin pista"}</p>
                </div>
              )}

              <div className="statusChips" aria-label="Estado de clase">
                {CLASS_STATUS.map((status) => (
                  <button
                    key={status.key}
                    type="button"
                    data-tone={status.tone}
                    className={classStatus === status.key ? "statusChip active" : "statusChip"}
                    onClick={() => setClassStatus(status.key)}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </aside>

            <main className="attendancePanel">
              <div className="panelSectionTitle">
                <h2>Asistencia</h2>
                <span>Pendiente de guardar</span>
              </div>

              <div className="attendanceList">
                {(controlGroup?.alumnos || []).map((alumno) => {
                  const current = attendanceDraft[alumno.id] || "presente";
                  return (
                    <article className="attendanceRow" key={alumno.id}>
                      <div className="studentIdentity">
                        <div className="studentMark" data-level={alumno.nivel || controlGroup.nivel || "default"}>{initials(alumno.nombre, alumno.apellidos)}</div>
                        <div><strong>{alumno.nombre} {alumno.apellidos}</strong><small>{nivelLabel(alumno.nivel || controlGroup.nivel)}</small></div>
                      </div>
                      <div className="attendanceActions">
                        {ATTENDANCE_STATUS.map((status) => (
                          <button
                            key={status.key}
                            type="button"
                            data-tone={status.tone}
                            className={current === status.key ? "statusChip active" : "statusChip"}
                            onClick={() => setAttendanceDraft((draft) => ({ ...draft, [alumno.id]: status.key }))}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>

              {(!controlGroup?.alumnos || controlGroup.alumnos.length === 0) && <div className="staffEmpty">Este grupo todavía no tiene alumnos para pasar lista.</div>}
              <div className="preparedNotice">La asistencia se podrá guardar cuando actives el registro de sesiones.</div>
            </main>
          </div>
        </section>
      )}

      {!loading && !error && activeSection === "recuperaciones" && (
        <section className="schoolOpsPanel">
          <div className="opsPanelHeader">
            <div>
              <span className="staffEyebrow">Clases pendientes</span>
              <h2>Recuperaciones</h2>
              <p>Revisa clases canceladas, faltas justificadas y sesiones pendientes.</p>
            </div>
          </div>

          <div className="recoveryGrid">
            <article className="recoveryCard">
              <span className="statusDot warning" />
              <div>
                <strong>Sin recuperaciones registradas</strong>
                <p>Cuando registres una clase pendiente, aparecerá aquí con alumno, fecha, motivo y estado.</p>
              </div>
              <button className="staffSecondaryBtn" type="button" disabled>Marcar como recuperada</button>
            </article>
            <article className="recoveryPlan">
              <h3>Datos de cada recuperación</h3>
              <div className="trackingTags">
                <span>Alumno o grupo</span>
                <span>Fecha perdida</span>
                <span>Motivo</span>
                <span>Estado</span>
                <span>Recuperada</span>
              </div>
            </article>
          </div>
        </section>
      )}

      {!loading && !error && activeSection === "seguimiento" && (
        <section className="schoolOpsPanel">
          <div className="opsPanelHeader">
            <div>
              <span className="staffEyebrow">Notas internas</span>
              <h2>Seguimiento</h2>
              <p>Anota objetivos, observaciones y evolucion por grupo.</p>
            </div>
            <select className="opsSelect" value={trackingGroup?.id || ""} onChange={(e) => setTrackingGroupId(e.target.value)}>
              {gruposOptions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>

          <div className="trackingGrid">
            <article className="trackingCard trackingCardWide">
              <span className={nivelClass(trackingGroup?.nivel)}>{nivelLabel(trackingGroup?.nivel)}</span>
              <h3>{trackingGroup?.nombre || "Selecciona un grupo"}</h3>
              <p>{trackingGroup ? `${trackingGroup.profesor || "Profesor sin asignar"} · ${formatDias(trackingGroup.dia1, trackingGroup.dia2)} · ${formatHora(trackingGroup.hora_inicio, trackingGroup.duracion_min)}` : "No hay datos de grupo."}</p>
            </article>
            <article className="trackingCard">
              <h3>Observaciones del grupo</h3>
              <p>Espacio para notas internas del profesor o la administracion.</p>
            </article>
            <article className="trackingCard">
              <h3>Objetivos trabajados</h3>
              <div className="trackingTags">
                <span>Tecnica</span>
                <span>Posicionamiento</span>
                <span>Partido</span>
              </div>
            </article>
            <article className="trackingCard">
              <h3>Alumnos</h3>
              <div className="trackingStudents">
                {(trackingGroup?.alumnos || []).slice(0, 6).map((alumno) => (
                  <span key={alumno.id}>{alumno.nombre} {alumno.apellidos}</span>
                ))}
                {(!trackingGroup?.alumnos || trackingGroup.alumnos.length === 0) && <span>Este grupo todavía no tiene alumnos.</span>}
              </div>
            </article>
          </div>
        </section>
      )}

      {studentProfile && (
        <div className="staffModalBackdrop">
          <aside className="studentProfileDrawer" aria-label="Ficha completa del alumno">
            <div className="modalHeader">
              <h2>Ficha de alumno</h2>
              <button type="button" onClick={() => setStudentProfile(null)} aria-label="Cerrar ficha">Cerrar</button>
            </div>

            <div className="studentProfileHero">
              <div className="studentMark" data-level={studentProfile.nivel || "default"}>
                {initials(studentProfile.nombre, studentProfile.apellidos)}
              </div>
              <div>
                <span className={nivelClass(studentProfile.nivel)}>{nivelLabel(studentProfile.nivel)}</span>
                <h3>{studentProfile.nombre} {studentProfile.apellidos}</h3>
                <p>{Number(studentProfile.activo ?? 1) === 1 ? "Alumno activo" : "Alumno inactivo"}</p>
              </div>
            </div>

            <div className="profileInfoGrid">
              <div><span>Teléfono</span><strong>{studentProfile.telefono || "No disponible"}</strong></div>
              <div><span>Email</span><strong>{studentProfile.email || "No disponible"}</strong></div>
              <div><span>Nivel de juego</span><strong>{gameLevelLabel(studentProfile.nivel_juego)}</strong></div>
              <div><span>Acceso plataforma</span><strong>{studentProfile.usuario_id ? "Con acceso" : "Sin acceso"}</strong></div>
              <div><span>Grupo</span><strong>{studentProfile.grupos || "No disponible"}</strong></div>
              <div><span>Profesor</span><strong>{studentProfile.profesores || studentProfileGroup?.profesor || "No disponible"}</strong></div>
              <div><span>Días</span><strong>{studentProfileGroup ? formatDias(studentProfileGroup.dia1, studentProfileGroup.dia2) : "No disponible"}</strong></div>
              <div><span>Horario</span><strong>{studentProfile.horarios || (studentProfileGroup ? formatHora(studentProfileGroup.hora_inicio, studentProfileGroup.duracion_min) : "No disponible")}</strong></div>
              <div><span>Pista</span><strong>{studentProfile.pistas || studentProfileGroup?.pista_habitual || "No disponible"}</strong></div>
            </div>

            <div className="profileNotes">
              <span>Observaciones</span>
              <p>{studentProfile.observaciones || "No disponible"}</p>
            </div>

            <div className="profileActions">
              {studentProfileGroup && (
                <button
                  type="button"
                  className="staffSecondaryBtn"
                  onClick={() => {
                    setSelectedGroupId(studentProfileGroup.id);
                    setActiveSection("gestion");
                    setActiveView("grupos");
                    setStudentProfile(null);
                  }}
                >
                  Ver grupo
                </button>
              )}
              {isAdmin && (
                <>
                  {!studentProfile.usuario_id && <button type="button" className="staffPrimaryBtn" onClick={() => { setStudentProfile(null); openCreateAccess(studentProfile); }}>Crear acceso</button>}
                  <button type="button" className="staffSecondaryBtn" onClick={() => { setStudentProfile(null); openEditStudent(studentProfile); }}>Editar / desactivar</button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {isAdmin && groupFormOpen && (
        <div className="staffModalBackdrop">
          <form className="staffModal" onSubmit={saveGroup}>
            <div className="modalHeader"><h2>{editingGroup ? "Editar grupo" : "Crear grupo"}</h2><button type="button" onClick={() => setGroupFormOpen(false)}>Cerrar</button></div>
            <div className="formGrid">
              <label>Nombre<input value={groupForm.nombre} onChange={(e) => setGroupForm({ ...groupForm, nombre: e.target.value })} required /></label>
              <label>Código<input value={groupForm.codigo} onChange={(e) => setGroupForm({ ...groupForm, codigo: e.target.value })} /></label>
              <label>Nivel<select value={groupForm.nivel} onChange={(e) => setGroupForm({ ...groupForm, nivel: e.target.value })}>{NIVELES.map((item) => <option key={item} value={item}>{nivelLabel(item)}</option>)}</select></label>
              <label>Profesor<select value={groupForm.profesor_id} onChange={(e) => setGroupForm({ ...groupForm, profesor_id: e.target.value })}><option value="">Sin profesor</option>{profesores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Día 1<select value={groupForm.dia1} onChange={(e) => setGroupForm({ ...groupForm, dia1: e.target.value })}>{DIAS.map((dia) => <option key={dia} value={dia}>{formatDias(dia)}</option>)}</select></label>
              <label>Día 2<select value={groupForm.dia2} onChange={(e) => setGroupForm({ ...groupForm, dia2: e.target.value })}><option value="">Sin segundo día</option>{DIAS.map((dia) => <option key={dia} value={dia}>{formatDias(dia)}</option>)}</select></label>
              <label>Hora<input type="time" value={groupForm.hora_inicio} onChange={(e) => setGroupForm({ ...groupForm, hora_inicio: e.target.value })} /></label>
              <label>Duración<input type="number" min="30" step="15" value={groupForm.duracion_min} onChange={(e) => setGroupForm({ ...groupForm, duracion_min: Number(e.target.value) })} /></label>
              <label>Pista<input list="pistas-list" value={groupForm.pista_habitual} onChange={(e) => setGroupForm({ ...groupForm, pista_habitual: e.target.value })} /></label>
              <label>Cupo<input type="number" min="1" value={groupForm.cupo} onChange={(e) => setGroupForm({ ...groupForm, cupo: Number(e.target.value) })} /></label>
              <label>Activo<select value={groupForm.activo} onChange={(e) => setGroupForm({ ...groupForm, activo: Number(e.target.value) })}><option value={1}>Activo</option><option value={0}>Inactivo</option></select></label>
            </div>
            <datalist id="pistas-list">{(catalogos.pistas || []).map((pista) => <option key={pista.id} value={pista.nombre} />)}</datalist>
            <div className="modalActions"><button type="button" onClick={() => setGroupFormOpen(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></div>
          </form>
        </div>
      )}

      {isAdmin && studentFormOpen && (
        <div className="staffModalBackdrop">
          <form className="staffModal" onSubmit={saveStudent}>
            <div className="modalHeader"><h2>{creatingStudent ? "Crear alumno" : "Editar alumno"}</h2><button type="button" onClick={() => setStudentFormOpen(false)}>Cerrar</button></div>
            <div className="formGrid">
              <label>Nombre<input value={studentForm.nombre || ""} onChange={(e) => setStudentForm({ ...studentForm, nombre: e.target.value })} required /></label>
              <label>Apellidos<input value={studentForm.apellidos || ""} onChange={(e) => setStudentForm({ ...studentForm, apellidos: e.target.value })} /></label>
              <label>Nivel<select value={studentForm.nivel || ""} onChange={(e) => setStudentForm({ ...studentForm, nivel: e.target.value })}>{NIVELES.map((item) => <option key={item} value={item}>{nivelLabel(item)}</option>)}</select></label>
              <label>Nivel de juego<select value={studentForm.nivel_juego ?? ""} onChange={(e) => setStudentForm({ ...studentForm, nivel_juego: e.target.value === "" ? null : Number(e.target.value) })}>{GAME_LEVELS.map((item) => <option key={String(item.value)} value={item.value}>{item.label}</option>)}</select></label>
              <label>Teléfono<input value={studentForm.telefono || ""} onChange={(e) => setStudentForm({ ...studentForm, telefono: e.target.value })} /></label>
              <label>Email<input type="email" value={studentForm.email || ""} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} /></label>
              <label>Activo<select value={studentForm.activo ?? 1} onChange={(e) => setStudentForm({ ...studentForm, activo: Number(e.target.value) })}><option value={1}>Activo</option><option value={0}>Inactivo</option></select></label>
              {creatingStudent && (
                <label>Asignar a grupo<select value={studentForm.grupo_id || ""} onChange={(e) => setStudentForm({ ...studentForm, grupo_id: e.target.value })}><option value="">Sin grupo por ahora</option>{gruposOptions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
              )}
              <label className="formFieldWide">Observaciones<input value={studentForm.observaciones || ""} onChange={(e) => setStudentForm({ ...studentForm, observaciones: e.target.value })} placeholder="Notas internas opcionales" /></label>
            </div>
            <div className="modalActions"><button type="button" onClick={() => setStudentFormOpen(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Guardando..." : creatingStudent ? "Crear alumno" : "Guardar alumno"}</button></div>
          </form>
        </div>
      )}

      {isAdmin && accessFormOpen && (
        <div className="staffModalBackdrop">
          <form className="staffModal" onSubmit={saveAccess}>
            <div className="modalHeader"><h2>Crear acceso</h2><button type="button" onClick={() => setAccessFormOpen(false)}>Cerrar</button></div>
            <div className="accessIntro">
              <strong>{accessStudent?.nombre} {accessStudent?.apellidos}</strong>
              <span>Se creara una cuenta para que este alumno pueda entrar a la plataforma.</span>
            </div>
            <div className="formGrid">
              <label>Email<input type="email" value={accessForm.email || ""} onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })} required /></label>
              <label>Contrasena inicial<input type="password" value={accessForm.password || ""} onChange={(e) => setAccessForm({ ...accessForm, password: e.target.value })} minLength={6} required /></label>
            </div>
            <div className="modalActions"><button type="button" onClick={() => setAccessFormOpen(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Creando..." : "Crear acceso"}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
