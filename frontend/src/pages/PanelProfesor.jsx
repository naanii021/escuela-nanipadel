import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut } from "../services/api";
import { getToken, getUser, logout } from "../services/auth";
import "./panelProfesor.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];
const NIVELES = ["ninos", "iniciacion", "avanzado", "avanzado_plus", "competicion"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

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

function nivelClass(nivel) {
  return `levelPill level-${String(nivel || "default").replace("_", "-")}`;
}

function initials(nombre, apellidos = "") {
  return `${String(nombre || "A").charAt(0)}${String(apellidos || "").charAt(0)}`.toUpperCase();
}

function normalize(value) {
  return String(value || "").toLowerCase();
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

  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({});
  const [studentToAdd, setStudentToAdd] = useState("");

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

      return matchText && matchNivel && matchProfesor && matchGrupo;
    });
  }, [alumnos, search, nivel, profesor, grupo]);

  const filteredGrupos = useMemo(() => {
    const text = normalize(search);

    return grupos.filter((item) => {
      const alumnosText = (item.alumnos || []).map((alumno) => `${alumno.nombre} ${alumno.apellidos}`).join(" ");
      const matchText = !text || normalize(`${item.nombre} ${item.codigo} ${item.profesor} ${item.pista_habitual} ${alumnosText}`).includes(text);
      const matchNivel = !nivel || item.nivel === nivel;
      const matchProfesor = !profesor || String(item.profesor_id) === String(profesor) || item.profesor === profesor;
      const matchGrupo = !grupo || String(item.id) === String(grupo);

      return matchText && matchNivel && matchProfesor && matchGrupo;
    });
  }, [grupos, search, nivel, profesor, grupo]);

  const selectedGroup = useMemo(
    () => filteredGrupos.find((item) => String(item.id) === String(selectedGroupId)) || filteredGrupos[0] || null,
    [filteredGrupos, selectedGroupId]
  );

  const studentsAvailableForGroup = useMemo(() => {
    if (!selectedGroup) return [];
    const assigned = new Set((selectedGroup.alumnos || []).map((alumno) => String(alumno.id)));
    return (catalogos.alumnos || []).filter((alumno) => !assigned.has(String(alumno.id)));
  }, [catalogos.alumnos, selectedGroup]);

  const hasFilters = search || nivel || profesor || grupo;

  const clearFilters = () => {
    setSearch("");
    setNivel("");
    setProfesor("");
    setGrupo("");
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
        showNotice("Grupo actualizado");
      } else {
        const data = await apiPost("/api/gestion/grupos", groupForm);
        setSelectedGroupId(data.id);
        showNotice("Grupo creado");
      }

      setGroupFormOpen(false);
      await loadPanel();
    } catch (e) {
      setError(e.message || "No se pudo guardar el grupo");
    } finally {
      setSaving(false);
    }
  };

  const deactivateGroup = async (group) => {
    if (!isAdmin || !group) return;
    const confirmed = window.confirm(`Desactivar el grupo "${group.nombre}"?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiDelete(`/api/gestion/grupos/${group.id}`);
      setSelectedGroupId(null);
      showNotice("Grupo desactivado");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No se pudo desactivar el grupo");
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
      showNotice("Alumno anadido al grupo");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No se pudo anadir el alumno");
    } finally {
      setSaving(false);
    }
  };

  const removeStudentFromGroup = async (alumno) => {
    if (!isAdmin || !selectedGroup || !alumno) return;
    const confirmed = window.confirm(`Quitar a ${alumno.nombre} ${alumno.apellidos} del grupo?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiDelete(`/api/gestion/grupos/${selectedGroup.id}/alumnos/${alumno.id}`);
      showNotice("Alumno quitado del grupo");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No se pudo quitar el alumno");
    } finally {
      setSaving(false);
    }
  };

  const openEditStudent = (student) => {
    setSelectedStudent(student);
    setStudentForm({
      nombre: student.nombre || "",
      apellidos: student.apellidos || "",
      nivel: student.nivel || "iniciacion",
      telefono: student.telefono || "",
      email: student.email || "",
      activo: Number(student.activo ?? 1),
    });
    setStudentFormOpen(true);
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selectedStudent) return;

    try {
      setSaving(true);
      await apiPut(`/api/gestion/alumnos/${selectedStudent.id}`, studentForm);
      setStudentFormOpen(false);
      showNotice("Alumno actualizado");
      await loadPanel();
    } catch (e) {
      setError(e.message || "No se pudo guardar el alumno");
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
          <span className="staffEyebrow">Zona privada</span>
          <h1>Gestion de escuela</h1>
          <p>
            {scope === "admin"
              ? "Vista completa y editable de alumnos, grupos y profesorado."
              : "Tus grupos asignados y los alumnos vinculados a tus clases."}
          </p>
        </div>

        <div className="staffSummary">
          <div className="metricCard"><span>Grupos</span><strong>{loading ? "-" : stats.totalGrupos}</strong></div>
          <div className="metricCard"><span>Alumnos</span><strong>{loading ? "-" : stats.totalAlumnos}</strong></div>
          <div className="metricCard"><span>Rol</span><strong>{String(user?.rol || "").toUpperCase()}</strong></div>
        </div>
      </header>

      {notice && <div className="staffNotice">{notice}</div>}

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
          <button className="staffPrimaryBtn" onClick={openNewGroup}>Nuevo grupo</button>
        )}
      </div>

      <div className="staffFilters">
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
          <strong>No se pudo cargar el panel</strong>
          <p>{error}</p>
          <Link to="/login">Volver a iniciar sesion</Link>
        </div>
      )}

      {!loading && !error && activeView === "grupos" && (
        <div className="groupsWorkspace">
          <aside className="groupList" aria-label="Listado de grupos">
            <div className="panelSectionTitle"><h2>Grupos</h2><span>{filteredGrupos.length} resultados</span></div>

            {filteredGrupos.map((item) => (
              <button key={item.id} className={String(selectedGroup?.id) === String(item.id) ? "groupListItem active" : "groupListItem"} data-level={item.nivel || "default"} onClick={() => setSelectedGroupId(item.id)}>
                <span className="groupListTop">
                  <strong>{item.nombre}</strong>
                  <small>{item.alumnos?.length || 0}/{item.cupo || "-"}</small>
                </span>
                <span className="groupListMeta">
                  <span className={nivelClass(item.nivel)}>{nivelLabel(item.nivel)}</span>
                  <span>{formatDias(item.dia1, item.dia2)}</span>
                  <span>{formatHora(item.hora_inicio, item.duracion_min)}</span>
                </span>
              </button>
            ))}

            {filteredGrupos.length === 0 && <div className="staffEmpty">No hay grupos con estos filtros.</div>}
          </aside>

          <main className="groupDetail">
            {selectedGroup ? (
              <>
                <div className="groupDetailHeader">
                  <div className="groupTitleBlock">
                    <span className={nivelClass(selectedGroup.nivel)}>{nivelLabel(selectedGroup.nivel)}</span>
                    <h2>{selectedGroup.nombre}</h2>
                    <p className="groupSubtitle">
                      <span>{selectedGroup.codigo || "Sin codigo"}</span>
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
                  <div><span>Dias</span><strong>{formatDias(selectedGroup.dia1, selectedGroup.dia2)}</strong></div>
                  <div><span>Horario</span><strong>{formatHora(selectedGroup.hora_inicio, selectedGroup.duracion_min)}</strong></div>
                  <div><span>Pista</span><strong>{selectedGroup.pista_habitual || "-"}</strong></div>
                  <div><span>Cupo</span><strong>{selectedGroup.cupo || "-"}</strong></div>
                </div>

                {isAdmin && (
                  <div className="addStudentBar">
                    <select value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)}>
                      <option value="">Anadir alumno existente</option>
                      {studentsAvailableForGroup.map((alumno) => (
                        <option key={alumno.id} value={alumno.id}>{alumno.nombre} {alumno.apellidos} - {nivelLabel(alumno.nivel)}</option>
                      ))}
                    </select>
                    <button onClick={addStudentToGroup} disabled={!studentToAdd || saving}>Anadir alumno</button>
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

                {(!selectedGroup.alumnos || selectedGroup.alumnos.length === 0) && <div className="staffEmpty">Este grupo no tiene alumnos asignados.</div>}
              </>
            ) : (
              <div className="staffEmpty">Selecciona un grupo para ver el detalle.</div>
            )}
          </main>
        </div>
      )}

      {!loading && !error && activeView === "alumnos" && (
        <div className="studentsPanel">
          <div className="panelSectionTitle"><h2>Alumnos</h2><span>{filteredAlumnos.length} resultados</span></div>

          <div className="studentsTable">
            <div className={isAdmin ? "studentsTableHead studentsTableHeadAdmin" : "studentsTableHead"}>
              <span>Alumno</span><span>Nivel</span><span>Grupo</span><span>Profesor</span><span>Horario / pista</span>{isAdmin && <span>Acciones</span>}
            </div>

            {filteredAlumnos.map((alumno) => (
              <article className={isAdmin ? "studentRow studentRowAdmin" : "studentRow"} key={alumno.id}>
                <div className="studentIdentity">
                  <div className="studentMark" data-level={alumno.nivel || "default"}>{initials(alumno.nombre, alumno.apellidos)}</div>
                  <div><strong>{alumno.nombre} {alumno.apellidos}</strong><small>{alumno.telefono || alumno.email || "Sin contacto"}</small></div>
                </div>
                <span className={nivelClass(alumno.nivel)}>{nivelLabel(alumno.nivel)}</span>
                <span className="studentCell">{alumno.grupos || "-"}</span>
                <span className="studentCell">{alumno.profesores || "-"}</span>
                <span className="studentCell">{alumno.horarios || "-"}{alumno.pistas ? ` - Pista ${alumno.pistas}` : ""}</span>
                {isAdmin && <button className="staffSecondaryBtn" onClick={() => openEditStudent(alumno)}>Editar</button>}
              </article>
            ))}
          </div>

          {filteredAlumnos.length === 0 && <div className="staffEmpty">No hay alumnos con estos filtros.</div>}
        </div>
      )}

      {isAdmin && groupFormOpen && (
        <div className="staffModalBackdrop">
          <form className="staffModal" onSubmit={saveGroup}>
            <div className="modalHeader"><h2>{editingGroup ? "Editar grupo" : "Nuevo grupo"}</h2><button type="button" onClick={() => setGroupFormOpen(false)}>Cerrar</button></div>
            <div className="formGrid">
              <label>Nombre<input value={groupForm.nombre} onChange={(e) => setGroupForm({ ...groupForm, nombre: e.target.value })} required /></label>
              <label>Codigo<input value={groupForm.codigo} onChange={(e) => setGroupForm({ ...groupForm, codigo: e.target.value })} /></label>
              <label>Nivel<select value={groupForm.nivel} onChange={(e) => setGroupForm({ ...groupForm, nivel: e.target.value })}>{NIVELES.map((item) => <option key={item} value={item}>{nivelLabel(item)}</option>)}</select></label>
              <label>Profesor<select value={groupForm.profesor_id} onChange={(e) => setGroupForm({ ...groupForm, profesor_id: e.target.value })}><option value="">Sin profesor</option>{profesores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Dia 1<select value={groupForm.dia1} onChange={(e) => setGroupForm({ ...groupForm, dia1: e.target.value })}>{DIAS.map((dia) => <option key={dia} value={dia}>{formatDias(dia)}</option>)}</select></label>
              <label>Dia 2<select value={groupForm.dia2} onChange={(e) => setGroupForm({ ...groupForm, dia2: e.target.value })}><option value="">Sin segundo dia</option>{DIAS.map((dia) => <option key={dia} value={dia}>{formatDias(dia)}</option>)}</select></label>
              <label>Hora<input type="time" value={groupForm.hora_inicio} onChange={(e) => setGroupForm({ ...groupForm, hora_inicio: e.target.value })} /></label>
              <label>Duracion<input type="number" min="30" step="15" value={groupForm.duracion_min} onChange={(e) => setGroupForm({ ...groupForm, duracion_min: Number(e.target.value) })} /></label>
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
            <div className="modalHeader"><h2>Editar alumno</h2><button type="button" onClick={() => setStudentFormOpen(false)}>Cerrar</button></div>
            <div className="formGrid">
              <label>Nombre<input value={studentForm.nombre || ""} onChange={(e) => setStudentForm({ ...studentForm, nombre: e.target.value })} required /></label>
              <label>Apellidos<input value={studentForm.apellidos || ""} onChange={(e) => setStudentForm({ ...studentForm, apellidos: e.target.value })} /></label>
              <label>Nivel<select value={studentForm.nivel || ""} onChange={(e) => setStudentForm({ ...studentForm, nivel: e.target.value })}>{NIVELES.map((item) => <option key={item} value={item}>{nivelLabel(item)}</option>)}</select></label>
              <label>Telefono<input value={studentForm.telefono || ""} onChange={(e) => setStudentForm({ ...studentForm, telefono: e.target.value })} /></label>
              <label>Email<input type="email" value={studentForm.email || ""} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} /></label>
              <label>Activo<select value={studentForm.activo ?? 1} onChange={(e) => setStudentForm({ ...studentForm, activo: Number(e.target.value) })}><option value={1}>Activo</option><option value={0}>Inactivo</option></select></label>
            </div>
            <div className="modalActions"><button type="button" onClick={() => setStudentFormOpen(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar alumno"}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
