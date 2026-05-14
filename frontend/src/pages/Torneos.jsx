import "./torneos.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { getToken, getUser, isLogged } from "../services/auth";

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const TOURNAMENT_PHOTOS_MANIFEST = `${process.env.PUBLIC_URL}/tournament-photos-manifest.json`;

const CATEGORY_META = {
  adultos: {
    label: "Adultos",
    accentClass: "catAdultos",
    image:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
  },
  menores: {
    label: "Menores",
    accentClass: "catMenores",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
  },
  mixto: {
    label: "Mixto",
    accentClass: "catMixto",
    image:
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
  },
  competicion: {
    label: "Competicion",
    accentClass: "catCompeticion",
    image:
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
  },
  liga_interna: {
    label: "Liga interna",
    accentClass: "catLiga",
    image:
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80",
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
      image:
        "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
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

  const canManageAmericanos = isStaffUser();

  const loadTorneos = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const headers = { Accept: "application/json" };
      if (isLogged()) headers.Authorization = `Bearer ${getToken()}`;
      const res = await fetch(`${API_BASE}/api/torneos`, { headers });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "No hemos podido cargar los torneos.");
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

  const featuredPhotos = tournamentPhotos.slice(0, 4);
  const selectedParticipantIds = useMemo(
    () => new Set((americanoDetail?.participantes || []).map((item) => Number(item.alumno_id))),
    [americanoDetail?.participantes]
  );
  const availableAlumnos = useMemo(
    () => alumnosCatalog.filter((alumno) => !selectedParticipantIds.has(Number(alumno.id))),
    [alumnosCatalog, selectedParticipantIds]
  );
  const participantOptions = americanoDetail?.participantes || [];

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
      if (!res.ok || !data.ok) throw new Error(data.message || "No hemos podido actualizar tu inscripcion.");
      setFeedback(torneo.inscrito ? "Inscripcion cancelada." : "Ya estas apuntado al torneo.");
      await loadTorneos();
    } catch (e) {
      setFeedback(e.message || "No hemos podido actualizar tu inscripcion.");
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
      setAmericanoError(e.message || "No hemos podido anadir participantes.");
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
              Competicion del club
            </span>
            <h2 className="torneosTitle">Torneos y jornadas del club</h2>
            <p className="intro">
              Consulta torneos activos, revisa plazas disponibles y apunta tu pareja cuando haya inscripciones abiertas.
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
              <span>Proximos</span>
              <strong>{stats.proximos}</strong>
            </div>
            <div className="torneosMetricCard" role="listitem">
              <span>Plazas libres</span>
              <strong>{stats.plazas}</strong>
            </div>
          </div>
        </section>

        {canManageAmericanos && (
          <section className="americanoPanel" aria-label="Gestion de Americanos y Judex">
            <div className="americanoPanelHead">
              <div>
                <span className="torneosSectionEyebrow">Americanos / Judex</span>
                <h3>Gestion rapida en pista</h3>
                <p>Crea un americano, elige alumnos, anota mini partidos y revisa la clasificacion al momento.</p>
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
                    <span>Evento rapido</span>
                  </div>
                  <div className="americanoFormGrid">
                    <label>Nombre<input value={americanoForm.nombre} onChange={(e) => setAmericanoForm((current) => ({ ...current, nombre: e.target.value }))} placeholder="Judex sub-12 viernes" required /></label>
                    <label>Fecha<input type="date" value={americanoForm.fecha} onChange={(e) => setAmericanoForm((current) => ({ ...current, fecha: e.target.value }))} required /></label>
                    <label>Categoria<input value={americanoForm.categoria} onChange={(e) => setAmericanoForm((current) => ({ ...current, categoria: e.target.value }))} placeholder="Judex" /></label>
                    <label>Pistas<input value={americanoForm.pistas} onChange={(e) => setAmericanoForm((current) => ({ ...current, pistas: e.target.value }))} placeholder="Pista 1 y 2" /></label>
                    <label>Duracion<input type="number" min="0" value={americanoForm.duracion_min} onChange={(e) => setAmericanoForm((current) => ({ ...current, duracion_min: e.target.value }))} placeholder="90" /></label>
                    <label className="americanoWide">Observaciones<textarea value={americanoForm.observaciones} onChange={(e) => setAmericanoForm((current) => ({ ...current, observaciones: e.target.value }))} rows={3} placeholder="Niños nivel iniciacion, rotaciones cortas..." /></label>
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
                          <button type="button" className="americanoSecondaryBtn" onClick={addParticipants} disabled={!selectedAlumnoIds.length}>Anadir seleccionados</button>
                        </div>
                        <div className="participantesList">
                          {(americanoDetail.participantes || []).map((item) => (
                            <span key={item.alumno_id}>
                              {item.nombre}
                              <button type="button" onClick={() => removeParticipant(item.alumno_id)} aria-label={`Quitar ${item.nombre}`}>x</button>
                            </span>
                          ))}
                          {!americanoDetail.participantes?.length && <p>Aun no hay participantes.</p>}
                        </div>
                      </section>

                      <section className="americanoCard rankingCard">
                        <div className="americanoCardHead">
                          <strong>Clasificacion</strong>
                          <span>Ordenada automaticamente</span>
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
                          {!americanoDetail.clasificacion?.length && <p>La clasificacion aparecera al anadir alumnos.</p>}
                        </div>
                      </section>

                      <section className="americanoCard partidosCard">
                        <div className="americanoCardHead">
                          <strong>Mini partidos</strong>
                          <span>Creacion manual preparada para automatizar despues</span>
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
                          {!americanoDetail.partidos?.length && <p>No hay mini partidos creados todavia.</p>}
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
                <h3>Torneos activos y proximos</h3>
              </div>
              <p>Filtra por categoria y revisa fechas, plazas y estado de cada torneo.</p>
            </div>

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
              ? "No hay torneos en esta categoria por ahora."
              : "Aun no hay torneos publicados. Cuando el club abra uno, aparecera aqui."}
          </div>
        )}

        {!loading && !err && filteredTorneos.length > 0 && (
          <section className="torneosPrimaryBlock">
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
                              : "Apuntarme"}
                      </button>
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
              <p>Momentos de competicion y ambiente de club.</p>
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
      </div>
    </section>
  );
}

export default Torneos;
