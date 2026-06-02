import { apiGet } from "./api";
import { getToken } from "./auth";

const ASSISTANT_TIMEOUT_MS = 6500;

function emptyAssistantSummary(reason = "") {
  return {
    ok: false,
    fallback: true,
    message: "No he podido cargar el resumen del club, pero puedes usar los accesos rápidos.",
    warnings: reason ? [reason] : [],
    logged: Boolean(getToken()),
    user: null,
    general: {
      torneosAbiertos: [],
      estadoPista: null,
      help: [],
    },
    personal: {
      proximaClase: null,
      proximasReservas: [],
    },
    data: {
      user: null,
      torneos: { proximos: [], abiertos: [] },
      estadoPista: null,
      reservas: [],
      claseProxima: null,
      notificaciones: { unread: 0, items: [], available: false },
    },
    notifications: { unread: 0, items: [], available: false },
  };
}

async function withTimeout(task, timeoutMs = ASSISTANT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAssistantSummary() {
  const token = getToken();
  let summary;

  try {
    summary = await withTimeout((signal) =>
      apiGet("/api/asistente/summary", {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    );
  } catch (err) {
    const reason = err.name === "AbortError" ? "El resumen del asistente ha tardado demasiado." : "";
    return emptyAssistantSummary(reason);
  }

  if (!token) {
    return { ...summary, notifications: { unread: 0, items: [], available: false } };
  }

  // Las notificaciones son un extra del asistente: si el endpoint no está disponible,
  // devolvemos un estado vacío para no romper login, reservas ni navegación.
  const [unreadResult, listResult] = await Promise.allSettled([
    withTimeout((signal) => apiGet("/api/notificaciones/unread-count", { signal }), 3500),
    withTimeout((signal) => apiGet("/api/notificaciones?limit=3", { signal }), 3500),
  ]);

  const unreadData = unreadResult.status === "fulfilled" ? unreadResult.value : {};
  const listData = listResult.status === "fulfilled" ? listResult.value : {};
  const notifications = {
    unread: unreadData.count ?? unreadData.unread ?? unreadData.total ?? 0,
    items: listData.notificaciones || listData.items || listData.data || [],
    available: unreadResult.status === "fulfilled" || listResult.status === "fulfilled",
  };

  return {
    ...summary,
    notifications,
    data: {
      ...(summary.data || {}),
      notificaciones: notifications,
    },
  };
}
