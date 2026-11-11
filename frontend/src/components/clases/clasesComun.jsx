// Utilidades e iconos compartidos por las vistas de Clases (pública, alumno y profesor).
import { fechaLarga } from "../../services/fechas";

export const DAY_LABELS = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" };

export function formatDias(d1, d2) {
  if (!d2) return DAY_LABELS[d1] || d1 || "-";
  return `${DAY_LABELS[d1] || d1} y ${DAY_LABELS[d2] || d2}`;
}

export function formatHora(horaInicio, duracionMin) {
  if (!horaInicio) return "-";
  const [hh, mm] = String(horaInicio).split(":");
  const start = new Date();
  start.setHours(Number(hh), Number(mm), 0, 0);
  const end = new Date(start.getTime() + Number(duracionMin || 60) * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

// Estados de la base de datos traducidos a frases normales.
const ESTADO_TEXTO = {
  programada: "Programada",
  dada: "Dada",
  cancelada: "Cancelada",
  suspendida: "Suspendida",
  presente: "Asististe",
  falta: "Faltaste",
  justificada: "Falta justificada",
  pendiente: "Pendiente",
  asignada: "Con fecha",
  recuperada: "Recuperada",
};

const MOTIVO_TEXTO = {
  falta_justificada: "Falta justificada",
  lluvia: "Clase suspendida por lluvia",
  suspendida: "Clase suspendida",
};

export function estadoTexto(estado, porDefecto = "") {
  if (!estado) return porDefecto;
  return ESTADO_TEXTO[estado] || String(estado).charAt(0).toUpperCase() + String(estado).slice(1).replace(/_/g, " ");
}

export function motivoTexto(motivo) {
  if (!motivo) return "Recuperación";
  return MOTIVO_TEXTO[motivo] || String(motivo).charAt(0).toUpperCase() + String(motivo).slice(1).replace(/_/g, " ");
}

export function fechaClase(valor) {
  return fechaLarga(valor) || "Fecha pendiente";
}

export function horaClase(horaInicio, duracionMin) {
  return formatHora(horaInicio, duracionMin).replace(" - ", " a ");
}

export function nivelLabel(nivel) {
  const map = { ninos: "Niños", iniciacion: "Iniciación", medio: "Medio", avanzado: "Avanzado", competicion: "Competición", avanzado_plus: "Avanzado +" };
  return map[nivel] || nivel || "-";
}

export function nivelBadgeClass(nivel) {
  const map = { ninos: "badgeKids", iniciacion: "badgeInit", medio: "badgeInit", avanzado: "badgeAdv", competicion: "badgeComp", avanzado_plus: "badgePlus" };
  return map[nivel] || "badgeDefault";
}

// Clave de color del nivel para las vistas nuevas (data-nivel en CSS).
export function nivelClave(nivel) {
  return { ninos: "ninos", iniciacion: "iniciacion", medio: "medio", avanzado: "avanzado", avanzado_plus: "avanzado", competicion: "competicion" }[nivel] || "otro";
}

export function proximaDia(dia1, dia2) {
  const dayMap = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0 };
  const today = new Date().getDay();
  const dias = [dia1, dia2].filter(Boolean);
  const next = dias
    .map((d) => {
      const target = dayMap[d];
      if (target === undefined) return null;
      let diff = target - today;
      if (diff < 0) diff += 7;
      return { d, diff };
    })
    .filter(Boolean)
    .sort((a, b) => a.diff - b.diff)[0];

  if (!next) return null;
  if (next.diff === 0) return "Hoy";
  if (next.diff === 1) return "Mañana";
  return DAY_LABELS[next.d] || null;
}

const svg = (size, children, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const IcCalendar = ({ size = 13 }) => svg(size, <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>);
export const IcClock = ({ size = 13 }) => svg(size, <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
export const IcCourt = ({ size = 13 }) => svg(size, <><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="2" y1="12" x2="22" y2="12" /></>);
export const IcUser = ({ size = 13 }) => svg(size, <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const IcSearch = ({ size = 16 }) => svg(size, <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>);
export const IcArrow = ({ size = 14 }) => svg(size, <path d="M5 12h14M12 5l7 7-7 7" />, 2.5);
export const IcTarget = ({ size = 22 }) => svg(size, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const IcRepeat = ({ size = 22 }) => svg(size, <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>);
export const IcSpark = ({ size = 22 }) => svg(size, <><path d="m12 3 1.9 5.3L19 10.2l-5.1 1.9L12 17.5l-1.9-5.4L5 10.2l5.1-1.9L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>);
export const IcBell = ({ size = 22 }) => svg(size, <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
export const IcCheck = ({ size = 18 }) => svg(size, <path d="M20 6 9 17l-5-5" />, 2.6);
export const IcCross = ({ size = 18 }) => svg(size, <path d="M18 6 6 18M6 6l12 12" />, 2.6);
export const IcRefresh = ({ size = 22 }) => svg(size, <><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" /><path d="M3 21v-5h5" /></>);
export const IcBall = ({ size = 22 }) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6c3.6 3.2 3.6 9.6 0 12.8M18.4 5.6c-3.6 3.2-3.6 9.6 0 12.8" /></>);
export const IcWarn = ({ size = 20 }) => svg(size, <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>);
