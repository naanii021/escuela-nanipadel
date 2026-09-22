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
const PRIMARY_COURTS = ["Pista 1", "Pista 2"];
const ATTENDANCE_STATUS = [
  { key: "presente", label: "Presente", tone: "positive" },
  { key: "falta", label: "Falta", tone: "negative" },
  { key: "justificada", label: "Falta justificada", tone: "warning" },
];
const CLASS_STATUS = [
  { key: "programada", label: "Programada", tone: "neutral" },
  { key: "dada", label: "Clase dada", tone: "positive" },
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
  matricula_activa: 1,
  grupo_id: "",
  asiste_dia1: 1,
  asiste_dia2: 0,
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

const todayCode = () => ["D", "L", "M", "X", "J", "V", "S"][new Date().getDay()];
const todayDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

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

function getCourtName(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();

  if (normalized === "1" || /pista\s*(n(?:o|umero)?\s*)?1\b/.test(normalized)) return "Pista 1";
  if (normalized === "2" || /pista\s*(n(?:o|umero)?\s*)?2\b/.test(normalized)) return "Pista 2";
  return raw || "Sin pista asignada";
}

function descriptorLabel(value, fallback = "-") {
  const text = String(value || "").trim().replaceAll("_", " ").replaceAll("-", " ");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : fallback;
}

function attendanceFlag(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : Number(value) === 1;
}

function getStudentsForDay(group, day) {
  return (group?.alumnos || []).filter((student) =>
    (group.dia1 === day && attendanceFlag(student.asiste_dia1, true)) ||
    (group.dia2 === day && attendanceFlag(student.asiste_dia2, true))
  );
}

function getStudentDays(group, student) {
  return formatDias(
    attendanceFlag(student?.asiste_dia1, true) ? group?.dia1 : null,
    attendanceFlag(student?.asiste_dia2, true) ? group?.dia2 : null
  );
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
  const [curso, setCurso] = useState(null);
  const [sede, setSede] = useState(null);
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
  const [controlDate, setControlDate] = useState(todayDate);
  const [classStatus, setClassStatus] = useState("programada");
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [controlSession, setControlSession] = useState(null);
  const [controlStudents, setControlStudents] = useState([]);
  const [controlProfessorId, setControlProfessorId] = useState("");
  const [controlObservations, setControlObservations] = useState("");
  const [controlLoading, setControlLoading] = useState(false);
  const [controlSaving, setControlSaving] = useState(false);
  const [controlError, setControlError] = useState("");
  const [trackingGroupId, setTrackingGroupId] = useState("");

  const loadPanel = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/api/gestion/resumen");

      setAlumnos(data.alumnos || []);
      setGrupos(data.grupos || []);
      setCurso(data.curso || null);
      setSede(data.sede || null);
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
        (studentQuickFilter === "activos" && Number(alumno.matricula_activa ?? 1) === 1) ||
        (studentQuickFilter === "inactivos" && Number(alumno.matricula_activa ?? 1) === 0) ||
        (studentQuickFilter.startsWith("nivel:") && alumno.nivel === studentQuickFilter.replace("nivel:", ""));

      return matchText && matchNivel && matchProfesor && matchGrupo && matchQuick;
    });
  }, [alumnos, search, nivel, profesor, grupo, studentQuickFilter]);

  const filteredGrupos = useMemo(() => {
    const text = normalize(search);

    return grupos.filter((item) => {
      const alumnosText = (item.alumnos || []).map((alumno) => `${alumno.nombre} ${alumno.apellidos}`).join(" ");
      const matchText = !text || normalize(`${item.nombre} ${item.codigo} ${item.profesor} ${item.pista_habitual} ${item.deporte} ${item.categoria} ${alumnosText}`).includes(text);
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

  const todayClasses = useMemo(() => {
    const code = todayCode();
    return grupos.filter((item) => Number(item.activo ?? 1) === 1 && getGroupDays(item).includes(code));
  }, [grupos]);

  const pendingItems = useMemo(() => {
    const items = [];
    if (panelMetrics.alumnosSinAcceso > 0) {
      items.push({
        key: "access",
        title: "Alumnos sin acceso",
        text: `${panelMetrics.alumnosSinAcceso} alumno${panelMetrics.alumnosSinAcceso === 1 ? "" : "s"} pendiente${panelMetrics.alumnosSinAcceso === 1 ? "" : "s"} de acceso.`,
        action: () => {
          setActiveSection("gestion");
          setActiveView("alumnos");
          setStudentQuickFilter("sin-acceso");
        },
      });
    }

    if (panelMetrics.gruposConHuecos > 0) {
      items.push({
        key: "slots",
        title: "Grupos con huecos",
        text: `${panelMetrics.gruposConHuecos} grupo${panelMetrics.gruposConHuecos === 1 ? "" : "s"} con plazas para revisar.`,
        action: () => {
          setActiveSection("gestion");
          setActiveView("grupos");
          setGroupQuickFilter("con-huecos");
        },
      });
    }

    return items;
  }, [panelMetrics.alumnosSinAcceso, panelMetrics.gruposConHuecos]);

  const adminQuickActions = useMemo(() => {
    const sharedActions = [
      { key: "groups", label: isAdmin ? "Gestionar grupos" : "Mis grupos", text: "Horarios, cupos y niveles", onClick: () => { setActiveSection("gestion"); setActiveView("grupos"); } },
      { key: "students", label: isAdmin ? "Gestionar alumnos" : "Ver alumnos", text: "Fichas y grupos asignados", onClick: () => { setActiveSection("gestion"); setActiveView("alumnos"); } },
      { key: "reservas", label: "Ver reservas", text: "Agenda de pistas", to: "/reservas" },
      { key: "weather", label: "Ver estado pista", text: "Sensor y tiempo", to: "/estado-pista" },
    ];

    if (!isAdmin) {
      return [
        ...sharedActions,
        { key: "control", label: "Control de clases", text: "Pasar lista y revisar sesión", onClick: () => setActiveSection("control") },
        { key: "schedule", label: "Horario semanal", text: "Agenda de grupos", onClick: () => setActiveSection("horario") },
      ];
    }

    return [
      ...sharedActions,
      { key: "notice", label: "Crear aviso", text: "Comunicación del club", to: "/avisos" },
      { key: "tournament", label: "Crear torneo", text: "Formatos y jornadas", to: "/torneos" },
      { key: "whatsapp", label: "Mensajes WhatsApp", text: "Conversaciones y respuestas", to: "/panel/whatsapp" },
    ];
  }, [isAdmin]);

  const adminModules = useMemo(() => [
    { key: "alumnos", title: "Alumnos", text: "Consulta y organiza los alumnos de la escuela.", value: panelMetrics.totalAlumnos, label: "alumnos", onClick: () => { setActiveSection("gestion"); setActiveView("alumnos"); } },
    { key: "grupos", title: "Grupos", text: "Revisa niveles, horarios, profesores y ocupación.", value: panelMetrics.totalGrupos, label: "grupos", onClick: () => { setActiveSection("gestion"); setActiveView("grupos"); } },
    { key: "reservas", title: "Reservas", text: "Abre la agenda de pistas y partidas del club.", value: "Ver", label: "agenda", to: "/reservas" },
    { key: "torneos", title: "Torneos", text: "Gestiona torneos, americanos y nuevos formatos.", value: "Ver", label: "torneos", to: "/torneos" },
    { key: "avisos", title: "Avisos", text: "Crea comunicaciones para alumnos o profesores.", value: "Crear", label: "aviso", to: "/avisos" },
    ...(isAdmin ? [{ key: "whatsapp", title: "WhatsApp", text: "Gestiona mensajes entrantes del club.", value: "Abrir", label: "mensajes", to: "/panel/whatsapp" }] : []),
    { key: "tienda", title: "Tienda", text: "Consulta productos y servicios publicados.", value: "Ver", label: "tienda", to: "/tienda" },
  ], [isAdmin, panelMetrics.totalAlumnos, panelMetrics.totalGrupos]);

  const weeklySchedule = useMemo(() => {
    const createWeek = () => Object.fromEntries(WEEK_DAYS.map((day) => [day.key, []]));
    const courts = new Map(PRIMARY_COURTS.map((court) => [court, createWeek()]));

    grupos
      .filter((item) => Number(item.activo ?? 1) === 1)
      .forEach((group) => {
        const courtName = getCourtName(group.pista_habitual);
        if (!courts.has(courtName)) courts.set(courtName, createWeek());

        getGroupDays(group).forEach((day) => {
          const courtWeek = courts.get(courtName);
          if (courtWeek[day]) {
            courtWeek[day].push({
              group,
              students: getStudentsForDay(group, day),
            });
          }
        });
      });

    courts.forEach((courtWeek) => {
      Object.values(courtWeek).forEach((dayGroups) => {
        dayGroups.sort((a, b) => String(a.group.hora_inicio || "").localeCompare(String(b.group.hora_inicio || "")));
      });
    });

    return Array.from(courts, ([name, days]) => ({ name, days }))
      .filter(({ name, days }) => PRIMARY_COURTS.includes(name) || Object.values(days).some((items) => items.length));
  }, [grupos]);

  const selectedGroup = useMemo(
    () => filteredGrupos.find((item) => String(item.id) === String(selectedGroupId)) || filteredGrupos[0] || null,
    [filteredGrupos, selectedGroupId]
  );

  const controlGroup = useMemo(
    () => grupos.find((item) => String(item.id) === String(controlGroupId) && Number(item.activo ?? 1) === 1)
      || grupos.find((item) => Number(item.activo ?? 1) === 1) || null,
    [controlGroupId, grupos]
  );

  const controlDay = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(controlDate)) return null;
    return ["D", "L", "M", "X", "J", "V", "S"][new Date(`${controlDate}T00:00:00Z`).getUTCDay()];
  }, [controlDate]);
  const controlHasClass = Boolean(controlGroup && controlDay && getGroupDays(controlGroup).includes(controlDay));

  useEffect(() => {
    if (activeSection !== "control") return;
    if (!controlGroup?.id || !controlDate) {
      setControlSession(null);
      setControlStudents([]);
      setAttendanceDraft({});
      return;
    }
    let cancelled = false;
    setControlLoading(true);
    setControlError("");
    setControlSession(null);
    setControlStudents([]);
    setAttendanceDraft({});
    apiGet(`/api/gestion/control/grupos/${controlGroup.id}/sesiones?fecha=${encodeURIComponent(controlDate)}`)
      .then((data) => {
        if (cancelled) return;
        const session = data.sesiones?.[0] || null;
        setControlSession(session);
        setControlStudents(data.alumnos || []);
        setAttendanceDraft(Object.fromEntries((data.asistencias || []).map((item) => [item.alumno_id, item.estado])));
        setClassStatus(session?.estado || "programada");
        setControlProfessorId(session?.profesor_id ?? controlGroup.profesor_id ?? "");
        setControlObservations(session?.observaciones || "");
      })
      .catch((e) => { if (!cancelled) setControlError(e.message || "No se pudo cargar la sesión."); })
      .finally(() => { if (!cancelled) setControlLoading(false); });
    return () => { cancelled = true; };
  }, [activeSection, controlGroup, controlDate]);

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

  const studentProfileMembership = useMemo(
    () => studentProfileGroup?.alumnos?.find((item) => String(item.id) === String(studentProfile?.id)) || null,
    [studentProfile, studentProfileGroup]
  );

  const studentFormGroup = useMemo(
    () => grupos.find((item) => String(item.id) === String(studentForm.grupo_id)) || null,
    [grupos, studentForm.grupo_id]
  );

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

  const saveControlSession = async () => {
    if (!controlGroup || !controlHasClass || controlLoading || controlSaving) return;
    const body = {
      fecha: controlDate,
      profesor_id: controlProfessorId || null,
      estado: classStatus,
      observaciones: controlObservations,
      asistencias: controlStudents.map((alumno) => ({
        alumno_id: alumno.id,
        estado: attendanceDraft[alumno.id] || "presente",
      })),
    };
    try {
      setControlSaving(true);
      setControlError("");
      const path = `/api/gestion/control/grupos/${controlGroup.id}/sesiones`;
      const data = controlSession
        ? await apiPut(`${path}/${controlSession.id}/asistencia`, body)
        : await apiPost(path, body);
      setControlSession(data.sesion);
      setControlStudents(data.alumnos || []);
      setAttendanceDraft(Object.fromEntries((data.asistencias || []).map((item) => [item.alumno_id, item.estado])));
      showNotice("Sesión y asistencia guardadas.");
    } catch (e) {
      setControlError(e.message || "No se pudo guardar la asistencia.");
    } finally {
      setControlSaving(false);
    }
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
      showNotice("Alumno añadido al grupo.");
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
    const groupId = String(student.grupo_ids || "").split(",").filter(Boolean)[0] || "";
    const assignedGroup = grupos.find((item) => String(item.id) === String(groupId));
    const groupStudent = assignedGroup?.alumnos?.find((item) => String(item.id) === String(student.id));

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
      observaciones: student.observaciones || "",
      matricula_activa: Number(student.matricula_activa ?? 1),
      grupo_id: groupId,
      asiste_dia1: Number(groupStudent?.asiste_dia1 ?? (assignedGroup?.dia1 ? 1 : 0)),
      asiste_dia2: Number(groupStudent?.asiste_dia2 ?? (assignedGroup?.dia2 ? 1 : 0)),
    });
    setStudentFormOpen(true);
  };

  const openNewStudent = () => {
    const initialGroup = activeView === "grupos" ? selectedGroup : null;
    setCreatingStudent(true);
    setSelectedStudent(null);
    setStudentForm({
      ...emptyStudentForm,
      grupo_id: initialGroup?.id || "",
      asiste_dia1: initialGroup?.dia1 ? 1 : 0,
      asiste_dia2: initialGroup?.dia2 ? 1 : 0,
    });
    setStudentFormOpen(true);
  };

  const updateStudentEnrollment = (active) => {
    setStudentForm((current) => ({
      ...current,
      matricula_activa: active,
      ...(active ? {} : { grupo_id: "", asiste_dia1: 0, asiste_dia2: 0 }),
    }));
  };

  const updateStudentGroup = (groupId) => {
    const targetGroup = grupos.find((item) => String(item.id) === String(groupId));
    setStudentForm((current) => ({
      ...current,
      grupo_id: groupId,
      asiste_dia1: targetGroup?.dia1 ? 1 : 0,
      asiste_dia2: targetGroup?.dia2 ? 1 : 0,
    }));
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    if (studentForm.grupo_id && !Number(studentForm.asiste_dia1) && !Number(studentForm.asiste_dia2)) {
      setError("Selecciona al menos un día de asistencia para el grupo.");
      return;
    }

    try {
      setSaving(true);
      if (creatingStudent) {
        await apiPost("/api/gestion/alumnos", studentForm);
        showNotice(studentForm.grupo_id ? "Alumno creado y asignado al grupo." : "Alumno creado.");
      } else if (selectedStudent) {
        await apiPut(`/api/gestion/alumnos/${selectedStudent.id}`, studentForm);
        showNotice("Alumno, matrícula y grupo guardados.");
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
          <h1>{isAdmin ? "Panel de administración" : "Panel de profesor"}</h1>
          <div className="schoolContextBadge" aria-label="Curso y sede activos">
            <strong>Curso {curso?.nombre || "2026/27"}</strong>
            <span>·</span>
            <strong>{sede?.nombre || "Seminario Diocesano"}</strong>
          </div>
          <p>
            {scope === "admin"
              ? "Gestiona clases, alumnos, reservas y avisos del club."
              : "Consulta tus grupos, alumnos y tareas de clase."}
          </p>
        </div>

        <div className="staffSummary">
          <div className="metricCard"><span>Grupos del curso</span><strong>{loading ? "-" : panelMetrics.totalGrupos}</strong></div>
          <div className="metricCard"><span>Alumnos totales</span><strong>{loading ? "-" : panelMetrics.totalAlumnos}</strong></div>
          <div className="metricCard"><span>Grupos con huecos</span><strong>{loading ? "-" : panelMetrics.gruposConHuecos}</strong></div>
          <div className="metricCard"><span>Sin acceso</span><strong>{loading ? "-" : panelMetrics.alumnosSinAcceso}</strong></div>
        </div>
      </header>

      {notice && <div className="staffNotice">{notice}</div>}

      <section className="adminOverview" aria-label="Resumen de hoy">
        <div className="adminOverviewHead">
          <div>
            <span className="staffEyebrow">Resumen de hoy</span>
            <h2>Vista rápida del club</h2>
          </div>
          <span className="adminTodayBadge">{todayClasses.length ? `${todayClasses.length} clase${todayClasses.length === 1 ? "" : "s"} hoy` : "Todo al día"}</span>
        </div>

        <div className="adminTodayGrid">
          <article><span>Clases de hoy</span><strong>{loading ? "-" : todayClasses.length}</strong></article>
          <article><span>Reservas de hoy</span><strong>Ver</strong></article>
          <article><span>Avisos activos</span><strong>Crear</strong></article>
          <article><span>Partidas abiertas</span><strong>Ver</strong></article>
          <article><span>Torneos próximos</span><strong>Ver</strong></article>
        </div>
      </section>

      <section className="adminQuickPanel" aria-label="Acciones rápidas">
        <div className="adminSectionHead">
          <h2>Acciones rápidas</h2>
          <p>Las tareas más habituales, siempre a mano.</p>
        </div>
        <div className="adminQuickGrid">
          {adminQuickActions.map((action) => (
            action.to ? (
              <Link className="adminQuickCard" key={action.key} to={action.to}>
                <strong>{action.label}</strong>
                <span>{action.text}</span>
              </Link>
            ) : (
              <button className="adminQuickCard" key={action.key} type="button" onClick={action.onClick}>
                <strong>{action.label}</strong>
                <span>{action.text}</span>
              </button>
            )
          ))}
        </div>
      </section>

      <section className="adminPendingPanel" aria-label="Pendiente de revisar">
        <div className="adminSectionHead">
          <h2>Pendiente de revisar</h2>
          <p>Pequeñas señales para saber por dónde empezar.</p>
        </div>
        {pendingItems.length ? (
          <div className="adminPendingGrid">
            {pendingItems.map((item) => (
              <button className="adminPendingCard" key={item.key} type="button" onClick={item.action}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="adminEmptyState">
            <strong>Todo al día.</strong>
            <span>No hay tareas pendientes.</span>
          </div>
        )}
      </section>

      <section className="adminModulesPanel" aria-label="Gestión por módulos">
        <div className="adminSectionHead">
          <h2>Gestión por módulos</h2>
          <p>Accede a cada área sin tener que revisar todo el panel de golpe.</p>
        </div>
        <div className="adminModulesGrid">
          {adminModules.map((module) => (
            module.to ? (
              <Link className="adminModuleCard" key={module.key} to={module.to}>
                <div>
                  <h3>{module.title}</h3>
                  <p>{module.text}</p>
                </div>
                <strong>{module.value}</strong>
                <span>{module.label}</span>
              </Link>
            ) : (
              <button className="adminModuleCard" key={module.key} type="button" onClick={module.onClick}>
                <div>
                  <h3>{module.title}</h3>
                  <p>{module.text}</p>
                </div>
                <strong>{module.value}</strong>
                <span>{module.label}</span>
              </button>
            )
          ))}
        </div>
      </section>

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
                      <span>{getCourtName(item.pista_habitual)}</span>
                      <span>{descriptorLabel(item.deporte)}</span>
                      <span>{descriptorLabel(item.categoria)}</span>
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
                  <div><span>Profesor</span><strong>{selectedGroup.profesor || "Sin profesor asignado"}</strong></div>
                  <div><span>Días</span><strong>{formatDias(selectedGroup.dia1, selectedGroup.dia2)}</strong></div>
                  <div><span>Horario</span><strong>{formatHora(selectedGroup.hora_inicio, selectedGroup.duracion_min)}</strong></div>
                  <div><span>Pista</span><strong>{getCourtName(selectedGroup.pista_habitual)}</strong></div>
                  <div><span>Deporte</span><strong>{descriptorLabel(selectedGroup.deporte)}</strong></div>
                  <div><span>Categoría</span><strong>{descriptorLabel(selectedGroup.categoria)}</strong></div>
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
                        <small className="studentAttendanceDays">Asiste: {getStudentDays(selectedGroup, alumno)}</small>
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
              <p>Curso {curso?.nombre || "2026/27"} · {sede?.nombre || "Seminario Diocesano"} · grupos organizados por pista.</p>
            </div>
            <span className="opsCounter">{grupos.filter((item) => Number(item.activo ?? 1) === 1).length} grupos activos</span>
          </div>

          <div className="weeklyCourts">
            {weeklySchedule.map((court) => {
              const courtGroupCount = new Set(
                Object.values(court.days).flat().map(({ group }) => group.id)
              ).size;

              return (
                <section className="courtSchedule" key={court.name}>
                  <div className="courtScheduleHeader">
                    <div>
                      <span>Pista</span>
                      <h3>{court.name}</h3>
                    </div>
                    <strong>{courtGroupCount} grupo{courtGroupCount === 1 ? "" : "s"}</strong>
                  </div>

                  <div className="weeklyGrid">
                    {WEEK_DAYS.map((day) => (
                      <article className="weekDayColumn" key={`${court.name}-${day.key}`}>
                        <div className="weekDayHeader">
                          <strong>{day.label}</strong>
                          <span>{court.days[day.key]?.length || 0}</span>
                        </div>

                        <div className="dayClassStack">
                          {(court.days[day.key] || []).map(({ group, students }) => (
                            <button
                              type="button"
                              className="scheduleClassCard"
                              data-level={group.nivel || "default"}
                              key={`${court.name}-${day.key}-${group.id}`}
                              onClick={() => {
                                setSelectedGroupId(group.id);
                                setActiveView("grupos");
                                setActiveSection("gestion");
                              }}
                            >
                              <span className="scheduleTime">{String(group.hora_inicio || "").slice(0, 5) || "-"}</span>
                              <strong>{group.nombre}</strong>
                              <span className={nivelClass(group.nivel)}>{nivelLabel(group.nivel)}</span>
                              <small>{descriptorLabel(group.deporte)} · {descriptorLabel(group.categoria)}</small>
                              <small>{group.profesor || "Profesor sin asignar"}</small>
                              <div className="scheduleStudents">
                                <span>{students.length} alumno{students.length === 1 ? "" : "s"} este día</span>
                                <small>{students.length ? students.map((student) => student.nombre).join(", ") : "Sin alumnos asignados a este día"}</small>
                              </div>
                            </button>
                          ))}

                          {(!court.days[day.key] || court.days[day.key].length === 0) && (
                            <div className="emptyDay">Sin clases</div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
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
            <span className="opsCounter">{controlStudents.length} alumnos</span>
          </div>

          <div className="controlLayout">
            <aside className="sessionPanel">
              <label>
                Grupo
                <select value={controlGroup?.id || ""} onChange={(e) => setControlGroupId(e.target.value)}>
                  {grupos.filter((item) => Number(item.activo ?? 1) === 1).map((item) => <option key={item.id} value={item.id}>{item.nombre || item.codigo || `Grupo ${item.id}`}</option>)}
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
                  <p>Profesor habitual: {controlGroup.profesor || "sin asignar"} · {controlGroup.pista_habitual || "Sin pista"}</p>
                </div>
              )}

              <label>
                Profesor de esta sesión
                <select value={controlProfessorId} onChange={(e) => setControlProfessorId(e.target.value)}>
                  <option value="">Sin profesor asignado</option>
                  {profesores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                Observaciones
                <textarea value={controlObservations} onChange={(e) => setControlObservations(e.target.value)} rows={3} />
              </label>

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
                <span>{controlSession ? "Sesión guardada" : "Sesión sin guardar"}</span>
              </div>

              {controlLoading && <div className="staffEmpty">Cargando asistencia...</div>}
              {controlError && <div className="preparedNotice" role="alert">{controlError}</div>}
              {!controlLoading && controlGroup && !controlHasClass && <div className="staffEmpty">Este grupo no tiene clase el día elegido.</div>}

              <div className="attendanceList">
                {!controlLoading && controlStudents.map((alumno) => {
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

              {!controlLoading && controlHasClass && controlStudents.length === 0 && <div className="staffEmpty">No hay alumnos asignados para este día.</div>}
              <button className="staffPrimaryBtn" type="button" onClick={saveControlSession} disabled={!controlHasClass || controlLoading || controlSaving || !controlGroup || !!controlError}>
                {controlSaving ? "Guardando..." : controlSession ? "Actualizar sesión y asistencia" : "Guardar sesión y asistencia"}
              </button>
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
              <p>Anota objetivos, observaciones y evolución por grupo.</p>
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
              <p>Espacio para notas internas del profesor o la administración.</p>
            </article>
            <article className="trackingCard">
              <h3>Objetivos trabajados</h3>
              <div className="trackingTags">
                <span>Técnica</span>
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
              <div><span>Matrícula 2026/27</span><strong>{Number(studentProfile.matricula_activa ?? 1) === 1 ? "Activa" : "Inactiva"}</strong></div>
              <div><span>Grupo</span><strong>{studentProfile.grupos || "No disponible"}</strong></div>
              <div><span>Profesor</span><strong>{studentProfile.profesores || studentProfileGroup?.profesor || "No disponible"}</strong></div>
              <div><span>Días</span><strong>{studentProfileGroup && studentProfileMembership ? getStudentDays(studentProfileGroup, studentProfileMembership) : "No disponible"}</strong></div>
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
            <div className="studentEnrollmentIntro">
              <span>Matrícula</span>
              <strong>Curso {curso?.nombre || "2026/27"} · {sede?.nombre || "Seminario Diocesano"}</strong>
              <small>El grupo es opcional y no necesita tener un profesor asignado.</small>
            </div>
            <div className="formGrid">
              <label>Nombre<input value={studentForm.nombre || ""} onChange={(e) => setStudentForm({ ...studentForm, nombre: e.target.value })} required /></label>
              <label>Apellidos<input value={studentForm.apellidos || ""} onChange={(e) => setStudentForm({ ...studentForm, apellidos: e.target.value })} /></label>
              <label>Nivel<select value={studentForm.nivel || ""} onChange={(e) => setStudentForm({ ...studentForm, nivel: e.target.value })}>{NIVELES.map((item) => <option key={item} value={item}>{nivelLabel(item)}</option>)}</select></label>
              <label>Nivel de juego<select value={studentForm.nivel_juego ?? ""} onChange={(e) => setStudentForm({ ...studentForm, nivel_juego: e.target.value === "" ? null : Number(e.target.value) })}>{GAME_LEVELS.map((item) => <option key={String(item.value)} value={item.value}>{item.label}</option>)}</select></label>
              <label>Teléfono<input value={studentForm.telefono || ""} onChange={(e) => setStudentForm({ ...studentForm, telefono: e.target.value })} /></label>
              <label>Email<input type="email" value={studentForm.email || ""} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} /></label>
              <label>Activo<select value={studentForm.activo ?? 1} onChange={(e) => setStudentForm({ ...studentForm, activo: Number(e.target.value) })}><option value={1}>Activo</option><option value={0}>Inactivo</option></select></label>
              <label>Matrícula<select value={studentForm.matricula_activa ?? 1} onChange={(e) => updateStudentEnrollment(Number(e.target.value))}><option value={1}>Activa</option><option value={0}>Inactiva</option></select></label>
              <label>Asignar a grupo<select value={studentForm.grupo_id || ""} onChange={(e) => updateStudentGroup(e.target.value)} disabled={!Number(studentForm.matricula_activa)}><option value="">Sin grupo por ahora</option>{gruposOptions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
              {studentFormGroup && Number(studentForm.matricula_activa) === 1 && (
                <fieldset className="formFieldWide studentDaysField">
                  <legend>Días de asistencia en {studentFormGroup.nombre}</legend>
                  <label>
                    <input type="checkbox" checked={Number(studentForm.asiste_dia1) === 1} onChange={(e) => setStudentForm({ ...studentForm, asiste_dia1: e.target.checked ? 1 : 0 })} />
                    <span>{formatDias(studentFormGroup.dia1)}</span>
                  </label>
                  {studentFormGroup.dia2 && (
                    <label>
                      <input type="checkbox" checked={Number(studentForm.asiste_dia2) === 1} onChange={(e) => setStudentForm({ ...studentForm, asiste_dia2: e.target.checked ? 1 : 0 })} />
                      <span>{formatDias(studentFormGroup.dia2)}</span>
                    </label>
                  )}
                </fieldset>
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
