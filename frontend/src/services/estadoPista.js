// ¿Se puede jugar? No basta con que haya parado de llover: la pista se encharca y tarda en secarse.
// Un chispeo se seca en una hora o dos, pero una tormenta fuerte deja la pista inservible hasta
// el día siguiente aunque salga el sol. Este modelo lleva la cuenta del agua que hay en la pista.
//
// Cada hora: agua = agua + lluvia (mm) - secado (mm). Solo se seca si no está lloviendo.
// Con los parámetros de abajo: 1,5 mm -> 1-2 h; 4 mm -> unas 8 h de día; 12 mm -> 24-36 h.

export const PARAMETROS = {
  CHARCO_MM: 1, // con más agua que esto no se juega
  ENCHARCADA_MM: 5, // con más agua que esto la pista está "encharcada" (no solo húmeda)
  LLUVIA_AHORA_MM: 0.3, // mm en una hora para decir "está lloviendo"
  LLUVIA_SIN_SECAR_MM: 0.1, // por encima de esto no hay secado esa hora
  SECADO_DIA_MM_H: 0.45,
  SECADO_NOCHE_MM_H: 0.15,
  FRIO_C: 5, // por debajo, se seca más despacio
  FACTOR_FRIO: 0.5,
  VIENTO_MAX_KMH: 30,
  MAX_AGUA_MM: 40,
};

const TORMENTA = [95, 96, 99];

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

// Añade a cada hora el agua que queda en la pista al terminarla. `horas` va en orden cronológico
// y debe incluir las horas pasadas (la lluvia de ayer cuenta).
export function simularAgua(horas) {
  const p = PARAMETROS;
  let agua = 0;
  return horas.map((hora) => {
    const lluvia = Math.max(0, num(hora.precipitationMm));
    let secado = 0;
    if (lluvia < p.LLUVIA_SIN_SECAR_MM) {
      secado = Number(hora.isDay) === 0 ? p.SECADO_NOCHE_MM_H : p.SECADO_DIA_MM_H;
      if (hora.temperature != null && num(hora.temperature) < p.FRIO_C) secado *= p.FACTOR_FRIO;
    }
    agua = Math.min(p.MAX_AGUA_MM, Math.max(0, agua + lluvia - secado));
    return { ...hora, aguaMm: Math.round(agua * 10) / 10 };
  });
}

// Estado de una hora ya simulada. `motivo` solo existe si no se puede jugar.
export function estadoDeHora(hora) {
  const p = PARAMETROS;
  const lluvia = num(hora.precipitationMm);
  const probable = num(hora.precipitationProbability) >= 70 && lluvia >= p.LLUVIA_SIN_SECAR_MM;
  if (TORMENTA.includes(Number(hora.weatherCode))) return { playable: false, motivo: "tormenta", corto: "Tormenta" };
  if (lluvia >= p.LLUVIA_AHORA_MM || probable) return { playable: false, motivo: "lloviendo", corto: "Lluvia" };
  if (num(hora.aguaMm) > p.ENCHARCADA_MM) return { playable: false, motivo: "encharcada", corto: "Agua" };
  if (num(hora.aguaMm) > p.CHARCO_MM) return { playable: false, motivo: "mojada", corto: "Mojada" };
  if (num(hora.windSpeed) >= p.VIENTO_MAX_KMH) return { playable: false, motivo: "viento", corto: "Viento" };
  return { playable: true, motivo: null, corto: "" };
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// "las 14:00 de mañana", "las 09:00 de hoy" o "las 10:00 del jueves" (hora local del club).
export function cuandoTexto(tiempo, ahora) {
  const [dia, hora = "00:00"] = String(tiempo).split("T");
  const [diaAhora] = String(ahora).split("T");
  const diferencia = Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${diaAhora}T00:00:00Z`)) / 86400000);
  const hh = hora.slice(0, 5);
  if (diferencia <= 0) return `las ${hh} de hoy`;
  if (diferencia === 1) return `las ${hh} de mañana`;
  const nombre = DIAS[new Date(`${dia}T00:00:00Z`).getUTCDay()];
  return `las ${hh} del ${nombre}`;
}

// Veredicto de la pista ahora, con la previsión de cuándo se seca.
// `horas`: pasadas + futuras en orden; `indiceAhora`: la posición de la hora actual.
export function evaluarPista(horas, indiceAhora) {
  const simuladas = simularAgua(horas);
  const ahora = simuladas[Math.max(0, Math.min(indiceAhora, simuladas.length - 1))] || {};
  const estados = simuladas.map(estadoDeHora);
  const actual = estados[Math.max(0, Math.min(indiceAhora, estados.length - 1))] || { playable: true, motivo: null, corto: "" };

  // Primera hora a partir de ahora sin agua ni lluvia (el viento no cuenta: lo da el pronóstico).
  const hayAgua = (hora) => num(hora.aguaMm) > PARAMETROS.CHARCO_MM || num(hora.precipitationMm) >= PARAMETROS.LLUVIA_AHORA_MM;
  const indiceSeca = simuladas.findIndex((hora, i) => i >= indiceAhora && !hayAgua(hora));
  const secaA = indiceSeca >= 0 ? simuladas[indiceSeca].time : null;
  // Si no llega a secarse en el horizonte de la previsión, lo normal es que vuelva a llover.
  const indiceLluvia = simuladas.findIndex((hora, i) => i > indiceAhora && num(hora.precipitationMm) >= PARAMETROS.LLUVIA_AHORA_MM);
  const secaTexto = secaA
    ? `Se secará hacia ${cuandoTexto(secaA, ahora.time)}.`
    : indiceLluvia >= 0
      ? `Se espera más lluvia hacia ${cuandoTexto(simuladas[indiceLluvia].time, ahora.time)}: la pista no llegará a secarse.`
      : "No se secará en las próximas 48 horas.";

  const aguaMm = num(ahora.aguaMm);
  const mm = aguaMm >= 10 ? Math.round(aguaMm) : aguaMm.toFixed(1).replace(".", ",");
  let reason;
  switch (actual.motivo) {
    case "tormenta":
      reason = "Hay tormenta en la zona";
      break;
    case "lloviendo":
      reason = aguaMm > PARAMETROS.ENCHARCADA_MM ? "Está lloviendo y ya hay mucha agua en la pista" : "Está lloviendo ahora";
      break;
    case "encharcada":
      reason = `Pista encharcada por la lluvia (${mm} mm de agua), aunque ahora no llueva o salga el sol. ${secaTexto}`;
      break;
    case "mojada":
      reason = `Pista mojada: ha llovido hace poco. ${secaTexto}`;
      break;
    case "viento":
      reason = "Viento fuerte";
      break;
    default:
      reason = "Pista seca y sin viento fuerte";
  }

  return {
    playable: actual.playable,
    estado: actual.motivo || "seca",
    motivoCorto: actual.corto,
    reason,
    aguaMm,
    secaA,
    secaTexto,
    lloviendo: actual.motivo === "lloviendo",
    // Agua en la pista aunque no llueva: la pista 3D la enseña mojada y sin jugadores.
    mojada: actual.motivo === "mojada" || actual.motivo === "encharcada",
    horas: simuladas.map((hora, i) => ({ ...hora, playable: estados[i].playable, motivo: estados[i].motivo, motivoCorto: estados[i].corto })),
  };
}
