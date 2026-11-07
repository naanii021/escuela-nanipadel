import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut } from "../services/api";
import { getToken, getUser, logout } from "../services/auth";
import AvisoGuardado, { useAvisoGuardado } from "../components/panel/AvisoGuardado";
import ConfirmarDialogo from "../components/panel/ConfirmarDialogo";
import HorarioDia from "../components/panel/HorarioDia";
import PasarLista from "../components/panel/PasarLista";
import Recuperaciones from "../components/panel/Recuperaciones";
import { IcAtras, IcBuscar, IcMensaje, IcTelefono } from "../components/panel/Iconos";
import {
  DIAS_SEMANA, NIVELES, diaHoy, diasDelGrupo, estadoCupo, formatDias, formatFecha, formatHorario,
  formatHorariosTexto, grupoActivo, hora, hoyISO, iniciales, minutosDe, nivelClass,
  nivelKey, nivelLabel, nombreCompleto, nombrePista, opcionesNivel, plural, sinAcentos, telHref,
  textoCupo, ultimaFechaDelDia, whatsappHref,
} from "../components/panel/panelUtils";
import "../components/panel/panelComponentes.css";
import "./panelProfesor.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];
const GAME_LEVELS = [
  { value: "", label: "Sin nivel de juego" },
  { value: 0, label: "0 - Empieza" },
  { value: 1, label: "1 - Principiante" },
  { value: 2, label: "2 - Medio bajo" },
  { value: 3, label: "3 - Medio" },
  { value: 4, label: "4 - Medio alto" },
  { value: 5, label: "5 - Avanzado" },
  { value: 6, label: "6 - Competición" },
];
const NIVEL_FILTROS = NIVELES.filter((item) => item.key !== "iniciacion_plus" && item.key !== "avanzado_plus");
const GROUP_QUICK_FILTERS = [
  { key: "todos", label: "Todos" },
  ...NIVEL_FILTROS.map((item) => ({ key: `nivel:${item.key}`, label: item.label })),
  { key: "con-huecos", label: "Con plazas libres" },
  { key: "completos", label: "Completos" },
  { key: "sobrecupo", label: "Más alumnos que plazas" },
  { key: "inactivos", label: "Desactivados" },
];
const STUDENT_QUICK_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "sin-acceso", label: "Sin acceso a la web" },
  { key: "con-acceso", label: "Con acceso" },
  { key: "sin-grupo", label: "Sin grupo" },
  { key: "inactivos", label: "De baja" },
];
const PANEL_SECTIONS = [
  { key: "control", label: "Pasar lista" },
  { key: "gestion", label: "Grupos y alumnos" },
  { key: "horario", label: "Horario" },
  { key: "recuperaciones", label: "Recuperaciones" },
  { key: "seguimiento", label: "Seguimiento" },
];
const SECTION_KEYS = PANEL_SECTIONS.map((item) => item.key);

const emptyGroupForm = {
  codigo: "", nombre: "", nivel: "", profesor_id: "", dia1: "L", dia2: "",
  hora_inicio: "18:00", duracion_min: 60, pista_habitual: "", cupo: 4, activo: 1,
};
const emptyStudentForm = {
  nombre: "", apellidos: "", nivel: "", nivel_juego: "", telefono: "", email: "", activo: 1,
  observaciones: "", matricula_activa: 1, grupo_id: "", asiste_dia1: 1, asiste_dia2: 0,
};

function canAccess(user) {
  return STAFF_ROLES.includes(String(user?.rol || "").toLowerCase());
}

function gameLevelLabel(value) {
  const found = GAME_LEVELS.find((item) => String(item.value) === String(value ?? ""));
  return found ? found.label : "Sin nivel de juego";
}

