import { apiGet } from "./api";
import { getToken } from "./auth";

export async function getAssistantSummary() {
  const token = getToken();
  const summary = await apiGet("/api/asistente/summary", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!token) {
    return { ...summary, notifications: { unread: 0, items: [], available: false } };
  }

  // Las notificaciones son un extra del asistente: si el endpoint no esta disponible,
  // devolvemos un estado vacio para no romper login, reservas ni navegacion.
  const [unreadResult, listResult] = await Promise.allSettled([
    apiGet("/api/notificaciones/unread-count"),
    apiGet("/api/notificaciones?limit=3"),
  ]);

  const unreadData = unreadResult.status === "fulfilled" ? unreadResult.value : {};
  const listData = listResult.status === "fulfilled" ? listResult.value : {};

  return {
    ...summary,
    notifications: {
      unread: unreadData.count ?? unreadData.unread ?? unreadData.total ?? 0,
      items: listData.notificaciones || listData.items || listData.data || [],
      available: unreadResult.status === "fulfilled" || listResult.status === "fulfilled",
    },
  };
}
