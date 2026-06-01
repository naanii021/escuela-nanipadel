import "./torneos.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import { requestNotificationsRefresh } from "../services/notificationEvents";

const TOURNAMENT_PHOTOS_MANIFEST = `${process.env.PUBLIC_URL}/tournament-photos-manifest.json`;

const CATEGORY_META = {
  adultos: {
    label: "Adultos",
    accentClass: "catAdultos",
  },
  menores: {
    label: "Menores",
    accentClass: "catMenores",
  },
  mixto: {
    label: "Mixto",
    accentClass: "catMixto",
  },
  competicion: {
    label: "Competición",
    accentClass: "catCompeticion",
  },
  liga_interna: {
    label: "Liga interna",
    accentClass: "catLiga",
  },
};

const STATUS_META = {
  borrador: { label: "Borrador", className: "statusDefault" },
  publicado: { label: "Publicado", className: "statusAbierto" },
  abierto: { label: "Abierto", className: "statusAbierto" },
  proximo: { label: "Próximo", className: "statusProximo" },
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
  { key: "competicion", label: "Competición" },
  { key: "liga_interna", label: "Liga" },
];

const TOURNAMENT_FORMATS = [
  {
    key: "americano",
    title: "Americano",
    description: "Formato social con rotación de parejas y puntuación individual.",
    status: "Automatización actual disponible en Gestión",
  },
  {
    key: "mexicano",
    title: "Mexicano",
    description: "Formato dinámico que empareja jugadores según clasificación para crear partidos igualados.",
    status: "Preparado",
  },
  {
    key: "round_robin",
    title: "Liga / Round Robin",
    description: "Todos contra todos. Ideal para torneos de varias jornadas o grupos reducidos.",
    status: "Preparado",
  },
  {
    key: "eliminatoria",
    title: "Eliminatoria",
    description: "Cuadro directo por rondas hasta semifinal y final.",
    status: "Preparado",
  },
  {
    key: "grupos_playoff",
    title: "Grupos + Playoff",
    description: "Primero fase de grupos y después cuadro final con los mejores clasificados.",
    status: "Preparado",
  },
  {
    key: "rey_pista",
    title: "Rey de pista / Pozo",
    description: "Las parejas suben o bajan de pista según el resultado de cada ronda.",
    status: "Preparado",
  },
  {
    key: "beat_the_box",
    title: "Beat the Box",
    description: "Jugadores divididos en grupos pequeños que se reorganizan según rendimiento.",
    status: "Preparado",
  },
  {
    key: "equipos",
    title: "Por equipos",
    description: "Equipos completos compiten entre sí sumando puntos por enfrentamiento.",
    status: "Preparado",
  },
  {
    key: "express",
    title: "Express",
    description: "Torneo rápido de una mañana o una tarde, con partidos cortos.",
    status: "Preparado",
  },
];

const FORMAT_RULE_FIELDS = {
  americano: [
    { key: "numero_rondas", label: "Número de rondas", type: "number", defaultValue: 4 },
    { key: "puntos_por_partido", label: "Puntos por partido", type: "number", defaultValue: 24 },
    { key: "parejas_rotativas", label: "Parejas rotativas", type: "checkbox", defaultValue: true },
    { key: "puntuacion_individual", label: "Puntuación individual", type: "checkbox", defaultValue: true },
  ],
  mexicano: [
    { key: "numero_rondas", label: "Número de rondas", type: "number", defaultValue: 4 },
    { key: "puntos_por_partido", label: "Puntos por partido", type: "number", defaultValue: 24 },
    { key: "emparejamiento_por_clasificacion", label: "Emparejamiento por clasificación", type: "checkbox", defaultValue: true },
  ],
  round_robin: [
    { key: "numero_grupos", label: "Número de grupos", type: "number", defaultValue: 1 },
    { key: "parejas_por_grupo", label: "Parejas por grupo", type: "number", defaultValue: 4 },
    { key: "puntos_victoria", label: "Puntos victoria", type: "number", defaultValue: 3 },
    { key: "puntos_empate", label: "Puntos empate", type: "number", defaultValue: 1 },
    { key: "pasan_por_grupo", label: "Pasan por grupo", type: "number", defaultValue: 2 },
  ],
  eliminatoria: [
    { key: "tamaño_cuadro", label: "Tamaño del cuadro", type: "number", defaultValue: 8 },
    { key: "tercer_cuarto_puesto", label: "Tercer y cuarto puesto", type: "checkbox", defaultValue: false },
  ],
  grupos_playoff: [
    { key: "numero_grupos", label: "Número de grupos", type: "number", defaultValue: 2 },
    { key: "parejas_por_grupo", label: "Parejas por grupo", type: "number", defaultValue: 4 },
    { key: "pasan_por_grupo", label: "Pasan por grupo", type: "number", defaultValue: 2 },
    { key: "tipo_playoff", label: "Tipo de playoff", type: "text", defaultValue: "Semifinales y final" },
  ],
  rey_pista: [
    { key: "numero_rondas", label: "Número de rondas", type: "number", defaultValue: 5 },
    { key: "tiempo_por_ronda", label: "Tiempo por ronda", type: "number", defaultValue: 15 },
    { key: "subir_bajar_pista", label: "Subir / bajar pista", type: "checkbox", defaultValue: true },
  ],
  beat_the_box: [
    { key: "tamaño_box", label: "Tamaño del box", type: "number", defaultValue: 4 },
    { key: "numero_rondas", label: "Número de rondas", type: "number", defaultValue: 4 },
    { key: "subir_bajar_box", label: "Subir / bajar box", type: "checkbox", defaultValue: true },
  ],
  equipos: [
    { key: "numero_equipos", label: "Número de equipos", type: "number", defaultValue: 4 },
    { key: "jugadores_por_equipo", label: "Jugadores por equipo", type: "number", defaultValue: 4 },
    { key: "partidos_por_enfrentamiento", label: "Partidos por enfrentamiento", type: "number", defaultValue: 3 },
  ],
  express: [
    { key: "duracion_total", label: "Duración total", type: "number", defaultValue: 180 },
    { key: "tiempo_por_partido", label: "Tiempo por partido", type: "number", defaultValue: 20 },
    { key: "formato_base", label: "Formato base", type: "text", defaultValue: "americano" },
  ],
};

