export function getDefaultApiBase() {
  return (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
}

export const API_BASE = getDefaultApiBase();

export function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
