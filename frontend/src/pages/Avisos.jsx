import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import { requestNotificationsRefresh } from "../services/notificationEvents";
import "./avisos.css";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "club", label: "Club" },
  { key: "clases", label: "Clases" },
  { key: "reservas", label: "Reservas" },
  { key: "torneos", label: "Torneos" },
  { key: "importantes", label: "Importantes" },
];

const TYPE_OPTIONS = [
  { value: "aviso_club", label: "Aviso del club" },
  { value: "aviso_profesor", label: "Aviso de clase/profesor" },
  { value: "torneo", label: "Torneo" },
  { value: "reserva", label: "Reserva" },
];

const AUDIENCE_OPTIONS = [
  { value: "all_users", label: "Todos los usuarios" },
  { value: "students", label: "Solo alumnos" },
  { value: "professors", label: "Solo profesores" },
  { value: "specific_student", label: "Alumno concreto" },
  { value: "specific_professor", label: "Profesor concreto" },
  { value: "group", label: "Grupo/clase concreta" },
];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function categoryLabel(item) {
  const value = item.category || item.tipo || "";
  if (value.includes("clase") || value.includes("profesor")) return "Clases";
  if (value.includes("reserva")) return "Reservas";
  if (value.includes("torneo")) return "Torneos";
  return "Club";
}

function priorityLabel(priority) {
  if (priority === "urgente") return "Urgente";
  if (priority === "importante") return "Importante";
  return "Normal";
}

const initialForm = {
  title: "",
  body: "",
  type: "aviso_club",
  priority: "normal",
  audience: "all_users",
  groupId: "",
  recipientUserId: "",
  sendInApp: true,
  sendWhatsapp: false,
  starts_at: "",
  expires_at: "",
};

function userLabel(user) {
  if (!user) return "";
  const name = `${user.nombre || ""} ${user.apellidos || ""}`.trim() || user.email || `Usuario ${user.id}`;
  const detail = [user.email, user.grupos].filter(Boolean).join(" - ");
  return detail ? `${name} (${detail})` : name;
}

