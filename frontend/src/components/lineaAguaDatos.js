// Serie de las próximas 48 h con el agua en la pista, para la gráfica de /estado-pista.
// Usa el mismo modelo (`evaluarPista`) y la misma consulta a Open-Meteo que `weatherService.js`,
// que solo devuelve 12 horas; aquí hacen falta 48.
import { evaluarPista } from "../services/estadoPista";

const HORAS_PASADAS = 96;
const HORAS_FUTURAS = 48;

export async function getSerieAgua(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=precipitation&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,weather_code,is_day` +
    `&forecast_days=3&past_hours=${HORAS_PASADAS}&forecast_hours=${HORAS_FUTURAS}&wind_speed_unit=kmh&timezone=auto`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  const h = json.hourly || {};
  const todas = (h.time || []).map((time, i) => ({
    time,
    temperature: h.temperature_2m?.[i],
    precipitationMm: Number(h.precipitation?.[i]) || 0,
    precipitationProbability: h.precipitation_probability?.[i],
    windSpeed: h.wind_speed_10m?.[i],
    weatherCode: h.weather_code?.[i],
    isDay: h.is_day?.[i],
  }));
  if (!todas.length) return null;

  const horaActual = String(json.current?.time || "").slice(0, 13);
  let ahora = todas.findIndex((x) => x.time.slice(0, 13) === horaActual);
  if (ahora < 0) ahora = Math.min(HORAS_PASADAS, todas.length - 1);
  const lluviaAhora = Number(json.current?.precipitation) || 0;
  todas[ahora] = { ...todas[ahora], precipitationMm: Math.max(todas[ahora].precipitationMm, lluviaAhora) };

  const pista = evaluarPista(todas, ahora);
  return { horas: pista.horas.slice(ahora, ahora + HORAS_FUTURAS), secaA: pista.secaA };
}
