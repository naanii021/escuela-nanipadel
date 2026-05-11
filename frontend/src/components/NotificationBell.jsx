import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPatch } from "../services/api";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [listData, countData] = await Promise.all([
        apiGet("/api/notificaciones?limit=8"),
        apiGet("/api/notificaciones/unread-count"),
      ]);
      setNotifications(listData.notifications || []);
      setUnread(Number(countData.unread || 0));
    } catch {
      setNotifications([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const onClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const markAsRead = async (id) => {
    await apiPatch(`/api/notificaciones/${id}/read`);
    await loadNotifications();
  };

  const markAllAsRead = async () => {
    await apiPatch("/api/notificaciones/read-all");
    await loadNotifications();
  };

  return (
    <div className="notificationBell" ref={panelRef}>
      <button
        className="notificationBellBtn"
        type="button"
        aria-label="Ver notificaciones"
        onClick={() => setOpen((current) => !current)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="notificationBadge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notificationPanel">
          <div className="notificationPanelHeader">
            <strong>Avisos</strong>
            {unread > 0 && <button type="button" onClick={markAllAsRead}>Leer todo</button>}
          </div>

          {loading ? (
            <p className="notificationEmpty">Cargando avisos...</p>
          ) : notifications.length === 0 ? (
            <p className="notificationEmpty">No tienes avisos recientes.</p>
          ) : (
            <div className="notificationList">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notificationItem${item.read_at ? "" : " unread"}`}
                  onClick={() => !item.read_at && markAsRead(item.id)}
                >
                  <span>{item.title}</span>
                  <small>{item.body}</small>
                  <time>{formatDate(item.created_at)}</time>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
