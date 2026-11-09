// Precios de la pista. Con luz = el turno se juega con las luces encendidas, es decir,
// cuando al menos MINUTOS_CON_LUZ minutos del turno caen después de la puesta de sol.
// La puesta de sol se calcula en local (algoritmo solar NOAA), sin llamadas de red.

export const PRECIO_SIN_LUZ = 8;
export const PRECIO_CON_LUZ = 11;
export const MINUTOS_CON_LUZ = 30;
export const DURACION_TURNO = 90;

// Ubicación de la pista.
const LATITUD = 39.483017;
const LONGITUD = -6.364445;
const ZONA = "Europe/Madrid";
// Cenit oficial de la puesta de sol (90° + refracción + radio del disco solar).
const CENIT = 90.833;

const RAD = Math.PI / 180;
const grados = (x) => x / RAD;

function partesFecha(fechaISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaISO || ""));
  if (!m) return null;
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

// Minutos de diferencia entre Madrid y UTC ese día (60 en invierno, 120 en verano).
// Se mide a mediodía UTC: los cambios de hora son a la 01:00 UTC, así que no hay ambigüedad.
function desfaseMadrid({ anio, mes, dia }) {
  const mediodia = new Date(Date.UTC(anio, mes - 1, dia, 12));
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(mediodia)
    .split(":")
    .map(Number);
  return hora[0] * 60 + hora[1] - 12 * 60;
}

// Puesta de sol del día indicado ("AAAA-MM-DD") en minutos desde la medianoche, hora de Madrid.
// Devuelve null si la fecha no es válida.
export function puestaDeSol(fechaISO) {
  const f = partesFecha(fechaISO);
  if (!f) return null;
  const jd = Date.UTC(f.anio, f.mes - 1, f.dia, 12) / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525;

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centro =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + centro - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const declinacion = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));

  const y = Math.tan((eps * RAD) / 2) ** 2;
  const ecuacionTiempo =
    4 *
    grados(
      y * Math.sin(2 * l0 * RAD) -
        2 * e * Math.sin(m * RAD) +
        4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
        0.5 * y * y * Math.sin(4 * l0 * RAD) -
        1.25 * e * e * Math.sin(2 * m * RAD)
    );

  const coseno =
    Math.cos(CENIT * RAD) / (Math.cos(LATITUD * RAD) * Math.cos(declinacion)) -
    Math.tan(LATITUD * RAD) * Math.tan(declinacion);
  const anguloHorario = grados(Math.acos(Math.max(-1, Math.min(1, coseno))));

  const utc = 720 - 4 * LONGITUD - ecuacionTiempo + 4 * anguloHorario;
  return utc + desfaseMadrid(f);
}

// "HH:MM" de la puesta de sol, para mostrarla o comprobarla.
export function horaPuestaDeSol(fechaISO) {
  const minutos = puestaDeSol(fechaISO);
  if (minutos === null) return "";
  const total = Math.round(minutos);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// true si el turno de 90 minutos que empieza a "HH:MM" se juega con luces.
export function turnoConLuz(fechaISO, hora) {
  const sol = puestaDeSol(fechaISO);
  const [h, mi] = String(hora || "").split(":").map(Number);
  if (sol === null || !Number.isFinite(h) || !Number.isFinite(mi)) return false;
  const inicio = h * 60 + mi;
  const fin = inicio + DURACION_TURNO;
  return fin - Math.max(inicio, sol) >= MINUTOS_CON_LUZ;
}

export function precioTurno(fechaISO, hora) {
  const conLuz = turnoConLuz(fechaISO, hora);
  return { precio: conLuz ? PRECIO_CON_LUZ : PRECIO_SIN_LUZ, conLuz };
}