function toGroupForm(group) {
  return {
    codigo: group.codigo || "",
    nombre: group.nombre || "",
    nivel: group.nivel || "",
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

function studentDays(group, student) {
  return formatDias(
    Number(student?.asiste_dia1 ?? 1) === 1 ? group?.dia1 : null,
    Number(student?.asiste_dia2 ?? 1) === 1 ? group?.dia2 : null
  );
}

// Fecha para pasar lista de un grupo: hoy si tiene clase; si no, su última clase.
function fechaDeLista(group) {
  const dias = diasDelGrupo(group);
  if (!dias.length || dias.includes(diaHoy())) return hoyISO();
  return dias.map((dia) => ultimaFechaDelDia(dia)).sort().pop();
}

function grupoIds(alumno) {
  return String(alumno?.grupo_ids || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function ContactLinks({ persona, compact = false }) {
  const tel = telHref(persona?.telefono);
  const wa = whatsappHref(persona?.telefono);
  if (!tel && !persona?.email) return compact ? null : <span className="ppMuted">Sin teléfono ni email</span>;
  return (
    <span className="ppContact">
      {tel && <a className="ppBtn ppBtnSmall" href={tel}><IcTelefono /> {compact ? "Llamar" : persona.telefono}</a>}
      {wa && <a className="ppBtn ppBtnSmall" href={wa} target="_blank" rel="noreferrer"><IcMensaje /> WhatsApp</a>}
      {!tel && persona?.email && <a className="ppBtn ppBtnSmall" href={`mailto:${persona.email}`}>Email</a>}
    </span>
  );
}

function sectionFromUrl(params) {
  const value = params.get("seccion");
  return SECTION_KEYS.includes(value) ? value : null;
}

export default function PanelProfesor() {
  const navigate = useNavigate();
  const user = getUser();
  const token = getToken();
  const userRole = user?.rol;
  const isAdmin = String(userRole || "").toLowerCase() === "admin";

  // /panel?seccion=control&grupo=ID abre directamente la lista de ese grupo (atajo de la portada).
  const [urlParams] = useState(() => new URLSearchParams(window.location.search));
  const [activeSection, setActiveSection] = useState(() => sectionFromUrl(urlParams) || "control");
  const [scrollTick, setScrollTick] = useState(() => (sectionFromUrl(urlParams) ? 1 : 0));
  const [controlPeticion, setControlPeticion] = useState(() => (
    urlParams.get("grupo") ? { grupoId: urlParams.get("grupo"), fecha: urlParams.get("fecha") || hoyISO(), n: 1 } : null
  ));
  const [activeView, setActiveView] = useState("grupos");

  const [alumnos, setAlumnos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [curso, setCurso] = useState(null);
  const [sede, setSede] = useState(null);
  const [catalogos, setCatalogos] = useState({ profesores: [], pistas: [], alumnos: [] });
  const [stats, setStats] = useState({ totalAlumnos: 0, totalGrupos: 0 });
  const [scope, setScope] = useState("profesor");
  const [scopeMessage, setScopeMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [recuperaciones, setRecuperaciones] = useState([]);
  const [recSesiones, setRecSesiones] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");
  const [listasHoy, setListasHoy] = useState({});
  const [listasTick, setListasTick] = useState(0);

  const [search, setSearch] = useState("");
  const [nivel, setNivel] = useState("");
  const [profesor, setProfesor] = useState("");
  const [grupo, setGrupo] = useState("");
  const [groupQuickFilter, setGroupQuickFilter] = useState("todos");
  const [studentQuickFilter, setStudentQuickFilter] = useState("todos");

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [confirmacion, setConfirmacion] = useState(null);
  const [confirmError, setConfirmError] = useState("");

  const [studentProfile, setStudentProfile] = useState(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [accessFormOpen, setAccessFormOpen] = useState(false);
  const [accessStudent, setAccessStudent] = useState(null);
  const [accessForm, setAccessForm] = useState({ email: "", password: "" });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [trackingGroupId, setTrackingGroupId] = useState("");
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramError, setTelegramError] = useState("");

  const { aviso, mostrar: mostrarAviso, cerrar: cerrarAviso } = useAvisoGuardado();
  const anchorRef = useRef(null);
  const tabsRef = useRef(null);
  const detailRef = useRef(null);

  const loadPanel = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiGet("/api/gestion/resumen");
      setAlumnos(data.alumnos || []);
      setGrupos(data.grupos || []);
      setCurso(data.curso || null);
      setSede(data.sede || null);
      setCatalogos(data.catalogos || { profesores: [], pistas: [], alumnos: [] });
      setStats(data.stats || { totalAlumnos: 0, totalGrupos: 0 });
      setScope(data.scope || "profesor");
      setScopeMessage(data.message || "");
      setTrackingGroupId((current) => current || String((data.grupos || [])[0]?.id || ""));
    } catch (e) {
      const message = String(e.message || "");
      if (message.includes("401") || message.includes("No autorizado") || message.includes("Token")) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setLoadError(message || "No hemos podido cargar el panel.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadRecoveries = useCallback(async () => {
    try {
      setRecLoading(true);
      setRecError("");
      const data = await apiGet("/api/gestion/control/recuperaciones");
      setRecuperaciones(data.recuperaciones || []);
      setRecSesiones(data.sesiones || []);
    } catch (e) {
      setRecError(e.message || "No hemos podido cargar las recuperaciones.");
    } finally {
      setRecLoading(false);
    }
  }, []);

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
    loadRecoveries();
  }, [loadPanel, loadRecoveries, navigate, token, userRole]);

  const profesores = useMemo(() => {
    const source = catalogos.profesores?.length
      ? catalogos.profesores.map((item) => ({ id: item.id, name: item.nombre_completo || nombreCompleto(item) }))
      : grupos.map((item) => ({ id: item.profesor_id, name: item.profesor })).filter((item) => item.id && item.name);
    return Array.from(new Map(source.map((item) => [String(item.id), item])).values())
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalogos.profesores, grupos]);

  const nivelOptionsFor = useCallback((actual) => opcionesNivel([...alumnos, ...grupos], actual), [alumnos, grupos]);

  const todayClasses = useMemo(() => {
    const code = diaHoy();
    return grupos
      .filter((item) => grupoActivo(item) && diasDelGrupo(item).includes(code))
      .sort((a, b) => (minutosDe(a.hora_inicio) ?? 0) - (minutosDe(b.hora_inicio) ?? 0));
  }, [grupos]);

  // ¿Ya tiene lista pasada cada clase de hoy? (una lectura por clase; normalmente son pocas)
  useEffect(() => {
    if (!todayClasses.length) return undefined;
    let cancelled = false;
    const fecha = hoyISO();
    Promise.allSettled(todayClasses.map((item) => apiGet(`/api/gestion/control/grupos/${item.id}/sesiones?fecha=${fecha}`)))
      .then((results) => {
        if (cancelled) return;
        setListasHoy(Object.fromEntries(results.map((result, index) => [
          todayClasses[index].id,
          result.status === "fulfilled" && result.value.sesiones?.length && result.value.asistencias?.length ? "guardada" : "",
        ])));
      });
    return () => { cancelled = true; };
  }, [todayClasses, listasTick]);

  const panelMetrics = useMemo(() => ({
    totalGrupos: stats.totalGrupos || grupos.length,
    totalAlumnos: stats.totalAlumnos || alumnos.length,
    gruposConHuecos: grupos.filter((item) => grupoActivo(item) && estadoCupo(item).hayPlazas).length,
    gruposSobrecupo: grupos.filter((item) => grupoActivo(item) && estadoCupo(item).sobrecupo).length,
    alumnosSinAcceso: alumnos.filter((item) => !item.usuario_id).length,
    recuperacionesSinFecha: recuperaciones.filter((item) => item.estado === "pendiente").length,
  }), [alumnos, grupos, recuperaciones, stats.totalAlumnos, stats.totalGrupos]);

  const filteredAlumnos = useMemo(() => {
    const text = sinAcentos(search.trim());
    return alumnos.filter((alumno) => {
      const matchText = !text || sinAcentos(`${nombreCompleto(alumno)} ${alumno.grupos || ""} ${alumno.profesores || ""} ${alumno.telefono || ""}`).includes(text);
      const matchNivel = !nivel || nivelKey(alumno.nivel) === nivel;
      const matchProfesor = !profesor || sinAcentos(alumno.profesores).includes(sinAcentos(profesor));
      const matchGrupo = !grupo || grupoIds(alumno).includes(String(grupo));
      const matchQuick =
        studentQuickFilter === "todos" ||
        (studentQuickFilter === "sin-acceso" && !alumno.usuario_id) ||
        (studentQuickFilter === "con-acceso" && alumno.usuario_id) ||
        (studentQuickFilter === "sin-grupo" && grupoIds(alumno).length === 0) ||
        (studentQuickFilter === "inactivos" && Number(alumno.matricula_activa ?? 1) === 0);
      return matchText && matchNivel && matchProfesor && matchGrupo && matchQuick;
    });
  }, [alumnos, search, nivel, profesor, grupo, studentQuickFilter]);

  const filteredGrupos = useMemo(() => {
    const text = sinAcentos(search.trim());
    return grupos.filter((item) => {
      const alumnosText = (item.alumnos || []).map(nombreCompleto).join(" ");
      const matchText = !text || sinAcentos(`${item.nombre} ${item.codigo} ${item.profesor} ${item.pista_habitual} ${alumnosText}`).includes(text);
      const key = nivelKey(item.nivel);
      const matchNivel = !nivel || key === nivel;
      const matchProfesor = !profesor || item.profesor === profesor;
      const matchGrupo = !grupo || String(item.id) === String(grupo);
      const cupo = estadoCupo(item);
      const quick = groupQuickFilter;
      const matchQuick =
        quick === "todos" ||
        (quick.startsWith("nivel:") && (key === quick.slice(6) || key === `${quick.slice(6)}_plus`)) ||
        (quick === "con-huecos" && grupoActivo(item) && cupo.hayPlazas) ||
        (quick === "completos" && cupo.completo) ||
        (quick === "sobrecupo" && cupo.sobrecupo) ||
        (quick === "inactivos" && !grupoActivo(item));
      return matchText && matchNivel && matchProfesor && matchGrupo && matchQuick;
    });
  }, [grupos, search, nivel, profesor, grupo, groupQuickFilter]);

  // Solo se ofrecen filtros de nivel que tengan algún grupo (los "plus" cuentan con su nivel base).
  const nivelesConGrupos = useMemo(
    () => new Set(grupos.map((item) => nivelKey(item.nivel).replace("_plus", "")).filter(Boolean)),
    [grupos]
  );

  const groupedFilteredGrupos = useMemo(() => {
    const keys = [...NIVELES.map((item) => item.key), "otro", ""];
    return keys
      .map((key) => ({
        key: key || "sin-nivel",
        label: key === "otro" ? "Otros niveles" : key === "" ? "Sin nivel" : NIVELES.find((item) => item.key === key).label,
        items: filteredGrupos
          .filter((item) => nivelKey(item.nivel) === key)
          .sort((a, b) => (minutosDe(a.hora_inicio) ?? 0) - (minutosDe(b.hora_inicio) ?? 0)),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredGrupos]);


  // Si no se ha elegido ninguno, el primero tal y como aparece en la lista.
  const selectedGroup = useMemo(
    () => filteredGrupos.find((item) => String(item.id) === String(selectedGroupId)) || groupedFilteredGrupos[0]?.items[0] || null,
    [filteredGrupos, groupedFilteredGrupos, selectedGroupId]
  );

  const studentsToAdd = useMemo(() => {
    if (!selectedGroup) return [];
    const text = sinAcentos(addQuery.trim());
    if (!text) return [];
    const assigned = new Set((selectedGroup.alumnos || []).map((alumno) => String(alumno.id)));
    return (catalogos.alumnos || [])
      .filter((alumno) => !assigned.has(String(alumno.id)) && sinAcentos(nombreCompleto(alumno)).includes(text))
      .slice(0, 6);
  }, [addQuery, catalogos.alumnos, selectedGroup]);

  const trackingGroup = useMemo(
    () => grupos.find((item) => String(item.id) === String(trackingGroupId)) || grupos[0] || null,
    [grupos, trackingGroupId]
  );
  const trackingSessions = useMemo(() => (
    trackingGroup
      ? recSesiones.filter((item) => String(item.grupo_id) === String(trackingGroup.id)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 12)
      : []
  ), [recSesiones, trackingGroup]);

  const studentProfileGroup = useMemo(() => {
    const id = grupoIds(studentProfile)[0];
    return id ? grupos.find((item) => String(item.id) === id) || null : null;
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

  // ---------- Navegación entre secciones ----------
  const goToSection = useCallback((key) => {
    setActiveSection(key);
    setGroupError("");
    setScrollTick((n) => n + 1);
    const params = new URLSearchParams(window.location.search);
    params.set("seccion", key);
    if (key !== "control") { params.delete("grupo"); params.delete("fecha"); }
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  // Tras tocar una pestaña o acción, la vista baja hasta el contenido (B8).
  useEffect(() => {
    if (!scrollTick || loading) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Se espera un instante a que se pinten los avisos de arriba, que mueven la posición.
    const timer = window.setTimeout(() => {
      const anchor = anchorRef.current;
      const header = document.querySelector(".headerWrap")?.getBoundingClientRect().height || 70;
      if (anchor && Math.abs(anchor.getBoundingClientRect().top - header) > 8) {
        anchor.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [scrollTick, loading, activeSection]);

  // La pestaña activa siempre a la vista dentro de la barra.
  useEffect(() => {
    const bar = tabsRef.current;
    const active = bar?.querySelector('[aria-current="page"]');
    if (!bar || !active) return;
    const left = active.offsetLeft - 12;
    const right = active.offsetLeft + active.offsetWidth + 12;
    if (left < bar.scrollLeft) bar.scrollTo({ left });
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: right - bar.clientWidth });
  }, [activeSection, loading]);

  const openControl = (group, fecha = hoyISO()) => {
    setControlPeticion((current) => ({ grupoId: String(group.id), fecha, n: (current?.n || 0) + 1 }));
    goToSection("control");
  };

  const openGroup = (group) => {
    setSelectedGroupId(group.id);
    setActiveView("grupos");
    setSearch("");
    setGroupQuickFilter("todos");
    setNivel("");
    setProfesor("");
    setGrupo("");
    setDetailOpen(true);
    goToSection("gestion");
  };

  const selectGroup = (group) => {
    setSelectedGroupId(group.id);
    setDetailOpen(true);
    setAddQuery("");
    setGroupError("");
    window.requestAnimationFrame(() => {
      const detail = detailRef.current;
      if (detail && window.matchMedia("(max-width: 980px)").matches) detail.scrollIntoView({ block: "start" });
    });
  };

  // ---------- Modales: Esc cierra el que está encima ----------
  const anyModalOpen = Boolean(studentProfile || groupFormOpen || studentFormOpen || accessFormOpen);
  useEffect(() => {
    if (!anyModalOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape" || formSaving) return;
      if (accessFormOpen) setAccessFormOpen(false);
      else if (studentFormOpen) setStudentFormOpen(false);
      else if (groupFormOpen) setGroupFormOpen(false);
      else setStudentProfile(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModalOpen, accessFormOpen, studentFormOpen, groupFormOpen, formSaving]);

  // ---------- Acciones de grupos ----------
  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupForm({ ...emptyGroupForm, nivel: nivelOptionsFor("").find((item) => nivelKey(item.value) === "iniciacion")?.value || "" });
    setFormError("");
    setGroupFormOpen(true);
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm(toGroupForm(group));
    setFormError("");
    setGroupFormOpen(true);
  };

  const saveGroup = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    try {
      setFormSaving(true);
      setFormError("");
      if (editingGroup) {
        await apiPut(`/api/gestion/grupos/${editingGroup.id}`, groupForm);
      } else {
        const data = await apiPost("/api/gestion/grupos", groupForm);
        setSelectedGroupId(data.id);
      }
      setGroupFormOpen(false);
      mostrarAviso(editingGroup ? `Grupo «${groupForm.nombre}» guardado.` : `Grupo «${groupForm.nombre}» creado.`);
      await loadPanel();
    } catch (e) {
      setFormError(e.message || "No se ha podido guardar el grupo. Revisa los datos y vuelve a intentarlo.");
    } finally {
      setFormSaving(false);
    }
  };

  const addStudentToGroup = async (alumno) => {
    if (!isAdmin || !selectedGroup || !alumno) return;
    try {
      setGroupBusy(true);
      setGroupError("");
      await apiPost(`/api/gestion/grupos/${selectedGroup.id}/alumnos`, { alumno_id: alumno.id });
      setAddQuery("");
      mostrarAviso(`${nombreCompleto(alumno)} añadido a ${selectedGroup.nombre}.`);
      await loadPanel();
    } catch (e) {
      setGroupError(`${e.message || "No se ha podido añadir."} Puedes volver a intentarlo.`);
    } finally {
      setGroupBusy(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirmacion) return;
    const { tipo, grupo: target, alumno } = confirmacion;
    try {
      setGroupBusy(true);
      setConfirmError("");
      if (tipo === "quitar") {
        await apiDelete(`/api/gestion/grupos/${target.id}/alumnos/${alumno.id}`);
        mostrarAviso(`${nombreCompleto(alumno)} ya no está en ${target.nombre}.`);
      } else {
        await apiDelete(`/api/gestion/grupos/${target.id}`);
        setSelectedGroupId(null);
        mostrarAviso(`Grupo «${target.nombre}» desactivado.`);
      }
      setConfirmacion(null);
      await loadPanel();
    } catch (e) {
      setConfirmError(`${e.message || "No se ha podido hacer."} Puedes volver a intentarlo.`);
    } finally {
      setGroupBusy(false);
    }
  };

  // ---------- Acciones de alumnos ----------
  const openEditStudent = (student) => {
    const groupId = grupoIds(student)[0] || "";
    const assignedGroup = grupos.find((item) => String(item.id) === String(groupId));
    const groupStudent = assignedGroup?.alumnos?.find((item) => String(item.id) === String(student.id));
    setCreatingStudent(false);
    setSelectedStudent(student);
    setStudentForm({
      nombre: student.nombre || "",
      apellidos: student.apellidos || "",
      nivel: student.nivel || "",
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
    setFormError("");
    setStudentFormOpen(true);
  };

  const openNewStudent = () => {
    const initialGroup = activeView === "grupos" ? selectedGroup : null;
    setCreatingStudent(true);
    setSelectedStudent(null);
    setStudentForm({
      ...emptyStudentForm,
      grupo_id: initialGroup?.id ? String(initialGroup.id) : "",
      asiste_dia1: initialGroup?.dia1 ? 1 : 0,
      asiste_dia2: initialGroup?.dia2 ? 1 : 0,
    });
    setFormError("");
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
      setFormError("Marca al menos un día al que vendrá al grupo.");
      return;
    }
    try {
      setFormSaving(true);
      setFormError("");
      if (creatingStudent) await apiPost("/api/gestion/alumnos", studentForm);
      else if (selectedStudent) await apiPut(`/api/gestion/alumnos/${selectedStudent.id}`, studentForm);
      setStudentFormOpen(false);
      mostrarAviso(creatingStudent ? `${nombreCompleto(studentForm)} dado de alta.` : `Datos de ${nombreCompleto(studentForm)} guardados.`);
      await loadPanel();
    } catch (e) {
      setFormError(e.message || "No se ha podido guardar. Revisa los datos y vuelve a intentarlo.");
    } finally {
      setFormSaving(false);
    }
  };

  const openCreateAccess = (student) => {
    setAccessStudent(student);
    setAccessForm({ email: student.email || "", password: "" });
    setFormError("");
    setAccessFormOpen(true);
  };

  const saveAccess = async (event) => {
    event.preventDefault();
    if (!isAdmin || !accessStudent) return;
    try {
      setFormSaving(true);
      setFormError("");
      await apiPost(`/api/gestion/alumnos/${accessStudent.id}/crear-acceso`, accessForm);
      setAccessFormOpen(false);
      mostrarAviso(`${nombreCompleto(accessStudent)} ya puede entrar en la web.`);
      await loadPanel();
    } catch (e) {
      setFormError(e.message || "No se ha podido crear el acceso. Vuelve a intentarlo.");
    } finally {
      setFormSaving(false);
    }
  };

  const createTelegramLink = async () => {
    try {
      setTelegramBusy(true);
      setTelegramError("");
      setTelegramLink(await apiPost("/api/gestion/control/telegram/link-code", {}));
    } catch (e) {
      setTelegramError(e.message || "No se ha podido generar el código. Vuelve a intentarlo.");
    } finally {
      setTelegramBusy(false);
    }
  };

  if (!token || !canAccess({ rol: userRole })) return null;

  const cursoTexto = `Curso ${curso?.nombre || "2026/27"} · ${sede?.nombre || "Seminario Diocesano"}`;
  const profesorSinVincular = !isAdmin && scope === "profesor" && scopeMessage && grupos.length === 0;

  const alerts = [
    panelMetrics.recuperacionesSinFecha > 0 && {
      key: "rec", tone: "warn",
      text: `${plural(panelMetrics.recuperacionesSinFecha, "recuperación", "recuperaciones")} sin fecha`,
      onClick: () => goToSection("recuperaciones"),
    },
    isAdmin && panelMetrics.gruposSobrecupo > 0 && {
      key: "sobrecupo", tone: "warn",
      text: `${plural(panelMetrics.gruposSobrecupo, "grupo")} con más alumnos que plazas`,
      onClick: () => { clearFilters(); setActiveView("grupos"); setGroupQuickFilter("sobrecupo"); goToSection("gestion"); },
    },
    isAdmin && panelMetrics.alumnosSinAcceso > 0 && {
      key: "acceso",
      text: `${plural(panelMetrics.alumnosSinAcceso, "alumno")} sin acceso a la web`,
      onClick: () => { clearFilters(); setActiveView("alumnos"); setStudentQuickFilter("sin-acceso"); goToSection("gestion"); },
    },
    isAdmin && panelMetrics.gruposConHuecos > 0 && {
      key: "huecos",
      text: `${plural(panelMetrics.gruposConHuecos, "grupo")} con plazas libres`,
      onClick: () => { clearFilters(); setActiveView("grupos"); setGroupQuickFilter("con-huecos"); goToSection("gestion"); },
    },
  ].filter(Boolean);

  const otherPages = [
    { to: "/reservas", label: "Reservas" },
    { to: "/estado-pista", label: "Estado de la pista" },
    { to: "/avisos", label: "Avisos" },
    ...(isAdmin ? [{ to: "/torneos", label: "Torneos" }, { to: "/panel/whatsapp", label: "WhatsApp" }] : []),
  ];

  const selectedCupo = selectedGroup ? estadoCupo(selectedGroup) : null;
  const confirmName = confirmacion?.alumno ? nombreCompleto(confirmacion.alumno) : "";

  return (
    <section className="ppPanel">
      <header className="ppHead">
        <div>
          <h1>{isAdmin ? "Panel de administración" : "Panel de profesor"}</h1>
          <p>
            {cursoTexto}
            {isAdmin && !loading && !loadError && ` · ${plural(panelMetrics.totalGrupos, "grupo")} · ${plural(panelMetrics.totalAlumnos, "alumno")}`}
          </p>
        </div>
      </header>

      {loading && <div className="ppSkeleton" aria-label="Cargando el panel" />}

      {!loading && loadError && (
        <div className="ppInlineError ppLoadError" role="alert">
          <strong>No hemos podido cargar el panel.</strong>
          <span>{loadError}</span>
          <button type="button" className="ppBtn ppBtnPrimary" onClick={() => { setLoading(true); loadPanel(); }}>Reintentar</button>
        </div>
      )}

      {profesorSinVincular && (
        <div className="ppNotice" role="note">
          <strong>Tu usuario aún no está unido a tu ficha de profesor.</strong>
          <span>Por eso no ves grupos. Pide a la administración que lo vincule y vuelve a entrar.</span>
        </div>
      )}

      {!loading && !loadError && alerts.length > 0 && (
        <div className="ppAlerts" role="group" aria-label="Pendiente de revisar">
          {alerts.map((item) => (
            <button key={item.key} type="button" className="ppAlert" data-tone={item.tone || "info"} onClick={item.onClick}>{item.text}</button>
          ))}
        </div>
      )}

      <div ref={anchorRef} className="ppAnchor" aria-hidden="true" />
      <nav className="ppTabs" aria-label="Secciones del panel">
        <div className="ppTabsScroll" ref={tabsRef}>
          {PANEL_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              className="ppTab"
              aria-current={activeSection === section.key ? "page" : undefined}
              onClick={() => goToSection(section.key)}
            >
              {section.label}
              {section.key === "recuperaciones" && panelMetrics.recuperacionesSinFecha > 0 && (
                <span className="ppCount">{panelMetrics.recuperacionesSinFecha}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {!loading && !loadError && (
        <div className="ppContent" key={activeSection}>
          {activeSection === "control" && (
            <PasarLista
              isAdmin={isAdmin}
              profesores={profesores}
              peticion={controlPeticion}
              listasHoy={listasHoy}
              onAviso={mostrarAviso}
              onGuardada={() => { setListasTick((n) => n + 1); loadRecoveries(); }}
            />
          )}

          {activeSection === "horario" && (
            <HorarioDia grupos={grupos} onPasarLista={openControl} onVerGrupo={openGroup} />
          )}

          {activeSection === "recuperaciones" && (
            <Recuperaciones
              recuperaciones={recuperaciones}
              sesiones={recSesiones}
              cargando={recLoading}
              error={recError}
              onRecargar={loadRecoveries}
              onAviso={mostrarAviso}
            />
          )}

          {activeSection === "gestion" && (
            <section className="ppSection" aria-labelledby="pp-gestion-title">
              <div className="ppSectionHead">
                <h2 id="pp-gestion-title">Grupos y alumnos</h2>
              </div>

              <div className="ppToolbar">
                <div className="ppSegmentedTabs" role="group" aria-label="Qué ver">
                  <button type="button" aria-pressed={activeView === "grupos"} onClick={() => setActiveView("grupos")}>
                    Grupos <span className="ppCount">{grupos.length}</span>
                  </button>
                  <button type="button" aria-pressed={activeView === "alumnos"} onClick={() => setActiveView("alumnos")}>
                    Alumnos <span className="ppCount">{alumnos.length}</span>
                  </button>
                </div>
                <label className="ppSearch">
                  <IcBuscar />
                  <input
                    type="search"
                    enterKeyHint="search"
                    aria-label={activeView === "grupos" ? "Buscar grupo" : "Buscar alumno"}
                    placeholder={activeView === "grupos" ? "Buscar grupo, profesor o alumno" : "Buscar alumno por nombre o teléfono"}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {isAdmin && (
                  <div className="ppToolbarActions">
                    <button type="button" className="ppBtn" onClick={openNewStudent}>Nuevo alumno</button>
                    <button type="button" className="ppBtn" onClick={openNewGroup}>Nuevo grupo</button>
                  </div>
                )}
              </div>

              <div className="ppFilterChips" role="group" aria-label="Filtros rápidos">
                {(activeView === "grupos" ? GROUP_QUICK_FILTERS : STUDENT_QUICK_FILTERS)
                  .filter((item) => isAdmin || !["sin-acceso", "con-acceso", "inactivos", "sobrecupo"].includes(item.key))
                  .filter((item) => !item.key.startsWith("nivel:") || nivelesConGrupos.has(item.key.slice(6)))
                  .filter((item) => item.key !== "sobrecupo" || panelMetrics.gruposSobrecupo > 0)
                  .map((item) => {
                    const active = activeView === "grupos" ? groupQuickFilter === item.key : studentQuickFilter === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="ppChip"
                        aria-pressed={active}
                        onClick={() => (activeView === "grupos" ? setGroupQuickFilter(item.key) : setStudentQuickFilter(item.key))}
                      >
                        {item.label}
                      </button>
                    );
                  })}
              </div>

              <details className="ppMoreFilters">
                <summary>Más filtros</summary>
                <div className="ppMoreFiltersBody">
                  <label className="ppField"><span>Nivel</span>
                    <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
                      <option value="">Todos los niveles</option>
                      {NIVELES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                      <option value="otro">Otros niveles</option>
                    </select>
                  </label>
                  <label className="ppField"><span>Profesor</span>
                    <select value={profesor} onChange={(e) => setProfesor(e.target.value)}>
                      <option value="">Todos los profesores</option>
                      {profesores.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="ppField"><span>Grupo</span>
                    <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                      <option value="">Todos los grupos</option>
                      {grupos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </label>
                </div>
              </details>
              {hasFilters && <button type="button" className="ppBtn ppBtnGhost" onClick={clearFilters}>Quitar filtros</button>}

              {activeView === "grupos" && (
                <div className={`ppGroups${detailOpen ? " isDetailOpen" : ""}`}>
                  <div className="ppGroupList" aria-label="Lista de grupos">
                    <p className="ppResultCount">{plural(filteredGrupos.length, "grupo")}</p>
                    {groupedFilteredGrupos.map((section) => (
                      <div className="ppGroupLevel" key={section.key}>
                        <h3>{section.label}</h3>
                        <ul>
                          {section.items.map((item) => {
                            const cupo = estadoCupo(item);
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  className="ppGroupItem"
                                  aria-current={String(selectedGroup?.id) === String(item.id) ? "true" : undefined}
                                  onClick={() => selectGroup(item)}
                                >
                                  <span className="ppGroupItemTop">
                                    <strong>{item.nombre}</strong>
                                    <span className={cupo.sobrecupo ? "ppCupo isOver" : cupo.completo ? "ppCupo isFull" : "ppCupo"}>{textoCupo(item)}</span>
                                  </span>
                                  <span className="ppGroupItemMeta">
                                    {formatDias(item.dia1, item.dia2)}, {hora(item.hora_inicio) || "sin hora"} · {nombrePista(item.pista_habitual)}
                                    {item.profesor ? ` · ${item.profesor}` : ""}
                                    {!grupoActivo(item) ? " · Desactivado" : ""}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                    {filteredGrupos.length === 0 && <p className="ppEmpty">No hay grupos con estos filtros.</p>}
                  </div>

                  <div className="ppGroupDetail" ref={detailRef}>
                    {selectedGroup ? (
                      <>
                        <button type="button" className="ppBtn ppBtnGhost ppBack" onClick={() => setDetailOpen(false)}>
                          <IcAtras /> Todos los grupos
                        </button>
                        <div className="ppDetailHead">
                          <div>
                            <h3>{selectedGroup.nombre}</h3>
                            <p className="ppMetaLine">
                              <span className={nivelClass(selectedGroup.nivel)}>{nivelLabel(selectedGroup.nivel)}</span>
                              <span>{grupoActivo(selectedGroup) ? "Activo" : "Desactivado"}</span>
                            </p>
                          </div>
                          <div className="ppDetailActions">
                            {grupoActivo(selectedGroup) && (
                              <button type="button" className="ppBtn ppBtnPrimary" onClick={() => openControl(selectedGroup, fechaDeLista(selectedGroup))}>
                                Pasar lista
                              </button>
                            )}
                            {isAdmin && <button type="button" className="ppBtn" onClick={() => openEditGroup(selectedGroup)}>Editar grupo</button>}
                            {isAdmin && grupoActivo(selectedGroup) && (
                              <button type="button" className="ppBtn ppBtnDangerQuiet" onClick={() => { setConfirmError(""); setConfirmacion({ tipo: "desactivar", grupo: selectedGroup }); }}>
                                Desactivar
                              </button>
                            )}
                          </div>
                        </div>

                        <dl className="ppFacts">
                          <div><dt>Días y hora</dt><dd>{formatDias(selectedGroup.dia1, selectedGroup.dia2)}, {formatHorario(selectedGroup.hora_inicio, selectedGroup.duracion_min)}</dd></div>
                          <div><dt>Pista</dt><dd>{nombrePista(selectedGroup.pista_habitual)}</dd></div>
                          <div><dt>Profesor</dt><dd>{selectedGroup.profesor || "Sin profesor"}</dd></div>
                          <div><dt>Plazas</dt><dd>{textoCupo(selectedGroup)}</dd></div>
                        </dl>

                        {selectedCupo?.sobrecupo && (
                          <p className="ppNotice ppNoticeWarn">Hay más alumnos que plazas ({textoCupo(selectedGroup)}). Revisa quién viene cada día.</p>
                        )}

                        {groupError && <p className="ppInlineError" role="alert">{groupError}</p>}

                        {isAdmin && grupoActivo(selectedGroup) && (
                          <div className="ppAddStudent">
                            <label className="ppField">
                              <span>Añadir un alumno a este grupo</span>
                              <input type="search" enterKeyHint="search" value={addQuery} placeholder="Escribe su nombre" onChange={(e) => setAddQuery(e.target.value)} />
                            </label>
                            {selectedCupo?.algunDiaCompleto && addQuery && (
                              <p className="ppFieldNote">Algún día ya está completo, así que no se puede apuntar a todos los días. Si solo vendrá el día con plaza, ábrelo en Alumnos y usa «Editar».</p>
                            )}
                            {addQuery && !selectedCupo?.algunDiaCompleto && (
                              studentsToAdd.length ? (
                                <ul className="ppPickList">
                                  {studentsToAdd.map((alumno) => (
                                    <li key={alumno.id}>
                                      <button type="button" className="ppPickItem" onClick={() => addStudentToGroup(alumno)} disabled={groupBusy}>
                                        <span>{nombreCompleto(alumno)}{alumno.nivel ? ` · ${nivelLabel(alumno.nivel)}` : ""}</span>
                                        <strong>Añadir</strong>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p className="ppFieldNote">No hay ningún alumno con ese nombre fuera del grupo.</p>
                            )}
                          </div>
                        )}

                        <h4 className="ppSubhead">Alumnos ({selectedGroup.alumnos?.length || 0})</h4>
                        {(selectedGroup.alumnos || []).length === 0 ? (
                          <p className="ppEmpty">Este grupo aún no tiene alumnos.</p>
                        ) : (
                          <ul className="ppPeople">
                            {selectedGroup.alumnos.map((alumno) => (
                              <li className="ppPeopleRow" key={alumno.id}>
                                <div className="ppPerson">
                                  <span className="ppAvatar" aria-hidden="true">{iniciales(alumno)}</span>
                                  <span className="ppPersonText">
                                    <strong>{nombreCompleto(alumno)}</strong>
                                    <small>Viene: {studentDays(selectedGroup, alumno)}{alumno.nivel ? ` · ${nivelLabel(alumno.nivel)}` : ""}</small>
                                  </span>
                                </div>
                                <div className="ppRowActions">
                                  <ContactLinks persona={alumno} compact />
                                  {isAdmin && (
                                    <button type="button" className="ppBtn ppBtnSmall ppBtnDangerQuiet" onClick={() => { setConfirmError(""); setConfirmacion({ tipo: "quitar", grupo: selectedGroup, alumno }); }}>
                                      Quitar
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <p className="ppEmpty">Elige un grupo para ver sus alumnos.</p>
                    )}
                  </div>
                </div>
              )}

              {activeView === "alumnos" && (
                <div className="ppStudents">
                  <p className="ppResultCount">{plural(filteredAlumnos.length, "alumno")}</p>
                  <div className="ppStudentsHead" aria-hidden="true">
                    <span>Alumno</span><span>Nivel</span><span>Grupo y horario</span><span>Acceso</span><span />
                  </div>
                  <ul className="ppStudentList">
                    {filteredAlumnos.map((alumno) => (
                      <li className="ppStudentRow" key={alumno.id}>
                        <div className="ppPerson">
                          <span className="ppAvatar" aria-hidden="true">{iniciales(alumno)}</span>
                          <span className="ppPersonText">
                            <strong>{nombreCompleto(alumno)}</strong>
                            <small>{alumno.telefono || alumno.email || "Sin teléfono ni email"}</small>
                          </span>
                        </div>
                        <span className="ppStudentCell"><span className={nivelClass(alumno.nivel)}>{nivelLabel(alumno.nivel)}</span></span>
                        <span className="ppStudentCell ppStudentGroup">
                          {alumno.grupos || "Sin grupo"}
                          {alumno.horarios && <small>{formatHorariosTexto(alumno.horarios)}{alumno.pistas ? ` · ${nombrePista(alumno.pistas)}` : ""}</small>}
                        </span>
                        <span className="ppStudentCell">
                          <span className={alumno.usuario_id ? "ppTag isOn" : "ppTag"}>{alumno.usuario_id ? "Entra en la web" : "Sin acceso"}</span>
                        </span>
                        <div className="ppRowActions">
                          <button type="button" className="ppBtn ppBtnSmall" onClick={() => setStudentProfile(alumno)}>Ver ficha</button>
                          {isAdmin && <button type="button" className="ppBtn ppBtnSmall" onClick={() => openEditStudent(alumno)}>Editar</button>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {filteredAlumnos.length === 0 && <p className="ppEmpty">No hay alumnos con estos filtros.</p>}
                </div>
              )}
            </section>
          )}

          {activeSection === "seguimiento" && (
            <section className="ppSection" aria-labelledby="pp-seg-title">
              <div className="ppSectionHead">
                <h2 id="pp-seg-title">Seguimiento</h2>
                <p>Clases con lista pasada y alumnos de cada grupo. Las notas se escriben al pasar lista, en «Más opciones».</p>
              </div>
              {grupos.length === 0 ? (
                <p className="ppEmpty">No hay grupos para mostrar.</p>
              ) : (
                <>
                  <label className="ppField ppFieldInline">
                    <span>Grupo</span>
                    <select value={trackingGroup?.id || ""} onChange={(e) => setTrackingGroupId(e.target.value)}>
                      {grupos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </label>
                  {trackingGroup && (
                    <div className="ppTracking">
                      <div>
                        <h3 className="ppSubhead">Clases con lista pasada</h3>
                        {recError && <p className="ppInlineError" role="alert">{recError}</p>}
                        {!recError && trackingSessions.length === 0 && <p className="ppEmpty">Aún no se ha pasado lista en este grupo.</p>}
                        {trackingSessions.length > 0 && (
                          <ul className="ppPickList">
                            {trackingSessions.map((session) => (
                              <li key={session.id}>
                                <button type="button" className="ppPickItem" onClick={() => openControl(trackingGroup, session.fecha)}>
                                  <span>{formatFecha(session.fecha)}, {hora(session.hora_inicio)}</span>
                                  <strong>Ver lista y notas</strong>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h3 className="ppSubhead">Alumnos ({trackingGroup.alumnos?.length || 0})</h3>
                        {(trackingGroup.alumnos || []).length === 0 ? (
                          <p className="ppEmpty">Este grupo aún no tiene alumnos.</p>
                        ) : (
                          <ul className="ppPeople">
                            {trackingGroup.alumnos.map((alumno) => (
                              <li className="ppPeopleRow" key={alumno.id}>
                                <div className="ppPerson">
                                  <span className="ppAvatar" aria-hidden="true">{iniciales(alumno)}</span>
                                  <span className="ppPersonText">
                                    <strong>{nombreCompleto(alumno)}</strong>
                                    <small>Viene: {studentDays(trackingGroup, alumno)}</small>
                                  </span>
                                </div>
                                <div className="ppRowActions"><ContactLinks persona={alumno} compact /></div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}

      {!isAdmin && !loading && (
        <details className="ppTelegram">
          <summary>Pasar lista desde Telegram</summary>
          <div className="ppTelegramBody">
            <p>Une tu usuario a un chat privado de Telegram con un código que sirve una sola vez.</p>
            {telegramError && <p className="ppInlineError" role="alert">{telegramError}</p>}
            {telegramLink ? (
              <div className="ppTelegramCode">
                <code>{telegramLink.command}</code>
                {telegramLink.link && <a className="ppBtn ppBtnPrimary" href={telegramLink.link} target="_blank" rel="noreferrer">Abrir Telegram</a>}
                <button className="ppBtn" type="button" onClick={createTelegramLink} disabled={telegramBusy}>Generar otro código</button>
                <small>El código caduca en {telegramLink.expires_in_minutes} minutos.</small>
              </div>
            ) : (
              <button className="ppBtn" type="button" onClick={createTelegramLink} disabled={telegramBusy}>
                {telegramBusy ? "Generando..." : "Generar código de Telegram"}
              </button>
            )}
          </div>
        </details>
      )}

      <nav className="ppLinks" aria-label="Otras páginas">
        <span>Otras páginas:</span>
        {otherPages.map((item) => <Link key={item.to} className="ppLink" to={item.to}>{item.label}</Link>)}
      </nav>

      {studentProfile && (
        <div className="ppBackdrop" onClick={(event) => { if (event.target === event.currentTarget) setStudentProfile(null); }}>
          <aside className="ppSheet" role="dialog" aria-modal="true" aria-labelledby="pp-ficha-title">
            <div className="ppSheetHead">
              <div className="ppPerson">
                <span className="ppAvatar" aria-hidden="true">{iniciales(studentProfile)}</span>
                <span className="ppPersonText">
                  <strong id="pp-ficha-title">{nombreCompleto(studentProfile)}</strong>
                  <small>{nivelLabel(studentProfile.nivel)} · {Number(studentProfile.matricula_activa ?? 1) === 1 ? "Matrícula activa" : "De baja este curso"}</small>
                </span>
              </div>
              <button type="button" className="ppBtn ppBtnSmall" onClick={() => setStudentProfile(null)}>Cerrar</button>
            </div>

            <ContactLinks persona={studentProfile} />

            <dl className="ppFacts">
              <div><dt>Teléfono</dt><dd>{studentProfile.telefono || "No consta"}</dd></div>
              <div><dt>Email</dt><dd>{studentProfile.email || "No consta"}</dd></div>
              <div><dt>Grupo</dt><dd>{studentProfile.grupos || "Sin grupo"}</dd></div>
              <div><dt>Profesor</dt><dd>{studentProfile.profesores || studentProfileGroup?.profesor || "No consta"}</dd></div>
              <div><dt>Días</dt><dd>{studentProfileGroup && studentProfileMembership ? studentDays(studentProfileGroup, studentProfileMembership) : "No consta"}</dd></div>
              <div><dt>Horario</dt><dd>{formatHorariosTexto(studentProfile.horarios) || (studentProfileGroup ? formatHorario(studentProfileGroup.hora_inicio, studentProfileGroup.duracion_min) : "No consta")}</dd></div>
              <div><dt>Pista</dt><dd>{studentProfile.pistas ? nombrePista(studentProfile.pistas) : studentProfileGroup ? nombrePista(studentProfileGroup.pista_habitual) : "No consta"}</dd></div>
              <div><dt>Nivel de juego</dt><dd>{gameLevelLabel(studentProfile.nivel_juego)}</dd></div>
              <div><dt>Acceso a la web</dt><dd>{studentProfile.usuario_id ? "Sí" : "No"}</dd></div>
            </dl>

            {studentProfile.observaciones && (
              <div className="ppSheetNotes"><h3 className="ppSubhead">Notas</h3><p>{studentProfile.observaciones}</p></div>
            )}

            <div className="ppSheetActions">
              {studentProfileGroup && (
                <button type="button" className="ppBtn" onClick={() => { setStudentProfile(null); openGroup(studentProfileGroup); }}>Ver su grupo</button>
              )}
              {isAdmin && !studentProfile.usuario_id && (
                <button type="button" className="ppBtn" onClick={() => { const s = studentProfile; setStudentProfile(null); openCreateAccess(s); }}>Darle acceso a la web</button>
              )}
              {isAdmin && (
                <button type="button" className="ppBtn" onClick={() => { const s = studentProfile; setStudentProfile(null); openEditStudent(s); }}>Editar o dar de baja</button>
              )}
            </div>
          </aside>
        </div>
      )}

      {isAdmin && groupFormOpen && (
        <div className="ppBackdrop">
          <form className="ppModal" onSubmit={saveGroup} aria-labelledby="pp-gform-title">
            <div className="ppSheetHead">
              <h2 id="pp-gform-title">{editingGroup ? `Editar ${editingGroup.nombre}` : "Nuevo grupo"}</h2>
              <button type="button" className="ppBtn ppBtnSmall" onClick={() => setGroupFormOpen(false)} disabled={formSaving}>Cerrar</button>
            </div>
            <div className="ppFormGrid">
              <label className="ppField"><span>Nombre</span><input value={groupForm.nombre} onChange={(e) => setGroupForm({ ...groupForm, nombre: e.target.value })} required /></label>
              <label className="ppField"><span>Código (opcional)</span><input value={groupForm.codigo} autoCapitalize="characters" onChange={(e) => setGroupForm({ ...groupForm, codigo: e.target.value })} /></label>
              <label className="ppField"><span>Nivel</span>
                <select value={groupForm.nivel} onChange={(e) => setGroupForm({ ...groupForm, nivel: e.target.value })}>
                  {nivelOptionsFor(groupForm.nivel).map((item) => <option key={item.value || "none"} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="ppField"><span>Profesor</span>
                <select value={groupForm.profesor_id} onChange={(e) => setGroupForm({ ...groupForm, profesor_id: e.target.value })}>
                  <option value="">Sin profesor</option>
                  {profesores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="ppField"><span>Primer día</span>
                <select value={groupForm.dia1} onChange={(e) => setGroupForm({ ...groupForm, dia1: e.target.value })}>
                  {DIAS_SEMANA.map((dia) => <option key={dia.key} value={dia.key}>{dia.label}</option>)}
                </select>
              </label>
              <label className="ppField"><span>Segundo día</span>
                <select value={groupForm.dia2} onChange={(e) => setGroupForm({ ...groupForm, dia2: e.target.value })}>
                  <option value="">Solo un día</option>
                  {DIAS_SEMANA.map((dia) => <option key={dia.key} value={dia.key}>{dia.label}</option>)}
                </select>
              </label>
              <label className="ppField"><span>Hora de inicio</span><input type="time" value={groupForm.hora_inicio} onChange={(e) => setGroupForm({ ...groupForm, hora_inicio: e.target.value })} /></label>
              <label className="ppField"><span>Duración (minutos)</span><input type="number" inputMode="numeric" min="30" step="15" value={groupForm.duracion_min} onChange={(e) => setGroupForm({ ...groupForm, duracion_min: Number(e.target.value) })} /></label>
              <label className="ppField"><span>Pista</span><input list="pp-pistas" value={groupForm.pista_habitual} onChange={(e) => setGroupForm({ ...groupForm, pista_habitual: e.target.value })} /></label>
              <label className="ppField"><span>Plazas por día</span><input type="number" inputMode="numeric" min="1" value={groupForm.cupo} onChange={(e) => setGroupForm({ ...groupForm, cupo: Number(e.target.value) })} /></label>
              <label className="ppField"><span>Estado</span>
                <select value={groupForm.activo} onChange={(e) => setGroupForm({ ...groupForm, activo: Number(e.target.value) })}>
                  <option value={1}>Activo</option><option value={0}>Desactivado</option>
                </select>
              </label>
            </div>
            <datalist id="pp-pistas">{(catalogos.pistas || []).map((pista) => <option key={pista.id} value={pista.nombre} />)}</datalist>
            {formError && <p className="ppInlineError" role="alert">{formError}</p>}
            <div className="ppModalActions">
              <button type="button" className="ppBtn" onClick={() => setGroupFormOpen(false)} disabled={formSaving}>Cancelar</button>
              <button type="submit" className="ppBtn ppBtnPrimary" disabled={formSaving}>{formSaving ? "Guardando..." : editingGroup ? "Guardar cambios" : "Crear grupo"}</button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && studentFormOpen && (
        <div className="ppBackdrop">
          <form className="ppModal" onSubmit={saveStudent} aria-labelledby="pp-sform-title">
            <div className="ppSheetHead">
              <h2 id="pp-sform-title">{creatingStudent ? "Nuevo alumno" : `Editar a ${nombreCompleto(selectedStudent)}`}</h2>
              <button type="button" className="ppBtn ppBtnSmall" onClick={() => setStudentFormOpen(false)} disabled={formSaving}>Cerrar</button>
            </div>
            <p className="ppFieldNote">Matrícula del {cursoTexto}. El grupo es opcional.</p>
            <div className="ppFormGrid">
              <label className="ppField"><span>Nombre</span><input value={studentForm.nombre || ""} autoComplete="off" onChange={(e) => setStudentForm({ ...studentForm, nombre: e.target.value })} required /></label>
              <label className="ppField"><span>Apellidos</span><input value={studentForm.apellidos || ""} autoComplete="off" onChange={(e) => setStudentForm({ ...studentForm, apellidos: e.target.value })} /></label>
              <label className="ppField"><span>Nivel</span>
                <select value={studentForm.nivel || ""} onChange={(e) => setStudentForm({ ...studentForm, nivel: e.target.value })}>
                  {nivelOptionsFor(studentForm.nivel).map((item) => <option key={item.value || "none"} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="ppField"><span>Nivel de juego</span>
                <select value={studentForm.nivel_juego ?? ""} onChange={(e) => setStudentForm({ ...studentForm, nivel_juego: e.target.value === "" ? null : Number(e.target.value) })}>
                  {GAME_LEVELS.map((item) => <option key={String(item.value)} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="ppField"><span>Teléfono</span><input type="tel" inputMode="tel" autoComplete="tel" value={studentForm.telefono || ""} onChange={(e) => setStudentForm({ ...studentForm, telefono: e.target.value })} /></label>
              <label className="ppField"><span>Email</span><input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={studentForm.email || ""} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} /></label>
              <label className="ppField"><span>Ficha</span>
                <select value={studentForm.activo ?? 1} onChange={(e) => setStudentForm({ ...studentForm, activo: Number(e.target.value) })}>
                  <option value={1}>Activa</option><option value={0}>Desactivada</option>
                </select>
              </label>
              <label className="ppField"><span>Matrícula de este curso</span>
                <select value={studentForm.matricula_activa ?? 1} onChange={(e) => updateStudentEnrollment(Number(e.target.value))}>
                  <option value={1}>Matriculado</option><option value={0}>De baja</option>
                </select>
              </label>
              <label className="ppField ppFieldWide"><span>Grupo</span>
                <select value={studentForm.grupo_id || ""} onChange={(e) => updateStudentGroup(e.target.value)} disabled={!Number(studentForm.matricula_activa)}>
                  <option value="">Sin grupo por ahora</option>
                  {grupos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
              {studentFormGroup && Number(studentForm.matricula_activa) === 1 && (
                <fieldset className="ppFieldWide ppCheckGroup">
                  <legend>Días que viene a {studentFormGroup.nombre}</legend>
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
              <label className="ppField ppFieldWide"><span>Notas (opcional)</span><textarea rows={2} value={studentForm.observaciones || ""} onChange={(e) => setStudentForm({ ...studentForm, observaciones: e.target.value })} /></label>
            </div>
            {formError && <p className="ppInlineError" role="alert">{formError}</p>}
            <div className="ppModalActions">
              <button type="button" className="ppBtn" onClick={() => setStudentFormOpen(false)} disabled={formSaving}>Cancelar</button>
              <button type="submit" className="ppBtn ppBtnPrimary" disabled={formSaving}>{formSaving ? "Guardando..." : creatingStudent ? "Dar de alta" : "Guardar cambios"}</button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && accessFormOpen && (
        <div className="ppBackdrop">
          <form className="ppModal" onSubmit={saveAccess} aria-labelledby="pp-aform-title">
            <div className="ppSheetHead">
              <h2 id="pp-aform-title">Acceso a la web para {nombreCompleto(accessStudent)}</h2>
              <button type="button" className="ppBtn ppBtnSmall" onClick={() => setAccessFormOpen(false)} disabled={formSaving}>Cerrar</button>
            </div>
            <p className="ppFieldNote">Se creará una cuenta para que pueda entrar con este email y contraseña.</p>
            <div className="ppFormGrid">
              <label className="ppField"><span>Email</span><input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={accessForm.email || ""} onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })} required /></label>
              <label className="ppField"><span>Contraseña inicial (mínimo 6 caracteres)</span><input type="password" autoComplete="new-password" value={accessForm.password || ""} onChange={(e) => setAccessForm({ ...accessForm, password: e.target.value })} minLength={6} required /></label>
            </div>
            {formError && <p className="ppInlineError" role="alert">{formError}</p>}
            <div className="ppModalActions">
              <button type="button" className="ppBtn" onClick={() => setAccessFormOpen(false)} disabled={formSaving}>Cancelar</button>
              <button type="submit" className="ppBtn ppBtnPrimary" disabled={formSaving}>{formSaving ? "Creando..." : "Crear acceso"}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmarDialogo
        abierto={Boolean(confirmacion)}
        titulo={confirmacion?.tipo === "quitar" ? `¿Quitar a ${confirmName} de ${confirmacion?.grupo?.nombre}?` : `¿Desactivar el grupo ${confirmacion?.grupo?.nombre || ""}?`}
        texto={confirmacion?.tipo === "quitar"
          ? "Dejará de salir en la lista de este grupo. Su ficha no se borra."
          : "El grupo dejará de salir en el horario y al pasar lista. Se puede volver a activar desde «Editar grupo»."}
        confirmar={confirmacion?.tipo === "quitar" ? `Quitar a ${confirmName.split(" ")[0]}` : "Desactivar grupo"}
        cancelar={confirmacion?.tipo === "quitar" ? "No, dejarlo" : "No, mantenerlo"}
        ocupado={groupBusy}
        error={confirmError}
        onConfirmar={runConfirmed}
        onCancelar={() => setConfirmacion(null)}
      />

      <AvisoGuardado aviso={aviso} onCerrar={cerrarAviso} />
    </section>
  );
}
