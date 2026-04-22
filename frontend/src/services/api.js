const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

export async function apiGet(path) {
  const finalPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${finalPath}`;

  console.log("🌐 API GET ->", url);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}...`);

  return JSON.parse(text);
}
