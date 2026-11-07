import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { getUser } from "../services/auth";
import "./whatsappInbox.css";

const QUICK_REPLIES = [
  "Hola, gracias por escribir a NaniPadel. ¿En qué podemos ayudarte?",
  "Perfecto, dime nombre y edad del alumno y te miro grupo disponible.",
  "Ahora mismo reviso disponibilidad de pista y te confirmo.",
  "Te paso la información del torneo.",
];

const STATUS_LABELS = {
  pendiente: "Pendiente",
  abierta: "Abierta",
  atendida: "Atendida",
  cerrada: "Cerrada",
};

const STATUS_OPTIONS = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendientes" },
  { key: "abierta", label: "Abiertas" },
  { key: "atendida", label: "Atendidas" },
  { key: "cerrada", label: "Cerradas" },
];

function isAdminUser() {
  return String(getUser()?.rol || "").toLowerCase() === "admin";
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(estado) {
  return STATUS_LABELS[estado] || (estado ? `${estado.charAt(0).toUpperCase()}${estado.slice(1)}` : "Sin estado");
}

// Solo se ofrece el siguiente paso que tiene sentido para cada estado.
function nextActions(estado) {
  if (estado === "cerrada") return [{ estado: "abierta", label: "Volver a abrir" }];
  if (estado === "atendida") return [{ estado: "cerrada", label: "Cerrar conversación" }, { estado: "abierta", label: "Volver a abrir" }];
  return [{ estado: "atendida", label: "Marcar como atendida" }, { estado: "cerrada", label: "Cerrar conversación" }];
}

function contactLabel(conversation) {
  return conversation?.nombre_contacto || conversation?.telefono || conversation?.wa_id || "Contacto";
}

export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);

  const canReply = Boolean(selectedConversation?.puede_responder_libre);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "todos") params.set("estado", statusFilter);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    return params.toString();
  }, [debouncedSearch, statusFilter]);

  // La búsqueda espera a que se deje de escribir (300 ms) para no pedir datos en cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet(`/api/whatsapp/conversations${query ? `?${query}` : ""}`);
      const next = data.conversations || [];
      setConversations(next);
      setSelectedId((current) => current || next[0]?.id || "");
    } catch (e) {
      setConversations([]);
      setError(e.message || "No se pudieron cargar los mensajes.");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    try {
      setMessagesLoading(true);
      setError("");
      const data = await apiGet(`/api/whatsapp/conversations/${conversationId}/messages`);
      setSelectedConversation(data.conversation || null);
      setMessages(data.messages || []);
    } catch (e) {
      setSelectedConversation(null);
      setMessages([]);
      setError(e.message || "No se pudieron cargar los mensajes.");
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminUser()) return;
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!isAdminUser()) return;
    loadMessages(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!isAdminUser()) {
    return (
      <main className="whatsappInbox">
        <section className="whatsappAccessBox">
          <h1>Mensajes de WhatsApp</h1>
          <p>Solo el administrador puede acceder a esta bandeja.</p>
          <button type="button" onClick={() => navigate("/panel")}>Volver al panel</button>
        </section>
      </main>
    );
  }

  const selectConversation = (conversation) => {
    setSelectedId(String(conversation.id));
    setMobileConversationOpen(true);
    setNotice("");
    setSendError("");
  };

  const updateStatus = async (estado) => {
    if (!selectedId) return;
    try {
      setStatusBusy(true);
      setSendError("");
      await apiPatch(`/api/whatsapp/conversations/${selectedId}/status`, { estado });
      setNotice(`Conversación marcada como ${statusLabel(estado).toLowerCase()}.`);
      await loadConversations();
      await loadMessages(selectedId);
    } catch (e) {
      setSendError(`${e.message || "No se ha podido cambiar el estado."} Puedes volver a intentarlo.`);
    } finally {
      setStatusBusy(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text || !selectedId || !canReply) return;

    try {
      setSending(true);
      setSendError("");
      await apiPost(`/api/whatsapp/conversations/${selectedId}/send`, { message: text });
      setReply("");
      setNotice("Mensaje enviado.");
      await loadConversations();
      await loadMessages(selectedId);
    } catch (e) {
      setSendError(`${e.message || "No se ha podido enviar."} Tu texto sigue aquí: pulsa «Enviar» otra vez para reintentar.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="whatsappInbox" aria-labelledby="whatsapp-title">
      <header className="whatsappHeader">
        <div>
          <h1 id="whatsapp-title">Mensajes de WhatsApp</h1>
          <p>Conversaciones con alumnos, familias y gente interesada en la escuela.</p>
        </div>
        <Link to="/panel" className="whatsappBackLink">Volver al panel</Link>
      </header>

      <section className="whatsappShell">
        <aside className={`conversationList${mobileConversationOpen ? " isHiddenMobile" : ""}`} aria-label="Conversaciones de WhatsApp">
          <div className="conversationToolbar">
            <input type="search" enterKeyHint="search" aria-label="Buscar conversación" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o teléfono" />
            <div className="conversationFilters">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={statusFilter === option.key}
                  className={statusFilter === option.key ? "isActive" : ""}
                  onClick={() => setStatusFilter(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="whatsappEmpty">Cargando conversaciones…</div>}
          {!loading && error && <div className="whatsappError">{error}</div>}
          {!loading && !error && conversations.length === 0 && <div className="whatsappEmpty">No hay conversaciones con este filtro.</div>}

          <div className="conversationItems">
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={`conversationItem${String(selectedId) === String(conversation.id) ? " isSelected" : ""}`}
                onClick={() => selectConversation(conversation)}
              >
                <div>
                  <strong>{contactLabel(conversation)}</strong>
                  <p>{conversation.ultimo_mensaje || "Sin mensajes"}</p>
                </div>
                <div className="conversationMeta">
                  <span>{formatDate(conversation.ultimo_mensaje_en)}</span>
                  <em className={`waStatus status-${conversation.estado}`}>{statusLabel(conversation.estado)}</em>
                  <em className={conversation.puede_responder_libre ? "replyChip canReply" : "replyChip expired"}>
                    {conversation.puede_responder_libre ? "Puedes responder" : "Necesita plantilla"}
                  </em>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className={`messagePane${mobileConversationOpen ? " isOpenMobile" : ""}`} aria-label="Mensajes de la conversación">
          <button type="button" className="mobileBackBtn" onClick={() => setMobileConversationOpen(false)}>Volver a conversaciones</button>

          {selectedConversation ? (
            <>
              <div className="messagePaneHead">
                <div>
                  <strong>{contactLabel(selectedConversation)}</strong>
                  <span>{selectedConversation.telefono} · {statusLabel(selectedConversation.estado)}</span>
                </div>
                <div className="messageActions">
                  {nextActions(selectedConversation.estado).map((action) => (
                    <button type="button" key={action.estado} onClick={() => updateStatus(action.estado)} disabled={statusBusy}>{action.label}</button>
                  ))}
                </div>
              </div>

              {notice && <div className="whatsappNotice" role="status">{notice}</div>}
              {error && <div className="whatsappError" role="alert">{error}</div>}

              <div className="messagesScroll" aria-busy={messagesLoading}>
                {messagesLoading && <div className="whatsappEmpty">Cargando mensajes…</div>}
                {!messagesLoading && messages.map((message) => (
                  <article className={`messageBubble ${message.direccion}`} key={message.id}>
                    <p>{message.contenido || "Mensaje sin contenido"}</p>
                    <span>{formatDate(message.created_at)}{message.estado ? ` · ${message.estado}` : ""}</span>
                  </article>
                ))}
                {!messagesLoading && messages.length === 0 && <div className="whatsappEmpty">No hay mensajes en esta conversación.</div>}
              </div>

              <div className="quickReplies">
                {QUICK_REPLIES.map((text) => (
                  <button type="button" key={text} onClick={() => setReply(text)}>{text}</button>
                ))}
              </div>

              {!canReply && (
                <div className="windowWarning">
                  Han pasado más de 24 horas desde su último mensaje. WhatsApp solo deja contestar ahora con una plantilla aprobada.
                </div>
              )}

              {sendError && <div className="whatsappError" role="alert">{sendError}</div>}
              <form className="replyBox" onSubmit={sendReply}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe una respuesta"
                  aria-label="Respuesta"
                  rows={3}
                  disabled={!canReply || sending}
                />
                <button type="submit" disabled={!canReply || !reply.trim() || sending}>
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </form>
            </>
          ) : (
            <div className="whatsappEmpty conversationPlaceholder">Selecciona una conversación para ver los mensajes.</div>
          )}
        </section>
      </section>
    </main>
  );
}
