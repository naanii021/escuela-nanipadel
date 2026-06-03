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
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);

  const canReply = Boolean(selectedConversation?.puede_responder_libre);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "todos") params.set("estado", statusFilter);
    if (search.trim()) params.set("q", search.trim());
    return params.toString();
  }, [search, statusFilter]);

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
          <span>Admin</span>
          <h1>Mensajes WhatsApp</h1>
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
  };

  const updateStatus = async (estado) => {
    if (!selectedId) return;
    try {
      await apiPatch(`/api/whatsapp/conversations/${selectedId}/status`, { estado });
      setNotice("Estado actualizado.");
      await loadConversations();
      await loadMessages(selectedId);
    } catch (e) {
      setError(e.message || "No se pudo actualizar la conversación.");
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text || !selectedId || !canReply) return;

    try {
      setSending(true);
      setError("");
      await apiPost(`/api/whatsapp/conversations/${selectedId}/send`, { message: text });
      setReply("");
      setNotice("Mensaje enviado.");
      await loadConversations();
      await loadMessages(selectedId);
    } catch (e) {
      setError(e.message || "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="whatsappInbox" aria-labelledby="whatsapp-title">
      <header className="whatsappHeader">
        <div>
          <span>Admin</span>
          <h1 id="whatsapp-title">Mensajes WhatsApp</h1>
          <p>Gestiona conversaciones de alumnos y nuevos clientes desde el panel.</p>
        </div>
        <Link to="/panel" className="whatsappBackLink">Volver al panel</Link>
      </header>

      <section className="whatsappShell">
        <aside className={`conversationList${mobileConversationOpen ? " isHiddenMobile" : ""}`} aria-label="Conversaciones de WhatsApp">
          <div className="conversationToolbar">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o teléfono" />
            <div className="conversationFilters">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={statusFilter === option.key ? "isActive" : ""}
                  onClick={() => setStatusFilter(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="whatsappEmpty">Cargando conversaciones...</div>}
          {!loading && error && <div className="whatsappError">{error}</div>}
          {!loading && !error && conversations.length === 0 && <div className="whatsappEmpty">No hay mensajes de WhatsApp todavía.</div>}

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
                  <em className={`statusChip status-${conversation.estado}`}>{conversation.estado}</em>
                  <em className={conversation.puede_responder_libre ? "replyChip canReply" : "replyChip expired"}>
                    {conversation.puede_responder_libre ? "Puedes responder" : "Ventana caducada"}
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
                  <span>{selectedConversation.telefono}</span>
                </div>
                <div className="messageActions">
                  <button type="button" onClick={() => updateStatus("atendida")}>Marcar atendida</button>
                  <button type="button" onClick={() => updateStatus("abierta")}>Reabrir conversación</button>
                  <button type="button" onClick={() => updateStatus("cerrada")}>Cerrar conversación</button>
                </div>
              </div>

              {notice && <div className="whatsappNotice">{notice}</div>}
              {error && <div className="whatsappError">{error}</div>}

              <div className="messagesScroll" aria-busy={messagesLoading}>
                {messagesLoading && <div className="whatsappEmpty">Cargando mensajes...</div>}
                {!messagesLoading && messages.map((message) => (
                  <article className={`messageBubble ${message.direccion}`} key={message.id}>
                    <p>{message.contenido || "Mensaje sin contenido"}</p>
                    <span>{formatDate(message.created_at)} · {message.estado}</span>
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
                  Han pasado más de 24 horas desde el último mensaje del cliente. Para responder necesitas una plantilla aprobada.
                </div>
              )}

              <form className="replyBox" onSubmit={sendReply}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe una respuesta"
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
