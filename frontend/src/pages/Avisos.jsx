import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import { requestNotificationsRefresh } from "../services/notificationEvents";
import "./avisos.css";

const FILTERS = [
  { key: "todos", label: "Todos", filter: "todos", status: "all" },
  { key: "sin_leer", label: "Sin leer", filter: "todos", status: "unread" },
  { key: "leidos", label: "Leídos", filter: "todos", status: "read" },
  { key: "clases", label: "Clases", filter: "clases", status: "all" },
  { key: "reservas", label: "Reservas", filter: "reservas", status: "all" },
  { key: "club", label: "Club", filter: "club", status: "all" },
  { key: "torneos", label: "Torneos", filter: "torneos", status: "all" },
  { key: "importantes", label: "Importantes", filter: "importantes", status: "all" },
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

function timeAgo(value) {
  if (!value) return "";
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Ahora mismo";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return formatDate(value);
}

const ICON_PATHS = {
  Clases: <><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5" /></>,
  Reservas: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  Torneos: <><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6" /></>,
  Club: <><path d="M4 10v4h3l6 4V6L7 10H4z" /><path d="M16.5 9a4 4 0 010 6" /></>,
};

function CategoryIcon({ label }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[label] || ICON_PATHS.Club}
    </svg>
  );
}

const isImportant = (item) => item.priority === "urgente" || item.priority === "importante";