const emptyTournamentForm = {
  nombre: "",
  descripcion: "",
  categoria: "adultos",
  nivel: "",
  fecha_inicio: new Date().toISOString().slice(0, 10),
  hora_inicio: "",
  fecha_fin: "",
  precio: "",
  plazas_maximas: 16,
  pistas_necesarias: "",
  imagen: "",
  estado: "borrador",
  tipo_torneo: "americano",
};

const emptyAmericanoForm = {
  nombre: "",
  fecha: new Date().toISOString().slice(0, 10),
  categoria: "Judex",
  pistas: "",
  duracion_min: "",
  observaciones: "",
};

const emptyMatchForm = {
  ronda: 1,
  orden: 1,
  equipo_a_alumno_1_id: "",
  equipo_a_alumno_2_id: "",
  equipo_b_alumno_1_id: "",
  equipo_b_alumno_2_id: "",
  puntos_a: 0,
  puntos_b: 0,
  estado: "pendiente",
};

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

function getTorneoImage(torneo) {
  return (
    torneo?.cartel_url ||
    torneo?.cartelUrl ||
    torneo?.cartel ||
    torneo?.imagen_url ||
    torneo?.imagenUrl ||
    torneo?.imagen ||
    torneo?.poster_url ||
    torneo?.posterUrl ||
    ""
  );
}

function getAvailableSlots(torneo) {
  const total = Number(torneo?.max_parejas || 0);
  if (!total) return null;
  return Math.max(total - Number(torneo?.inscritos || 0), 0);
}

function getCapacityText(torneo) {
  const libres = getAvailableSlots(torneo);
  if (libres === null) return `${Number(torneo?.inscritos || 0)} parejas inscritas`;
  if (libres === 0) return "Sin plazas libres";
  return `${libres} plaza${libres === 1 ? "" : "s"} libre${libres === 1 ? "" : "s"}`;
}

function canRegisterTournament(torneo) {
  return torneo?.estado === "abierto" && getAvailableSlots(torneo) !== 0;
}

function getFormatMeta(tipoTorneo) {
  return TOURNAMENT_FORMATS.find((format) => format.key === tipoTorneo) || TOURNAMENT_FORMATS[0];
}

function getTournamentFormatKey(torneo) {
  return torneo?.tipo_torneo || torneo?.tipoTorneo || (torneo?.modalidad === "Americano" ? "americano" : "");
}

function getTournamentFormatLabel(torneo) {
  const formatKey = getTournamentFormatKey(torneo);
  return formatKey ? getFormatMeta(formatKey).title : torneo?.modalidad || "A definir";
}

function buildDefaultRules(tipoTorneo) {
  return (FORMAT_RULE_FIELDS[tipoTorneo] || []).reduce((rules, field) => {
    rules[field.key] = field.defaultValue;
    return rules;
  }, {});
}

function normalizeRuleValue(field, value) {
  if (field.type === "checkbox") return Boolean(value);
  if (field.type === "number") {
    if (value === "") return "";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : field.defaultValue;
  }
  return value;
}

function isClosedTournament(torneo) {
  return ["cerrado", "cancelado", "finalizado", "completo"].includes(torneo?.estado);
}

function isVisibleTournament(torneo) {
  const estado = String(torneo?.estado || "").toLowerCase();
  const nombre = String(torneo?.nombre || "").toLowerCase();
  if (["borrador", "draft", "eliminado", "cancelado"].includes(estado)) return false;
  if (torneo?.es_demo || torneo?.demo || torneo?.mock) return false;
  return !["ejemplo", "demo", "sample"].some((word) => nombre.includes(word));
}

function isValidTournamentPhoto(photo) {
  const value = `${photo?.title || ""} ${photo?.src || ""}`.toLowerCase();
  if (!photo?.src || !/\.(jpe?g|png|webp|avif)$/i.test(photo.src)) return false;
  return !["icono", "logo", "favicon", "web"].some((word) => value.includes(word));
}

function isStaffUser() {
  const role = String(getUser()?.rol || "").toLowerCase();
  return ["admin", "profesor", "profe"].includes(role);
}

function alumnoLabel(alumno) {
  return `${alumno?.nombre || "Alumno"} ${alumno?.apellidos || ""}`.trim();
}

