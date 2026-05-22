import { getToken } from "./auth";
import { buildApiUrl } from "./apiConfig";

function buildHeaders(options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

export async function apiUpload(path, formData, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body: formData });
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
        `No hemos podido leer la respuesta del club. Comprueba que la web este conectada correctamente.`
      );
    }

    throw new Error(
      `La web ha recibido una respuesta inesperada. Intentalo de nuevo en unos segundos.`
    );
  }

  if (!res.ok) {
    throw new Error(data.message || `No hemos podido completar la peticion (${res.status}).`);
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
