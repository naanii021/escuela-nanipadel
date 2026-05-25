import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch } from "../services/api";
import {
  NOTIFICATIONS_REFRESH_EVENT,
  requestNotificationsRefresh,
} from "../services/notificationEvents";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortBody(value = "") {
  return value.length > 96 ? `${value.slice(0, 96).trim()}...` : value;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);

  const refreshNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const [listData, countData] = await Promise.all([
        apiGet("/api/notificaciones?limit=8"),
        apiGet("/api/notificaciones/unread-count"),
      ]);

      const nextNotifications = listData.notifications || [];
      const fallbackUnread = nextNotifications.filter((item) => !item.read_at).length;

      setNotifications(nextNotifications);
      setUnread(Number(countData.unread ?? countData.total ?? listData.unread_count ?? fallbackUnread));
    } catch {
      setError("No se pudieron cargar las notificaciones.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();

    const intervalId = window.setInterval(() => {
      refreshNotifications({ silent: true });
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications({ silent: true });
      }
    };

    const handleRefreshRequest = () => {
      refreshNotifications({ silent: true });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefreshRequest);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefreshRequest);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (open) refreshNotifications({ silent: true });
  }, [open, refreshNotifications]);

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
    try {
      await apiPatch(`/api/notificaciones/${id}/read`);
      await refreshNotifications({ silent: true });
      requestNotificationsRefresh();
    } catch {
      setError("No se pudieron actualizar las notificaciones.");
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPatch("/api/notificaciones/read-all");
      await refreshNotifications({ silent: true });
      requestNotificationsRefresh();
    } catch {
      setError("No se pudieron actualizar las notificaciones.");
    }
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
            <div>
              <strong>Avisos</strong>
              <span>{unread > 0 ? `${unread} sin leer` : "Al dia"}</span>
            </div>
            {unread > 0 && <button type="button" onClick={markAllAsRead}>Leer todo</button>}
          </div>

          {error ? (
            <p className="notificationEmpty">{error}</p>
          ) : loading ? (
            <p className="notificationEmpty">Cargando avisos...</p>
          ) : notifications.length === 0 ? (
            <p className="notificationEmpty">No tienes avisos pendientes.</p>
          ) : (
            <div className="notificationList">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  className={`notificationItem${item.read_at ? "" : " unread"} notificationItem-${item.priority || "normal"}`}
                >
                  <div className="notificationItemTop">
                    <span>{item.title}</span>
                    {!item.read_at && <i>Nuevo</i>}
                  </div>
                  <small>{shortBody(item.body)}</small>
                  <div className="notificationItemMeta">
                    <time>{formatDate(item.created_at)}</time>
                    <em>{item.category || item.tipo}</em>
                  </div>
                  {!item.read_at && (
                    <button type="button" onClick={() => markAsRead(item.id)}>
                      Marcar como leido
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          <Link className="notificationPanelLink" to="/avisos" onClick={() => setOpen(false)}>
            Ver todos
          </Link>
        </div>
      )}
    </div>
  );
}
