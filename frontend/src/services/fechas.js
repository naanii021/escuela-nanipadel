// Fechas y horas en hora de Madrid, escritas como las diría una persona.
// Las columnas DATE de MySQL llegan como "2026-11-08T23:00:00.000Z" (medianoche de Madrid
// en UTC). Si se cortan con slice(0, 10) salen un día antes; por eso todo pasa por aquí.

const ZONA = "Europe/Madrid";

function partesMadrid(fecha) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(fecha)
      .map((parte) => [parte.type, parte.value])
  );
}

// { fecha: "AAAA-MM-DD", hora: "HH:MM" } de ahora mismo en Madrid.
export function ahoraMadrid(ahora = new Date()) {
  const p = partesMadrid(ahora);
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

// Convierte "AAAA-MM-DD", un ISO con hora o un Date en "AAAA-MM-DD" del día de Madrid.
export function aISO(valor) {
  if (!valor) return "";
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? "" : ahoraMadrid(valor).fecha;
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? "" : ahoraMadrid(fecha).fecha;
}

// Mediodía UTC del día indicado: se formatea igual en cualquier zona de Europa.
function mediodia(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function sumarDias(iso, dias) {
  const fecha = mediodia(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// Día de la semana (0 = domingo) de una fecha "AAAA-MM-DD".
export function diaSemana(iso) {
  return mediodia(iso).getUTCDay();
}

function formatear(valor, opciones) {
  const iso = aISO(valor);
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, ...opciones }).format(mediodia(iso));
}

function mayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

// "Viernes 6 de noviembre" (sin coma, primera letra en mayúscula si se pide).
export function fechaLarga(valor, { capital = true } = {}) {
  const texto = formatear(valor, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  return capital ? mayuscula(texto) : texto;
}

// "vie 6 nov"
export function fechaCorta(valor, { capital = false } = {}) {
  const texto = formatear(valor, { weekday: "short", day: "numeric", month: "short" }).replace(/[,.]/g, "");
  return capital ? mayuscula(texto) : texto;
}

// "Hoy", "Mañana" o la fecha larga.
export function fechaRelativa(valor, { capital = true } = {}) {
  const iso = aISO(valor);
  if (!iso) return "";
  const hoy = ahoraMadrid().fecha;
  if (iso === hoy) return capital ? "Hoy" : "hoy";
  if (iso === sumarDias(hoy, 1)) return capital ? "Mañana" : "mañana";
  return fechaLarga(iso, { capital });
}

export function horaCorta(valor) {
  return String(valor || "").slice(0, 5);
}

// Hora de fin "HH:MM" a partir de inicio y duración.
export function horaFin(inicio, minutos = 90) {
  const [h, m] = horaCorta(inicio).split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const total = (h * 60 + (m || 0) + Number(minutos || 0)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// true si el hueco ya ha empezado o pasado (hora de Madrid).
export function esPasada(fechaIso, hora, ahora = new Date()) {
  const actual = ahoraMadrid(ahora);
  const dia = aISO(fechaIso);
  if (dia !== actual.fecha) return dia < actual.fecha;
  return horaCorta(hora) <= actual.hora;
}
