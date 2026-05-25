import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { getUser, isLogged } from "../services/auth";
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
  { value: "staff", label: "Admin/profesores" },
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
  sendInApp: true,
  sendWhatsapp: false,
  starts_at: "",
  expires_at: "",
};

export default function Avisos() {
  const logged = isLogged();
  const user = getUser();
  const isStaff = ["admin", "profesor", "profe"].includes(String(user?.rol || "").toLowerCase());
  const [filter, setFilter] = useState("todos");
  const [status, setStatus] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({ unread_count: 0, total: 0 });
  const [groups, setGroups] = useState([]);
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

  const activeCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const markAsRead = async (id) => {
    try {
      await apiPatch(`/api/notificaciones/${id}/read`);
      await loadNotifications();
    } catch (e) {
      setError("No se pudo actualizar la notificación. Inténtalo de nuevo más tarde.");
    }
  };

  const markAll = async () => {
    try {
      await apiPatch("/api/notificaciones/read-all");
      await loadNotifications();
    } catch (e) {
      setError("No se pudieron actualizar las notificaciones. Inténtalo de nuevo más tarde.");
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitAviso = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      await apiPost("/api/notificaciones/avisos", {
        ...form,
        groupId: form.audience === "group" ? form.groupId : null,
        sendInApp: Boolean(form.sendInApp),
        sendWhatsapp: Boolean(form.sendWhatsapp),
      });
      setForm(initialForm);
      setNotice("Aviso creado correctamente.");
      await loadNotifications();
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
              <span>Gestion</span>
              <h2>Nuevo aviso</h2>
            </div>
            <p>WhatsApp se solicita al backend; nunca se envia desde el navegador.</p>
          </div>

          <form className="avisosForm" onSubmit={submitAviso}>
            <label>Titulo<input value={form.title} onChange={(e) => updateForm("title", e.target.value)} required /></label>
            <label>Tipo<select value={form.type} onChange={(e) => updateForm("type", e.target.value)}>{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="avisosWide">Mensaje<textarea value={form.body} onChange={(e) => updateForm("body", e.target.value)} rows={4} required /></label>
            <label>Prioridad<select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></label>
            <label>Destinatarios<select value={form.audience} onChange={(e) => updateForm("audience", e.target.value)}>{AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {form.audience === "group" && (
              <label>Grupo<select value={form.groupId} onChange={(e) => updateForm("groupId", e.target.value)}><option value="">Seleccionar grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.nombre || group.codigo || `Grupo ${group.id}`}</option>)}</select></label>
            )}
            <label>Inicio<input type="datetime-local" value={form.starts_at} onChange={(e) => updateForm("starts_at", e.target.value)} /></label>
            <label>Caducidad<input type="datetime-local" value={form.expires_at} onChange={(e) => updateForm("expires_at", e.target.value)} /></label>
            <div className="avisosChecks">
              <label><input type="checkbox" checked={form.sendInApp} onChange={(e) => updateForm("sendInApp", e.target.checked)} /> Notificacion interna</label>
              <label><input type="checkbox" checked={form.sendWhatsapp} onChange={(e) => updateForm("sendWhatsapp", e.target.checked)} /> Enviar tambien por WhatsApp</label>
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
          {summary.unread_count > 0 && <button className="avisosGhostBtn" onClick={markAll}>Marcar todos como leidos</button>}
        </div>

        <div className="avisosFilters">
          {FILTERS.map((item) => (
            <button key={item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>
          ))}
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado de lectura">
            <option value="all">Todos</option>
            <option value="unread">Activos</option>
            <option value="read">Leidos</option>
          </select>
        </div>

        {notice && <p className="avisosSuccess">{notice}</p>}
        {error && <p className="avisosError">{error}</p>}
        {loading && <p className="avisosEmpty">Cargando avisos...</p>}

        {!loading && !error && notifications.length === 0 && (
          <div className="avisosEmpty">
            <strong>No tienes avisos pendientes.</strong>
            <span>Cuando haya novedades del club apareceran aqui.</span>
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
                <em>{item.read_at ? "Leido" : "Sin leer"}</em>
              </div>
              {!item.read_at && <button onClick={() => markAsRead(item.id)}>Marcar como leido</button>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