export default function Avisos() {
  const logged = isLogged();
  const user = getUser();
  const isStaff = ["admin", "profesor", "profe"].includes(String(user?.rol || "").toLowerCase());
  const [filter, setFilter] = useState("todos");
  const [status, setStatus] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({ unread_count: 0, total: 0 });
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [professorSearch, setProfessorSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadNotifications = useCallback(async () => {
    if (!logged) return;
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ limit: "50", filter, status });
      const data = await apiGet(`/api/notificaciones?${params.toString()}`);
      setNotifications(data.notifications || []);
      setSummary({
        unread_count: Number(data.unread_count || 0),
        total: Number(data.total || 0),
      });
    } catch (e) {
      setNotifications([]);
      setSummary({ unread_count: 0, total: 0 });
      setError("No se pudieron cargar las notificaciones. Inténtalo de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  }, [filter, logged, status]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!isStaff) return;
    apiGet("/api/grupos")
      .then((data) => setGroups(data.grupos || []))
      .catch(() => setGroups([]));
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;

    const loadUsers = async () => {
      try {
        const [studentData, professorData] = await Promise.all([
          apiGet("/api/gestion/usuarios?rol=alumno&limit=100"),
          apiGet("/api/gestion/usuarios?rol=profesor&limit=100"),
        ]);
        setStudents(studentData.usuarios || []);
        setProfessors(professorData.usuarios || []);
      } catch {
        setStudents([]);
        setProfessors([]);
      }
    };

    loadUsers();
  }, [isStaff]);

  const activeCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const markAsRead = async (id) => {
    try {
      await apiPatch(`/api/notificaciones/${id}/read`);
      await loadNotifications();
      requestNotificationsRefresh();
    } catch (e) {
      setError("No se pudo actualizar la notificación. Inténtalo de nuevo más tarde.");
    }
  };

  const markAll = async () => {
    try {
      await apiPatch("/api/notificaciones/read-all");
      await loadNotifications();
      requestNotificationsRefresh();
    } catch (e) {
      setError("No se pudieron actualizar las notificaciones. Inténtalo de nuevo más tarde.");
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => {
      if (field === "audience") {
        return { ...current, audience: value, groupId: "", recipientUserId: "" };
      }
      return { ...current, [field]: value };
    });
  };

  const filteredStudents = useMemo(() => {
    const text = studentSearch.trim().toLowerCase();
    if (!text) return students;
    return students.filter((item) => userLabel(item).toLowerCase().includes(text));
  }, [studentSearch, students]);

  const filteredProfessors = useMemo(() => {
    const text = professorSearch.trim().toLowerCase();
    if (!text) return professors;
    return professors.filter((item) => userLabel(item).toLowerCase().includes(text));
  }, [professorSearch, professors]);

  const selectedStudent = students.find((item) => String(item.id) === String(form.recipientUserId));
  const selectedProfessor = professors.find((item) => String(item.id) === String(form.recipientUserId));
  const selectedGroup = groups.find((item) => String(item.id) === String(form.groupId));

  const recipientSummary = useMemo(() => {
    if (form.audience === "all_users") return "Se enviará a: todos los usuarios activos.";
    if (form.audience === "students") return "Se enviará a: todos los alumnos.";
    if (form.audience === "professors") return "Se enviará a: profesores y administración.";
    if (form.audience === "specific_student") {
      return selectedStudent ? `Se enviará a: ${userLabel(selectedStudent)}.` : "Selecciona un alumno.";
    }
    if (form.audience === "specific_professor") {
      return selectedProfessor ? `Se enviará a: ${userLabel(selectedProfessor)}.` : "Selecciona un profesor.";
    }
    if (form.audience === "group") {
      return selectedGroup
        ? `Se enviará a: ${selectedGroup.nombre || selectedGroup.codigo || `Grupo ${selectedGroup.id}`}.`
        : "Selecciona un grupo o clase.";
    }
    return "";
  }, [form.audience, selectedGroup, selectedProfessor, selectedStudent]);

  const submitAviso = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("Título y mensaje son obligatorios.");
      return;
    }

    if (["specific_student", "specific_professor"].includes(form.audience) && !form.recipientUserId) {
      setError("Selecciona un destinatario concreto antes de crear el aviso.");
      return;
    }

    if (form.audience === "group" && !form.groupId) {
      setError("Selecciona un grupo o clase antes de crear el aviso.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");
      const isSpecific = ["specific_student", "specific_professor"].includes(form.audience);
      await apiPost("/api/notificaciones/avisos", {
        ...form,
        audience: isSpecific ? "specific_users" : form.audience,
        groupId: form.audience === "group" ? form.groupId : null,
        grupoId: form.audience === "group" ? form.groupId : null,
        recipientUserIds: isSpecific ? [Number(form.recipientUserId)] : [],
        sendInApp: Boolean(form.sendInApp),
        sendWhatsapp: Boolean(form.sendWhatsapp),
      });
      setForm(initialForm);
      setNotice("Aviso creado correctamente.");
      await loadNotifications();
      requestNotificationsRefresh();
    } catch (e) {
      setError(e.message || "No hemos podido crear el aviso.");
    } finally {
      setSaving(false);
    }
  };

  if (!logged) {
    return (
      <main className="avisosPage">
        <section className="avisosHero">
          <div>
            <span>Centro de avisos</span>
            <h1>Entra para ver tus avisos</h1>
            <p>Los avisos del club, clases, reservas y torneos aparecen asociados a tu cuenta.</p>
          </div>
          <Link className="avisosPrimaryBtn" to="/login">Entrar</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="avisosPage">
      <section className="avisosHero">
        <div>
          <span>Centro de avisos</span>
          <h1>Avisos de NaniPadel</h1>
          <p>Resumen claro de avisos del club, cambios de clase, reservas y torneos.</p>
        </div>
        <div className="avisosHeroStats">
          <div><strong>{summary.unread_count}</strong><small>sin leer</small></div>
          <div><strong>{summary.total}</strong><small>totales</small></div>
        </div>
      </section>

      {isStaff && (
        <section className="avisosComposer">
          <div className="avisosSectionHead">
            <div>
              <span>Gestión</span>
              <h2>Nuevo aviso</h2>
            </div>
            <p>WhatsApp se solicita al backend; nunca se envía desde el navegador.</p>
          </div>

          <form className="avisosForm" onSubmit={submitAviso}>
            <label>Título<input value={form.title} onChange={(e) => updateForm("title", e.target.value)} required /></label>
            <label>Tipo<select value={form.type} onChange={(e) => updateForm("type", e.target.value)}>{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="avisosWide">Mensaje<textarea value={form.body} onChange={(e) => updateForm("body", e.target.value)} rows={4} required /></label>
            <label>Prioridad<select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></label>
            <label>Destinatarios<select value={form.audience} onChange={(e) => updateForm("audience", e.target.value)}>{AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {form.audience === "specific_student" && (
              <div className="avisosRecipientPicker">
                <label>Buscar alumno<input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Nombre, email o grupo" /></label>
                <label>Alumno<select value={form.recipientUserId} onChange={(e) => updateForm("recipientUserId", e.target.value)}><option value="">Seleccionar alumno</option>{filteredStudents.map((student) => <option key={student.id} value={student.id}>{userLabel(student)}</option>)}</select></label>
              </div>
            )}
            {form.audience === "specific_professor" && (
              <div className="avisosRecipientPicker">
                <label>Buscar profesor<input value={professorSearch} onChange={(e) => setProfessorSearch(e.target.value)} placeholder="Nombre o email" /></label>
                <label>Profesor<select value={form.recipientUserId} onChange={(e) => updateForm("recipientUserId", e.target.value)}><option value="">Seleccionar profesor</option>{filteredProfessors.map((professor) => <option key={professor.id} value={professor.id}>{userLabel(professor)}</option>)}</select></label>
              </div>
            )}
            {form.audience === "group" && (
              <label>Grupo<select value={form.groupId} onChange={(e) => updateForm("groupId", e.target.value)}><option value="">Seleccionar grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.nombre || group.codigo || `Grupo ${group.id}`}</option>)}</select></label>
            )}
            <label>Inicio<input type="datetime-local" value={form.starts_at} onChange={(e) => updateForm("starts_at", e.target.value)} /></label>
            <label>Caducidad<input type="datetime-local" value={form.expires_at} onChange={(e) => updateForm("expires_at", e.target.value)} /></label>
            <div className="avisosChecks">
              <label><input type="checkbox" checked={form.sendInApp} onChange={(e) => updateForm("sendInApp", e.target.checked)} /> Notificación interna</label>
              <label><input type="checkbox" checked={form.sendWhatsapp} onChange={(e) => updateForm("sendWhatsapp", e.target.checked)} /> Enviar también por WhatsApp</label>
            </div>
            <div className="avisosSendSummary">
              <strong>{recipientSummary}</strong>
              {form.sendWhatsapp && (
                <span>Solo recibirán WhatsApp los usuarios que tengan número y avisos por WhatsApp activados.</span>
              )}
            </div>
            <button className="avisosPrimaryBtn" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear aviso"}</button>
          </form>
        </section>
      )}

      <section className="avisosBoard">
        <div className="avisosSectionHead">
          <div>
            <span>Tus avisos</span>
            <h2>{activeCount ? `${activeCount} activos` : "Sin pendientes"}</h2>
          </div>
          {summary.unread_count > 0 && <button className="avisosGhostBtn" onClick={markAll}>Marcar todos como leídos</button>}
        </div>

        <div className="avisosFilters">
          {FILTERS.map((item) => (
            <button key={item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>
          ))}
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado de lectura">
            <option value="all">Todos</option>
            <option value="unread">Activos</option>
            <option value="read">Leídos</option>
          </select>
        </div>

        {notice && <p className="avisosSuccess">{notice}</p>}
        {error && <p className="avisosError">{error}</p>}
        {loading && <p className="avisosEmpty">Cargando avisos...</p>}

        {!loading && !error && notifications.length === 0 && (
          <div className="avisosEmpty">
            <strong>No tienes avisos pendientes.</strong>
            <span>Cuando haya novedades del club aparecerán aquí.</span>
          </div>
        )}

        <div className="avisosGrid">
          {notifications.map((item) => (
            <article key={item.id} className={`avisoCard ${item.read_at ? "isRead" : "isUnread"} priority-${item.priority || "normal"}`}>
              <div className="avisoCardTop">
                <span>{categoryLabel(item)}</span>
                <i>{priorityLabel(item.priority)}</i>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div className="avisoMeta">
                <time>{formatDate(item.created_at)}</time>
                <em>{item.read_at ? "Leído" : "Sin leer"}</em>
              </div>
              {!item.read_at && <button onClick={() => markAsRead(item.id)}>Marcar como leído</button>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
