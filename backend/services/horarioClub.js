// Fecha y hora "de pared" del club (Madrid), independientes de la zona horaria del servidor.

const ZONA_CLUB = "Europe/Madrid";

// Devuelve { fecha: "AAAA-MM-DD", hora: "HH:MM" } en hora de Madrid.
export function ahoraEnClub(ahora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA_CLUB,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ahora)
      .map((parte) => [parte.type, parte.value]),
  );

  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

// Normaliza la fecha que llega del cliente o de MySQL a "AAAA-MM-DD" (sin zona horaria).
export function fechaISO(valor) {
  if (valor instanceof Date) return ahoraEnClub(valor).fecha;
  const texto = String(valor || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : "";
}

// true si el hueco (fecha + hora de inicio) ya ha empezado o pasado en hora de Madrid.
export function esHoraPasada(fecha, horaInicio, ahora = new Date()) {
  const dia = fechaISO(fecha);
  const hora = String(horaInicio || "").slice(0, 5);
  if (!dia || !/^\d{2}:\d{2}$/.test(hora)) return false;

  const club = ahoraEnClub(ahora);
  if (dia !== club.fecha) return dia < club.fecha;
  return hora <= club.hora;
}