function categoryLabel(item) {
  const value = item.category || item.tipo || "";
  if (value.includes("clase") || value.includes("profesor")) return "Clases";
  if (value.includes("reserva")) return "Reservas";
  if (value.includes("torneo")) return "Torneos";
  return "Club";
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
  const [tab, setTab] = useState("todos");
  const [expanded, setExpanded] = useState({});
  const [loaded, setLoaded] = useState(false);
  const { filter, status } = FILTERS.find((item) => item.key === tab) || FILTERS[0];
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
      setLoaded(true);
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

  // Los avisos importantes sin leer van arriba; el resto, por fecha.
  const sorted = useMemo(() => {
    const rank = (item) => (!item.read_at && isImportant(item) ? 0 : 1);
    return [...notifications].sort(
      (a, b) => rank(a) - rank(b) || new Date(b.created_at) - new Date(a.created_at)
    );
  }, [notifications]);

  const markAsRead = async (id) => {
    // Cambio inmediato en pantalla; si falla, se recarga el estado real.
    const now = new Date().toISOString();
    setNotifications((list) => list.map((item) => (item.id === id ? { ...item, read_at: now } : item)));
    setSummary((current) => ({ ...current, unread_count: Math.max(0, current.unread_count - 1) }));
    try {
      await apiPatch(`/api/notificaciones/${id}/read`);
      requestNotificationsRefresh();
      if (status === "unread") await new Promise((resolve) => setTimeout(resolve, 600));
      await loadNotifications();
    } catch (e) {
      setError("No se pudo marcar el aviso como leído. Inténtalo de nuevo más tarde.");
      await loadNotifications();
    }
  };

  const markAll = async () => {
    try {
      await apiPatch("/api/notificaciones/read-all");
      await loadNotifications();
      requestNotificationsRefresh();
    } catch (e) {
      setError("No se pudieron marcar los avisos como leídos. Inténtalo de nuevo más tarde.");
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
      <main className="avPage">
        <section className="avGate">
          <span className="avGateIcon" aria-hidden="true"><CategoryIcon label="Club" /></span>
          <h1>Tus avisos del club</h1>
          <p>Para ver los avisos de tus clases, reservas y torneos, entra con tu cuenta.</p>
          <Link className="avBtn avBtnPrimary" to="/login">Entrar con mi cuenta</Link>
        </section>
      </main>
    );
  }

  const unread = summary.unread_count;
  const currentFilter = FILTERS.find((item) => item.key === tab) || FILTERS[0];
  const emptyText = tab === "sin_leer"
    ? ["¡Todo al día!", "No tienes avisos sin leer."]
    : tab === "todos"
      ? ["No tienes avisos.", "Cuando el club te escriba, lo verás aquí."]
      : [`No hay avisos en «${currentFilter.label}».`, "Prueba con «Todos» para ver el resto."];

  return (
    <main className="avPage">
      <header className="avHead">
        <div>
          <h1>Avisos</h1>
          <p className="avLead">
            {unread > 0
              ? <><strong>{unread}</strong> {unread === 1 ? "aviso sin leer" : "avisos sin leer"}</>
              : "Estás al día. No tienes avisos sin leer."}
          </p>
        </div>
        {unread > 0 && (
          <button type="button" className="avBtn avBtnSoft" onClick={markAll}>
            Marcar todo como leído
          </button>
        )}
      </header>

      {isStaff && (
        <details className="avComposer">
          <summary>
            <span>Escribir un aviso nuevo</span>
            <small>Solo equipo del club</small>
          </summary>
          <p className="avComposerNote">WhatsApp se solicita al backend; nunca se envía desde el navegador.</p>
        <form className="avForm" onSubmit={submitAviso}>
            <label>Título<input value={form.title} onChange={(e) => updateForm("title", e.target.value)} required /></label>
            <label>Tipo<select value={form.type} onChange={(e) => updateForm("type", e.target.value)}>{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="avWide">Mensaje<textarea value={form.body} onChange={(e) => updateForm("body", e.target.value)} rows={4} required /></label>
            <label>Prioridad<select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></label>
            <label>Destinatarios<select value={form.audience} onChange={(e) => updateForm("audience", e.target.value)}>{AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {form.audience === "specific_student" && (
              <div className="avRecipient">
                <label>Buscar alumno<input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Nombre, email o grupo" /></label>
                <label>Alumno<select value={form.recipientUserId} onChange={(e) => updateForm("recipientUserId", e.target.value)}><option value="">Seleccionar alumno</option>{filteredStudents.map((student) => <option key={student.id} value={student.id}>{userLabel(student)}</option>)}</select></label>
              </div>
            )}
            {form.audience === "specific_professor" && (
              <div className="avRecipient">
                <label>Buscar profesor<input value={professorSearch} onChange={(e) => setProfessorSearch(e.target.value)} placeholder="Nombre o email" /></label>
                <label>Profesor<select value={form.recipientUserId} onChange={(e) => updateForm("recipientUserId", e.target.value)}><option value="">Seleccionar profesor</option>{filteredProfessors.map((professor) => <option key={professor.id} value={professor.id}>{userLabel(professor)}</option>)}</select></label>
              </div>
            )}
            {form.audience === "group" && (
              <label>Grupo<select value={form.groupId} onChange={(e) => updateForm("groupId", e.target.value)}><option value="">Seleccionar grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.nombre || group.codigo || `Grupo ${group.id}`}</option>)}</select></label>
            )}
            <label>Inicio<input type="datetime-local" value={form.starts_at} onChange={(e) => updateForm("starts_at", e.target.value)} /></label>
            <label>Caducidad<input type="datetime-local" value={form.expires_at} onChange={(e) => updateForm("expires_at", e.target.value)} /></label>
            <div className="avChecks">
              <label><input type="checkbox" checked={form.sendInApp} onChange={(e) => updateForm("sendInApp", e.target.checked)} /> Notificación interna</label>
              <label><input type="checkbox" checked={form.sendWhatsapp} onChange={(e) => updateForm("sendWhatsapp", e.target.checked)} /> Enviar también por WhatsApp</label>
            </div>
            <div className="avSummary">
              <strong>{recipientSummary}</strong>
              {form.sendWhatsapp && (
                <span>Solo recibirán WhatsApp los usuarios que tengan número y avisos por WhatsApp activados.</span>
              )}
            </div>
            <button className="avBtn avBtnPrimary" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear aviso"}</button>
          </form>
        </details>
      )}

      <div className="avFilters" role="group" aria-label="Filtrar avisos">
        {FILTERS.map((item) => (
          <button key={item.key} type="button" className={tab === item.key ? "active" : ""} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {notice && <p className="avMsg avMsgOk" role="status">{notice}</p>}
        {error && <p className="avMsg avMsgError" role="alert">{error}</p>}
      </div>

      {!loaded && loading && (
        <div className="avList" aria-busy="true" aria-label="Cargando avisos">
          {[0, 1, 2].map((n) => <div key={n} className="avCard avSkeleton" />)}
        </div>
      )}

      {loaded && !loading && !error && sorted.length === 0 && (
        <div className="avEmpty">
          <span aria-hidden="true"><CategoryIcon label="Club" /></span>
          <strong>{emptyText[0]}</strong>
          <p>{emptyText[1]}</p>
        </div>
      )}

      <ul className="avList">
        {sorted.map((item, index) => {
          const label = categoryLabel(item);
          const unreadItem = !item.read_at;
          const important = isImportant(item);
          const long = (item.body || "").length > 120;
          const open = Boolean(expanded[item.id]);
          return (
            <li
              key={item.id}
              style={{ "--i": Math.min(index, 8) }}
              className={`avCard ${unreadItem ? "isUnread" : "isRead"} cat-${label.toLowerCase()} priority-${item.priority || "normal"}`}
            >
              <span className="avIcon" aria-hidden="true"><CategoryIcon label={label} /></span>
              <div className="avBody">
                <div className="avTags">
                  <span className="avCat">{label}</span>
                  {important && <span className="avPrio">{item.priority === "urgente" ? "Urgente" : "Importante"}</span>}
                  {unreadItem && <span className="avNew">Nuevo</span>}
                </div>
                <h2>{item.title}</h2>
                <p className={open ? "open" : ""}>{item.body}</p>
                {long && (
                  <button type="button" className="avLink" aria-expanded={open} onClick={() => setExpanded((cur) => ({ ...cur, [item.id]: !open }))}>
                    {open ? "Ver menos" : "Leer completo"}
                  </button>
                )}
                <div className="avFoot">
                  <time dateTime={item.created_at} title={formatDate(item.created_at)}>{timeAgo(item.created_at)}</time>
                  {unreadItem
                    ? <button type="button" className="avBtn avBtnSoft avRead" onClick={() => markAsRead(item.id)}>Marcar como leído</button>
                    : <span className="avDone">Leído</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