function teamLabel(partido, side) {
  const one = partido[`${side}_1`];
  const two = partido[`${side}_2`];
  return [one, two].filter(Boolean).join(" / ");
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
  const [americanoOpen, setAmericanoOpen] = useState(false);
  const [americanos, setAmericanos] = useState([]);
  const [selectedAmericanoId, setSelectedAmericanoId] = useState("");
  const [americanoDetail, setAmericanoDetail] = useState(null);
  const [alumnosCatalog, setAlumnosCatalog] = useState([]);
  const [americanoForm, setAmericanoForm] = useState(emptyAmericanoForm);
  const [selectedAlumnoIds, setSelectedAlumnoIds] = useState([]);
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [americanoLoading, setAmericanoLoading] = useState(false);
  const [americanoError, setAmericanoError] = useState("");
  const [selectedTorneo, setSelectedTorneo] = useState(null);
  const [adminTab, setAdminTab] = useState("activos");
  const [tournamentForm, setTournamentForm] = useState(emptyTournamentForm);
  const [formatRules, setFormatRules] = useState(() => buildDefaultRules(emptyTournamentForm.tipo_torneo));
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [creatorError, setCreatorError] = useState("");
  const [creatorNotice, setCreatorNotice] = useState("");

  const canManageAmericanos = isStaffUser();
  const selectedFormat = getFormatMeta(tournamentForm.tipo_torneo);
  const selectedFormatFields = FORMAT_RULE_FIELDS[tournamentForm.tipo_torneo] || [];

  const loadTorneos = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await apiGet("/api/torneos");
      if (!data.ok) throw new Error(data.message || "No hemos podido cargar los torneos.");
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

  const loadAmericanos = useCallback(async () => {
    if (!canManageAmericanos) return;

    try {
      setAmericanoLoading(true);
      setAmericanoError("");
      const [americanosData, alumnosData] = await Promise.all([
        apiGet("/api/torneos/americanos"),
        apiGet("/api/torneos/americanos/catalogo/alumnos"),
      ]);
      const nextAmericanos = americanosData.americanos || [];
      setAmericanos(nextAmericanos);
      setAlumnosCatalog(alumnosData.alumnos || []);

      const nextSelectedId = selectedAmericanoId || nextAmericanos[0]?.id || "";
      setSelectedAmericanoId(nextSelectedId ? String(nextSelectedId) : "");
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido cargar los americanos.");
    } finally {
      setAmericanoLoading(false);
    }
  }, [canManageAmericanos, selectedAmericanoId]);

  const loadAmericanoDetail = useCallback(async (americanoId) => {
    if (!canManageAmericanos || !americanoId) {
      setAmericanoDetail(null);
      return;
    }

    try {
      setAmericanoError("");
      const data = await apiGet(`/api/torneos/americanos/${americanoId}`);
      setAmericanoDetail(data);
      setMatchForm((current) => ({
        ...current,
        orden: (data.partidos?.length || 0) + 1,
      }));
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido cargar el americano.");
    }
  }, [canManageAmericanos]);

  useEffect(() => {
    if (americanoOpen) loadAmericanos();
  }, [americanoOpen, loadAmericanos]);

  useEffect(() => {
    if (americanoOpen && selectedAmericanoId) loadAmericanoDetail(selectedAmericanoId);
  }, [americanoOpen, selectedAmericanoId, loadAmericanoDetail]);

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

  const publicTorneos = useMemo(() => torneos.filter(isVisibleTournament), [torneos]);

  const stats = useMemo(() => {
    const abiertos = publicTorneos.filter((t) => t.estado === "abierto").length;
    const proximos = publicTorneos.filter((t) => t.estado === "proximo").length;
    const plazas = publicTorneos.reduce(
      (acc, t) => acc + Math.max(Number(t.max_parejas || 0) - Number(t.inscritos || 0), 0),
      0
    );
    return { total: publicTorneos.length, abiertos, proximos, plazas };
  }, [publicTorneos]);

  const filterCounts = useMemo(() => {
    const counts = { todos: publicTorneos.length };
    for (const key of Object.keys(CATEGORY_META)) counts[key] = 0;
    for (const t of publicTorneos) {
      if (counts[t.categoria] !== undefined) counts[t.categoria] += 1;
    }
    return counts;
  }, [publicTorneos]);

  const filteredTorneos = useMemo(() => {
    if (activeFilter === "todos") return publicTorneos;
    return publicTorneos.filter((t) => t.categoria === activeFilter);
  }, [publicTorneos, activeFilter]);

  const featuredPhotos = tournamentPhotos.filter(isValidTournamentPhoto).slice(0, 4);
  const selectedParticipantIds = useMemo(
    () => new Set((americanoDetail?.participantes || []).map((item) => Number(item.alumno_id))),
    [americanoDetail?.participantes]
  );
  const availableAlumnos = useMemo(
    () => alumnosCatalog.filter((alumno) => !selectedParticipantIds.has(Number(alumno.id))),
    [alumnosCatalog, selectedParticipantIds]
  );
  const participantOptions = americanoDetail?.participantes || [];

  const updateTournamentForm = (field, value) => {
    setTournamentForm((current) => ({ ...current, [field]: value }));
  };

  const selectTournamentFormat = (formatKey) => {
    setTournamentForm((current) => ({ ...current, tipo_torneo: formatKey }));
    setFormatRules(buildDefaultRules(formatKey));
  };

  const updateFormatRule = (field, value, meta) => {
    setFormatRules((current) => ({
      ...current,
      [field]: normalizeRuleValue(meta, value),
    }));
  };

  const createTournament = async (event) => {
    event.preventDefault();

    try {
      setCreatingTournament(true);
      setCreatorError("");
      setCreatorNotice("");

      const formatMeta = getFormatMeta(tournamentForm.tipo_torneo);
      const plazasMaximas = Number(tournamentForm.plazas_maximas) || 16;
      const payload = {
        nombre: tournamentForm.nombre.trim(),
        descripcion: tournamentForm.descripcion.trim() || null,
        categoria: tournamentForm.categoria,
        modalidad: formatMeta.title,
        nivel: tournamentForm.nivel.trim() || null,
        fecha_inicio: tournamentForm.fecha_inicio,
        hora_inicio: tournamentForm.hora_inicio || null,
        fecha_fin: tournamentForm.fecha_fin || null,
        precio: tournamentForm.precio === "" ? 0 : Number(tournamentForm.precio),
        max_parejas: plazasMaximas,
        plazas_maximas: plazasMaximas,
        pistas_necesarias: tournamentForm.pistas_necesarias === "" ? null : Number(tournamentForm.pistas_necesarias),
        cartel_url: tournamentForm.imagen.trim() || null,
        imagen_url: tournamentForm.imagen.trim() || null,
        estado: tournamentForm.estado,
        tipo_torneo: tournamentForm.tipo_torneo,
        configuracion_formato: formatRules,
      };

      const data = await apiPost("/api/torneos", payload);
      if (!data.ok) throw new Error(data.message || "No se ha podido crear el torneo.");

      setTournamentForm(emptyTournamentForm);
      setFormatRules(buildDefaultRules(emptyTournamentForm.tipo_torneo));
      setCreatorNotice("Torneo guardado. Ya aparece en el listado si está publicado.");
      setFeedback("Torneo guardado. Ya aparece en el listado si está publicado.");
      setAdminTab("activos");
      await loadTorneos();
      requestNotificationsRefresh();
    } catch (e) {
      setCreatorError(e.message || "No se ha podido crear el torneo.");
    } finally {
      setCreatingTournament(false);
    }
  };

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
      const data = torneo.inscrito ? await apiPatch(endpoint) : await apiPost(endpoint, {});
      if (!data.ok) throw new Error(data.message || "No hemos podido actualizar tu inscripción.");
      setFeedback(torneo.inscrito ? "Inscripción cancelada." : "Ya estás apuntado al torneo.");
      await loadTorneos();
      requestNotificationsRefresh();
      setSelectedTorneo((current) => {
        if (!current || current.id !== torneo.id) return current;
        const delta = torneo.inscrito ? -1 : 1;
        return {
          ...current,
          inscrito: !torneo.inscrito,
          inscritos: Math.max(Number(current.inscritos || 0) + delta, 0),
        };
      });
    } catch (e) {
      setFeedback(e.message || "No hemos podido actualizar tu inscripción.");
    } finally {
      setActionId(null);
    }
  };

  const createAmericano = async (event) => {
    event.preventDefault();
    try {
      setAmericanoLoading(true);
      setAmericanoError("");
      const data = await apiPost("/api/torneos/americanos", {
        ...americanoForm,
        duracion_min: americanoForm.duracion_min === "" ? null : Number(americanoForm.duracion_min),
      });
      setAmericanoForm(emptyAmericanoForm);
      setSelectedAmericanoId(String(data.id));
      await loadAmericanos();
      await loadAmericanoDetail(data.id);
      setFeedback("Americano creado.");
      requestNotificationsRefresh();
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido crear el americano.");
    } finally {
      setAmericanoLoading(false);
    }
  };

  const addParticipants = async () => {
    if (!selectedAmericanoId || !selectedAlumnoIds.length) return;
    try {
      const data = await apiPost(`/api/torneos/americanos/${selectedAmericanoId}/participantes`, {
        alumno_ids: selectedAlumnoIds.map(Number),
      });
      setAmericanoDetail(data);
      setSelectedAlumnoIds([]);
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido añadir participantes.");
    }
  };

  const removeParticipant = async (alumnoId) => {
    try {
      const data = await apiDelete(`/api/torneos/americanos/${selectedAmericanoId}/participantes/${alumnoId}`);
      setAmericanoDetail(data);
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido quitar el participante.");
    }
  };

  const createMatch = async (event) => {
    event.preventDefault();
    try {
      const data = await apiPost(`/api/torneos/americanos/${selectedAmericanoId}/partidos`, {
        ...matchForm,
        ronda: Number(matchForm.ronda) || null,
        orden: Number(matchForm.orden) || null,
        puntos_a: Number(matchForm.puntos_a) || 0,
        puntos_b: Number(matchForm.puntos_b) || 0,
      });
      setAmericanoDetail(data);
      setMatchForm((current) => ({
        ...emptyMatchForm,
        ronda: current.ronda,
        orden: (data.partidos?.length || 0) + 1,
      }));
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido crear el partido.");
    }
  };

  const updateMatch = async (partidoId, patch) => {
    try {
      const data = await apiPatch(`/api/torneos/americanos/${selectedAmericanoId}/partidos/${partidoId}`, patch);
      setAmericanoDetail(data);
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido guardar el resultado.");
    }
  };

  const deleteMatch = async (partidoId) => {
    try {
      const data = await apiDelete(`/api/torneos/americanos/${selectedAmericanoId}/partidos/${partidoId}`);
      setAmericanoDetail(data);
    } catch (e) {
      setAmericanoError(e.message || "No hemos podido eliminar el partido.");
    }
  };

  return (
    <section className="torneos" aria-label="Torneos del club">
      <div className="torneosShell">
        <section className="torneosHero">
          <div className="torneosHeroCopy">
            <span className="torneosEyebrow">
              <span className="eyebrowDot" aria-hidden="true" />
              Competición del club
            </span>
            <h2 className="torneosTitle">Torneos y jornadas del club</h2>
            <p className="intro">
              Consulta torneos activos, revisa plazas disponibles y apunta a tu pareja cuando haya inscripciones abiertas.
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
              <span>Próximos</span>
              <strong>{stats.proximos}</strong>
            </div>
            <div className="torneosMetricCard" role="listitem">
              <span>Plazas libres</span>
              <strong>{stats.plazas}</strong>
            </div>
          </div>
        </section>

        {canManageAmericanos && (
          <section className="torneosAdminPanel" aria-label="Administración de torneos">
            <div className="torneosAdminHead">
              <div>
                <span className="torneosSectionEyebrow">Administración</span>
                <h3>Torneos del club</h3>
                <p>Crea torneos por formato, publica jornadas y conserva la gestión actual de americanos.</p>
              </div>
              <button type="button" className="adminCreateBtn" onClick={() => setAdminTab("crear")}>
                Crear torneo
              </button>
            </div>

            <div className="torneosAdminTabs" role="tablist" aria-label="Secciones de torneos">
              {[
                ["activos", "Torneos activos"],
                ["crear", "Crear torneo"],
                ["gestion", "Gestión"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={adminTab === key ? "isActive" : ""}
                  onClick={() => setAdminTab(key)}
                  aria-pressed={adminTab === key}
                >
                  {label}
                </button>
              ))}
            </div>

            {adminTab === "activos" && (
              <div className="torneosAdminSummary">
                <article>
                  <span>Publicados</span>
                  <strong>{publicTorneos.length}</strong>
                  <p>Torneos visibles en la página pública.</p>
                </article>
                <article>
                  <span>Con inscripción</span>
                  <strong>{stats.abiertos}</strong>
                  <p>Eventos abiertos ahora mismo.</p>
                </article>
                <article>
                  <span>Formatos</span>
                  <strong>{TOURNAMENT_FORMATS.length}</strong>
                  <p>Americano, mexicano, liga, eliminatoria y más.</p>
                </article>
              </div>
            )}

            {adminTab === "crear" && (
              <form className="tournamentCreator" onSubmit={createTournament}>
                <section className="creatorStep">
                  <div className="creatorStepHead">
                    <span>Paso 1</span>
                    <h4>Datos básicos</h4>
                  </div>
                  <div className="creatorGrid">
                    <label className="creatorField creatorWide">
                      Nombre
                      <input value={tournamentForm.nombre} onChange={(e) => updateTournamentForm("nombre", e.target.value)} placeholder="Torneo primavera NaniPadel" required />
                    </label>
                    <label className="creatorField creatorWide">
                      Descripción
                      <textarea value={tournamentForm.descripcion} onChange={(e) => updateTournamentForm("descripcion", e.target.value)} rows={3} placeholder="Resumen breve para alumnos y jugadores." />
                    </label>
                    <label className="creatorField">
                      Categoría
                      <select value={tournamentForm.categoria} onChange={(e) => updateTournamentForm("categoria", e.target.value)}>
                        {Object.entries(CATEGORY_META).map(([key, meta]) => (
                          <option key={key} value={key}>{meta.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="creatorField">
                      Nivel
                      <input value={tournamentForm.nivel} onChange={(e) => updateTournamentForm("nivel", e.target.value)} placeholder="Todos, medio, avanzado..." />
                    </label>
                    <label className="creatorField">
                      Fecha inicio
                      <input type="date" value={tournamentForm.fecha_inicio} onChange={(e) => updateTournamentForm("fecha_inicio", e.target.value)} required />
                    </label>
                    <label className="creatorField">
                      Hora inicio
                      <input type="time" value={tournamentForm.hora_inicio} onChange={(e) => updateTournamentForm("hora_inicio", e.target.value)} />
                    </label>
                    <label className="creatorField">
                      Fecha fin
                      <input type="date" value={tournamentForm.fecha_fin} onChange={(e) => updateTournamentForm("fecha_fin", e.target.value)} />
                    </label>
                    <label className="creatorField">
                      Precio
                      <input type="number" min="0" step="0.01" value={tournamentForm.precio} onChange={(e) => updateTournamentForm("precio", e.target.value)} placeholder="0" />
                    </label>
                    <label className="creatorField creatorWide">
                      Cartel o imagen
                      <input value={tournamentForm.imagen} onChange={(e) => updateTournamentForm("imagen", e.target.value)} placeholder="URL del cartel si ya está publicado" />
                    </label>
                  </div>
                </section>

                <section className="creatorStep">
                  <div className="creatorStepHead">
                    <span>Paso 2</span>
                    <h4>Elegir formato</h4>
                  </div>
                  <div className="formatSelectorGrid">
                    {TOURNAMENT_FORMATS.map((format) => (
                      <button
                        type="button"
                        key={format.key}
                        className={`formatOptionCard${tournamentForm.tipo_torneo === format.key ? " isSelected" : ""}`}
                        onClick={() => selectTournamentFormat(format.key)}
                      >
                        <strong>{format.title}</strong>
                        <span>{format.description}</span>
                        <em>{format.status}</em>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="creatorStep">
                  <div className="creatorStepHead">
                    <span>Paso 3</span>
                    <h4>Reglas y puntuación</h4>
                  </div>
                  <div className="rulesGrid">
                    {selectedFormatFields.map((field) => (
                      <label key={field.key} className={`creatorField${field.type === "checkbox" ? " ruleCheckbox" : ""}`}>
                        {field.type === "checkbox" ? (
                          <>
                            <input type="checkbox" checked={Boolean(formatRules[field.key])} onChange={(e) => updateFormatRule(field.key, e.target.checked, field)} />
                            <span>{field.label}</span>
                          </>
                        ) : (
                          <>
                            {field.label}
                            <input type={field.type === "number" ? "number" : "text"} value={formatRules[field.key] ?? ""} onChange={(e) => updateFormatRule(field.key, e.target.value, field)} />
                          </>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="formatAutomationNote">
                    {tournamentForm.tipo_torneo === "americano"
                      ? "El americano conserva su gestión actual de participantes, partidos y clasificación en la pestaña Gestión."
                      : "Formato preparado. La generación automática de partidos se añadirá próximamente."}
                  </p>
                </section>

                <section className="creatorStep">
                  <div className="creatorStepHead">
                    <span>Paso 4</span>
                    <h4>Participantes y plazas</h4>
                  </div>
                  <div className="creatorGrid">
                    <label className="creatorField">
                      Plazas máximas
                      <input type="number" min="2" value={tournamentForm.plazas_maximas} onChange={(e) => updateTournamentForm("plazas_maximas", e.target.value)} />
                    </label>
                    <label className="creatorField">
                      Pistas necesarias
                      <input type="number" min="1" value={tournamentForm.pistas_necesarias} onChange={(e) => updateTournamentForm("pistas_necesarias", e.target.value)} placeholder="2" />
                    </label>
                    <label className="creatorField">
                      Estado
                      <select value={tournamentForm.estado} onChange={(e) => updateTournamentForm("estado", e.target.value)}>
                        <option value="borrador">Borrador</option>
                        <option value="publicado">Publicado</option>
                        <option value="abierto">Abierto</option>
                        <option value="cerrado">Cerrado</option>
                        <option value="finalizado">Finalizado</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="creatorStep creatorPublishStep">
                  <div>
                    <div className="creatorStepHead">
                      <span>Paso 5</span>
                      <h4>Publicar</h4>
                    </div>
                    <p>Se guardará como {selectedFormat.title}. Los formatos nuevos quedan listos para gestionar manualmente hasta automatizar partidos.</p>
                  </div>
                  <button type="submit" className="adminCreateBtn" disabled={creatingTournament}>
                    {creatingTournament ? "Guardando..." : "Guardar torneo"}
                  </button>
                </section>

                {creatorError && <div className="creatorError" role="alert">{creatorError}</div>}
                {creatorNotice && <div className="creatorNotice" role="status">{creatorNotice}</div>}
              </form>
            )}
          </section>
        )}

        {canManageAmericanos && adminTab === "gestion" && (
          <section className="americanoPanel" aria-label="Gestión de Americanos y Judex">
            <div className="americanoPanelHead">
              <div>
                <span className="torneosSectionEyebrow">Americanos / Judex</span>
                <h3>Gestión rápida en pista</h3>
                <p>Crea un americano, elige alumnos, anota mini partidos y revisa la clasificación al momento.</p>
              </div>
              <button
                type="button"
                className="americanoToggle"
                onClick={() => setAmericanoOpen((value) => !value)}
              >
                {americanoOpen ? "Ocultar panel" : "Crear americano"}
              </button>
            </div>

            {americanoOpen && (
              <div className="americanoWorkspace">
                <form className="americanoCreateCard" onSubmit={createAmericano}>
                  <div className="americanoCardHead">
                    <strong>Nuevo americano</strong>
                    <span>Evento rápido</span>
                  </div>
                  <div className="americanoFormGrid">
                    <label>Nombre<input value={americanoForm.nombre} onChange={(e) => setAmericanoForm((current) => ({ ...current, nombre: e.target.value }))} placeholder="Judex sub-12 viernes" required /></label>
                    <label>Fecha<input type="date" value={americanoForm.fecha} onChange={(e) => setAmericanoForm((current) => ({ ...current, fecha: e.target.value }))} required /></label>
                    <label>Categoría<input value={americanoForm.categoria} onChange={(e) => setAmericanoForm((current) => ({ ...current, categoria: e.target.value }))} placeholder="Judex" /></label>
                    <label>Pistas<input value={americanoForm.pistas} onChange={(e) => setAmericanoForm((current) => ({ ...current, pistas: e.target.value }))} placeholder="Pista 1 y 2" /></label>
                    <label>Duración<input type="number" min="0" value={americanoForm.duracion_min} onChange={(e) => setAmericanoForm((current) => ({ ...current, duracion_min: e.target.value }))} placeholder="90" /></label>
                    <label className="americanoWide">Observaciones<textarea value={americanoForm.observaciones} onChange={(e) => setAmericanoForm((current) => ({ ...current, observaciones: e.target.value }))} rows={3} placeholder="Niños nivel iniciación, rotaciones cortas..." /></label>
                  </div>
                  <button type="submit" className="americanoPrimaryBtn" disabled={americanoLoading}>{americanoLoading ? "Creando..." : "Crear americano"}</button>
                </form>

                <div className="americanoBoard">
                  <div className="americanoSelector">
                    <label>
                      Americano activo
                      <select value={selectedAmericanoId} onChange={(e) => setSelectedAmericanoId(e.target.value)}>
                        <option value="">Selecciona un americano</option>
                        {americanos.map((item) => (
                          <option key={item.id} value={item.id}>{item.nombre} - {formatFecha(item.fecha)}</option>
                        ))}
                      </select>
                    </label>
                    {americanoDetail?.americano && (
                      <div className="americanoMiniStats">
                        <span>{americanoDetail.participantes?.length || 0} alumnos</span>
                        <span>{americanoDetail.partidos?.length || 0} partidos</span>
                        <span>{americanoDetail.americano.categoria}</span>
                      </div>
                    )}
                  </div>

                  {americanoError && <div className="americanoError">{americanoError}</div>}

                  {americanoDetail?.americano ? (
                    <div className="americanoDetailGrid">
                      <section className="americanoCard participantesCard">
                        <div className="americanoCardHead">
                          <strong>Participantes</strong>
                          <span>Selecciona hasta 10 o los que necesites</span>
                        </div>
                        <div className="alumnoPicker">
                          <select multiple value={selectedAlumnoIds} onChange={(e) => setSelectedAlumnoIds(Array.from(e.target.selectedOptions).map((option) => option.value))}>
                            {availableAlumnos.map((alumno) => (
                              <option key={alumno.id} value={alumno.id}>{alumnoLabel(alumno)}</option>
                            ))}
                          </select>
                          <button type="button" className="americanoSecondaryBtn" onClick={addParticipants} disabled={!selectedAlumnoIds.length}>Añadir seleccionados</button>
                        </div>
                        <div className="participantesList">
                          {(americanoDetail.participantes || []).map((item) => (
                            <span key={item.alumno_id}>
                              {item.nombre}
                              <button type="button" onClick={() => removeParticipant(item.alumno_id)} aria-label={`Quitar ${item.nombre}`}>x</button>
                            </span>
                          ))}
                          {!americanoDetail.participantes?.length && <p>Aún no hay participantes.</p>}
                        </div>
                      </section>

                      <section className="americanoCard rankingCard">
                        <div className="americanoCardHead">
                          <strong>Clasificación</strong>
                          <span>Ordenada automáticamente</span>
                        </div>
                        <div className="rankingTable">
                          {(americanoDetail.clasificacion || []).map((row, index) => (
                            <div className="rankingRow" key={row.alumno_id}>
                              <strong>{index + 1}</strong>
                              <span>{row.nombre}</span>
                              <em>{row.puntos} pts</em>
                              <small>{row.partidos} PJ · {row.victorias} V · Dif {row.diferencia}</small>
                            </div>
                          ))}
                          {!americanoDetail.clasificacion?.length && <p>La clasificación aparecerá al añadir alumnos.</p>}
                        </div>
                      </section>

                      <section className="americanoCard partidosCard">
                        <div className="americanoCardHead">
                          <strong>Mini partidos</strong>
                          <span>Creación manual preparada para automatizar después</span>
                        </div>

                        <form className="matchForm" onSubmit={createMatch}>
                          <input type="number" min="1" value={matchForm.ronda} onChange={(e) => setMatchForm((current) => ({ ...current, ronda: e.target.value }))} aria-label="Ronda" />
                          <input type="number" min="1" value={matchForm.orden} onChange={(e) => setMatchForm((current) => ({ ...current, orden: e.target.value }))} aria-label="Orden" />
                          {["equipo_a_alumno_1_id", "equipo_a_alumno_2_id", "equipo_b_alumno_1_id", "equipo_b_alumno_2_id"].map((field) => (
                            <select key={field} value={matchForm[field]} onChange={(e) => setMatchForm((current) => ({ ...current, [field]: e.target.value }))} required={field.endsWith("_1_id")}>
                              <option value="">{field.includes("_a_") ? "Equipo A" : "Equipo B"}</option>
                              {participantOptions.map((item) => <option key={`${field}-${item.alumno_id}`} value={item.alumno_id}>{item.nombre}</option>)}
                            </select>
                          ))}
                          <button type="submit" className="americanoPrimaryBtn">Crear partido</button>
                        </form>

                        <div className="matchList">
                          {(americanoDetail.partidos || []).map((partido) => (
                            <article className="matchCard" key={partido.id}>
                              <div>
                                <span>Ronda {partido.ronda || "-"} · Partido {partido.orden || partido.id}</span>
                                <strong>{teamLabel(partido, "equipo_a")} vs {teamLabel(partido, "equipo_b")}</strong>
                              </div>
                              <div className="scoreEditor">
                                <input type="number" value={partido.puntos_a} onChange={(e) => updateMatch(partido.id, { puntos_a: Number(e.target.value), estado: "jugado" })} aria-label="Puntos equipo A" />
                                <span>-</span>
                                <input type="number" value={partido.puntos_b} onChange={(e) => updateMatch(partido.id, { puntos_b: Number(e.target.value), estado: "jugado" })} aria-label="Puntos equipo B" />
                                <button type="button" onClick={() => updateMatch(partido.id, { estado: "jugado" })}>Guardar</button>
                                <button type="button" className="matchDeleteBtn" onClick={() => deleteMatch(partido.id)}>Eliminar</button>
                              </div>
                            </article>
                          ))}
                          {!americanoDetail.partidos?.length && <p>No hay mini partidos creados todavía.</p>}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="americanoEmpty">Crea o selecciona un americano para empezar a gestionarlo.</div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && !err && (
          <section className="torneosControlBar">
            <div className="torneosControlHead">
              <div>
                <span className="torneosSectionEyebrow">Inscripciones</span>
                <h3>Torneos activos y próximos</h3>
              </div>
              <p>Filtra por categoría y revisa fechas, plazas y estado de cada torneo.</p>
            </div>

            <nav className="torneosFilters" aria-label="Filtrar torneos por categoría">
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
              ? "No hay torneos en esta categoría por ahora."
              : "Aún no hay torneos publicados. Cuando el club abra uno, aparecerá aquí."}
          </div>
        )}

        {!loading && !err && filteredTorneos.length > 0 && (
          <section className="torneosPrimaryBlock">
            <div className="torneosGrid">
              {filteredTorneos.map((torneo, index) => {
                const category = getCategoryMeta(torneo.categoria);
                const status = getStatusMeta(torneo.estado);
                const occupancy = occupancyMeta(torneo.inscritos, torneo.max_parejas);
                const isClosed = isClosedTournament(torneo);

                return (
                  <article
                    className={`torneoCard ${category.accentClass}`}
                    key={torneo.id}
                    style={{ "--i": index }}
                    onClick={() => setSelectedTorneo(torneo)}
                    aria-label={`Torneo: ${torneo.nombre}`}
                  >
                    <div className="torneoMedia">
                      {getTorneoImage(torneo) ? (
                        <img src={getTorneoImage(torneo)} alt={`Cartel de ${torneo.nombre}`} loading="lazy" />
                      ) : (
                        <div className="torneoPosterFallback" aria-hidden="true">
                          <span>{category.label}</span>
                          <strong>NaniPadel</strong>
                        </div>
                      )}
                      <div className="torneoBadges">
                        <span className={`torneoBadge torneoCategoria ${category.accentClass}`}>
                          {category.label}
                        </span>
                        <span className={`torneoBadge torneoEstado ${status.className}`}>
                          {status.label}
                        </span>
                        <span className="torneoBadge torneoFormatBadge">
                          {getTournamentFormatLabel(torneo)}
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
                          <span className="metaLabel">Formato</span>
                          <strong>{getTournamentFormatLabel(torneo)}</strong>
                        </div>
                      </div>

                      {(torneo.edad_min || torneo.edad_max) && (
                        <div className="torneoDetails">
                          <span className="detailChip">
                            Edad {torneo.edad_min || "?"} - {torneo.edad_max || "?"} años
                          </span>
                        </div>
                      )}

                      <div className="torneoCapacity">
                        <div className="capacityRow">
                          <span>Plazas</span>
                          <strong>{getCapacityText(torneo)}</strong>
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

                      <div className="torneoActions">
                        <button
                          type="button"
                          className="btnTorneo btnTorneoGhost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTorneo(torneo);
                          }}
                        >
                          Ver detalles
                        </button>
                        {canRegisterTournament(torneo) || torneo.inscrito ? (
                          <button
                            type="button"
                            className={`btnTorneo${torneo.inscrito ? " isSubscribed" : ""}`}
                            disabled={actionId === torneo.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleInscripcion(torneo);
                            }}
                            aria-busy={actionId === torneo.id}
                          >
                            {actionId === torneo.id
                              ? "Procesando..."
                              : torneo.inscrito
                                ? "Cancelar"
                                : "Inscribirme"}
                          </button>
                        ) : (
                          <button type="button" className="btnTorneo" disabled onClick={(event) => event.stopPropagation()}>
                            {isClosed ? "No disponible" : "Ver disponibilidad"}
                          </button>
                        )}
                      </div>
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
              <p>Momentos de competición y ambiente de club.</p>
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

        {selectedTorneo && (
          <div className="torneoModalBackdrop" role="presentation" onClick={() => setSelectedTorneo(null)}>
            <section
              className="torneoModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="torneo-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="torneoModalClose" onClick={() => setSelectedTorneo(null)} aria-label="Cerrar detalle">
                x
              </button>
              <div className="torneoModalMedia">
                {getTorneoImage(selectedTorneo) ? (
                  <img src={getTorneoImage(selectedTorneo)} alt={`Cartel de ${selectedTorneo.nombre}`} />
                ) : (
                  <div className="torneoPosterFallback" aria-hidden="true">
                    <span>{getCategoryMeta(selectedTorneo.categoria).label}</span>
                    <strong>NaniPadel</strong>
                  </div>
                )}
              </div>
              <div className="torneoModalBody">
                <div className="torneoModalHead">
                  <div>
                    <span className={`torneoBadge torneoCategoria ${getCategoryMeta(selectedTorneo.categoria).accentClass}`}>
                      {getCategoryMeta(selectedTorneo.categoria).label}
                    </span>
                    <h3 id="torneo-modal-title">{selectedTorneo.nombre}</h3>
                  </div>
                  <span className={`torneoBadge torneoEstado ${getStatusMeta(selectedTorneo.estado).className}`}>
                    {getStatusMeta(selectedTorneo.estado).label}
                  </span>
                </div>
                <p>{selectedTorneo.descripcion || "El club publicará más información de este torneo próximamente."}</p>
                <div className="torneoModalMeta">
                  <div><span>Fecha</span><strong>{formatFecha(selectedTorneo.fecha_inicio)}</strong></div>
                  <div><span>Hora</span><strong>{formatHora(selectedTorneo.hora_inicio)}</strong></div>
                  <div><span>Categoría</span><strong>{getCategoryMeta(selectedTorneo.categoria).label}</strong></div>
                  <div><span>Formato</span><strong>{getTournamentFormatLabel(selectedTorneo)}</strong></div>
                  <div><span>Precio</span><strong>{formatPrecio(selectedTorneo.precio)}</strong></div>
                  <div><span>Nivel</span><strong>{selectedTorneo.nivel || "Todos"}</strong></div>
                  <div><span>Plazas</span><strong>{getCapacityText(selectedTorneo)}</strong></div>
                </div>
                {canRegisterTournament(selectedTorneo) || selectedTorneo.inscrito ? (
                  <button
                    type="button"
                    className={`btnTorneo${selectedTorneo.inscrito ? " isSubscribed" : ""}`}
                    disabled={actionId === selectedTorneo.id}
                    onClick={() => handleInscripcion(selectedTorneo)}
                  >
                    {actionId === selectedTorneo.id
                      ? "Procesando..."
                      : selectedTorneo.inscrito
                        ? "Cancelar inscripción"
                        : "Inscribirme"}
                  </button>
                ) : (
                  <div className="torneoModalNotice">Inscripciones no disponibles.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

export default Torneos;
