// Servicio del tiempo usando Open-Meteo
export async function getWeatherForClub(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code,is_day,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&forecast_days=7&wind_speed_unit=kmh&timezone=auto`;

  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const current = json.current || {};
  const daily = json.daily || {};

  const temperature = current.temperature_2m;
  const apparentTemperature = current.apparent_temperature;
  const humidity = current.relative_humidity_2m;
  const precipitationProbability = current.precipitation_probability;
  const windSpeed = current.wind_speed_10m;
  const weatherCode = current.weather_code;
  const isDay = current.is_day;
  const uvIndex = current.uv_index;

  const mapped = mapWeatherCodeToText(weatherCode);

  // Estado de pista
  const pistaRiesgo =
    (typeof precipitationProbability === "number" && precipitationProbability >= 50) ||
    (typeof windSpeed === "number" && windSpeed >= 30);

  // Recomendación de juego
  const recomendacion = getRecomendacion({
    temperature,
    precipitationProbability,
    windSpeed,
    humidity,
    weatherCode,
    uvIndex,
  });

  // Previsión semanal
  const forecast = [];
  if (daily.time) {
    for (let i = 0; i < daily.time.length; i++) {
      const dayMapped = mapWeatherCodeToText(daily.weather_code[i]);
      forecast.push({
        date: daily.time[i],
        weatherCode: daily.weather_code[i],
        emoji: dayMapped.emoji,
        description: dayMapped.text,
        tempMax: daily.temperature_2m_max[i],
        tempMin: daily.temperature_2m_min[i],
        precipitationProbability: daily.precipitation_probability_max[i],
        windSpeed: daily.wind_speed_10m_max[i],
      });
    }
  }

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    club: { lat, lon },
    temperature,
    apparentTemperature,
    humidity,
    precipitationProbability,
    windSpeed,
    weatherCode,
    isDay,
    uvIndex,
    description: mapped.text,
    emoji: mapped.emoji,
    pista: pistaRiesgo ? "RIESGO" : "Puedes jugar",
    recomendacion,
    forecast,
  };
}

// Recomendación de juego basada en condiciones
function getRecomendacion({ temperature, precipitationProbability, windSpeed, humidity, weatherCode, uvIndex }) {
  // Tormenta
  if ([95, 96, 99].includes(weatherCode)) {
    return {
      nivel: "malo",
      titulo: "No recomendado",
      mensaje: "Hay tormenta en la zona. Mejor esperar a que pase por seguridad.",
      icono: "⛈️",
    };
  }

  // Lluvia fuerte
  if ([63, 65, 67, 81, 82].includes(weatherCode)) {
    return {
      nivel: "malo",
      titulo: "No recomendado",
      mensaje: "Lluvia intensa. Las pistas estarán mojadas y resbaladizas.",
      icono: "🌧️",
    };
  }

  // Mucho viento
  if (windSpeed >= 30) {
    return {
      nivel: "malo",
      titulo: "Viento fuerte",
      mensaje: "El viento dificultará el control de la bola. Mejor otro día.",
      icono: "💨",
    };
  }

  // Probabilidad alta de lluvia
  if (precipitationProbability >= 50) {
    return {
      nivel: "regular",
      titulo: "Posible lluvia",
      mensaje: "Hay alta probabilidad de lluvia. Lleva una toalla por si acaso.",
      icono: "🌦️",
    };
  }

  // Calor extremo
  if (temperature >= 35) {
    return {
      nivel: "regular",
      titulo: "Calor extremo",
      mensaje: "Hidrátate bien y juega en horas de menos sol. Cuidado con el golpe de calor.",
      icono: "🥵",
    };
  }

  // Frío
  if (temperature <= 5) {
    return {
      nivel: "regular",
      titulo: "Hace frío",
      mensaje: "Calienta bien antes de jugar para evitar lesiones musculares.",
      icono: "🥶",
    };
  }

  // UV alto
  if (uvIndex >= 7) {
    return {
      nivel: "regular",
      titulo: "Sol intenso",
      mensaje: "Usa protector solar y gorra. La radiación UV es alta.",
      icono: "☀️",
    };
  }

  // Viento moderado
  if (windSpeed >= 20) {
    return {
      nivel: "regular",
      titulo: "Viento moderado",
      mensaje: "Habrá algo de viento. Ajusta tu juego en consecuencia.",
      icono: "🌬️",
    };
  }

  // Condiciones perfectas
  if (temperature >= 18 && temperature <= 28 && windSpeed < 15) {
    return {
      nivel: "excelente",
      titulo: "Condiciones perfectas",
      mensaje: "Temperatura ideal y poco viento. ¡Es el momento perfecto para jugar!",
      icono: "🎾",
    };
  }

  // Buenas condiciones
  return {
    nivel: "bueno",
    titulo: "Buenas condiciones",
    mensaje: "Las condiciones son favorables para jugar al pádel.",
    icono: "✅",
  };
}

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