// Servicio del tiempo usando Open-Meteo (directo desde el navegador)
// No requiere API Key y suele permitir CORS.

export async function getWeatherForClub(lat, lon) {
  // URL Open-Meteo: current (temperatura, prob lluvia, viento, código tiempo, día/noche)
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation_probability,wind_speed_10m,weather_code,is_day` +
    `&wind_speed_unit=kmh&timezone=auto`;

  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  // Si Open-Meteo responde mal, devolvemos un error claro
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const current = json.current || {};

  const temperature = current.temperature_2m;
  const precipitationProbability = current.precipitation_probability;
  const windSpeed = current.wind_speed_10m;
  const weatherCode = current.weather_code;
  const isDay = current.is_day;

  const mapped = mapWeatherCodeToText(weatherCode);

  // Regla simple para estado de pista
  const pistaRiesgo =
    (typeof precipitationProbability === "number" && precipitationProbability >= 50) ||
    (typeof windSpeed === "number" && windSpeed >= 30);

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    club: { lat, lon },
    temperature,
    precipitationProbability,
    windSpeed,
    weatherCode,
    isDay,
    description: mapped.text,
    emoji: mapped.emoji,
    pista: pistaRiesgo ? "RIESGO" : "Puedes jugar",
  };
}

// Traducción simple de códigos a texto + emoji (igual que tu backend)
function mapWeatherCodeToText(code) {
  if (code === 0) return { text: "Despejado", emoji: "☀️" };
  if ([1, 2].includes(code)) return { text: "Poco nuboso", emoji: "🌤️" };
  if (code === 3) return { text: "Nublado", emoji: "☁️" };
  if ([45, 48].includes(code)) return { text: "Niebla", emoji: "🌫️" };
  if ([51, 53, 55].includes(code)) return { text: "Llovizna", emoji: "🌦️" };
  if ([56, 57].includes(code)) return { text: "Llovizna helada", emoji: "🧊" };
  if ([61, 63, 65].includes(code)) return { text: "Lluvia", emoji: "🌧️" };
  if ([66, 67].includes(code)) return { text: "Lluvia helada", emoji: "🥶" };
  if ([71, 73, 75].includes(code)) return { text: "Nieve", emoji: "❄️" };
  if (code === 77) return { text: "Granizo", emoji: "🧊" };
  if ([80, 81, 82].includes(code)) return { text: "Chubascos", emoji: "🌦️" };
  if (code === 95) return { text: "Tormenta", emoji: "⛈️" };
  if ([96, 99].includes(code)) return { text: "Tormenta con granizo", emoji: "⛈️🧊" };
  return { text: "Tiempo variable", emoji: "🌥️" };
}

