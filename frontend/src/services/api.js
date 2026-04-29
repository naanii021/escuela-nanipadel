const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

export async function apiGet(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `La API no devolvió JSON válido. URL: ${path}. Respuesta recibida: ${text.slice(0, 120)}`
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
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}
