import { getToken } from "./auth";

function getDefaultApiBase() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocalFrontend = ["localhost", "127.0.0.1"].includes(hostname) && port === "3000";

    if (isLocalFrontend) {
      return "http://localhost:4000";
    }
  }

  return "";
}

const API_BASE = getDefaultApiBase().replace(/\/$/, "");

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildHeaders(options = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: "GET" });
}

export async function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body: JSON.stringify(body) });
}

export async function apiPut(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PUT", body: JSON.stringify(body) });
}

export async function apiPatch(path, body, options = {}) {
  return apiRequest(path, {
    ...options,
    method: "PATCH",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: "DELETE" });
}

async function apiRequest(path, options = {}) {
  const res = await fetch(buildApiUrl(path), {
    ...options,
    headers: buildHeaders(options),
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const response = text.trim();
    const looksLikeHtml =
      response.toLowerCase().startsWith("<!doctype html") ||
      response.toLowerCase().startsWith("<html");

    if (looksLikeHtml) {
      throw new Error(
        `La ruta ${path} devolvio HTML en vez de JSON. Comprueba que el backend este activo y que REACT_APP_API_URL apunte al servidor Express.`
      );
    }

    throw new Error(
      `La API no devolvio JSON valido. URL: ${path}. Respuesta recibida: ${text.slice(0, 120)}`
    );
  }

  if (!res.ok) {
    throw new Error(data.message || `Error HTTP ${res.status}`);
  }

  return data;
}

export async function apiGetPrivate(path, token, options = {}) {
  return apiGet(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}
