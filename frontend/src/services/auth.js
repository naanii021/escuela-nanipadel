const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

// Guardar token y usuario en localStorage
export function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

// Obtener token
export function getToken() {
  return localStorage.getItem("token");
}

// Obtener usuario guardado
export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Cerrar sesión
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// Comprobar si hay sesión activa
export function isLogged() {
  return !!getToken();
}

// Login
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

// Registro
export async function registro(nombre, email, telefono, password) {
  const res = await fetch(`${API_BASE}/api/auth/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, email, telefono, password }),
  });
  return res.json();
}

// Verificar token
export async function verifyToken() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.ok ? data.user : null;
}