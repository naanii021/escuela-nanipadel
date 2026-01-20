// ------------------------------
// Importaciones modernas (ESM)
// ------------------------------
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2";

// Cargar variables de entorno desde .env
dotenv.config();

// Crear app de Express
const app = express();

// Middleware: permitir JSON
app.use(express.json());

// Middleware: CORS (en desarrollo, dejamos abierto)
// Luego podemos restringir a tu dominio/tu frontend.
app.use(cors());

// ------------------------------
// Helpers
// ------------------------------

/**
 * Valida y convierte lat/lon a números.
 * Devuelve {lat, lon} o null si no es válido.
 */
function parseLatLon(lat, lon) {
  const latN = Number(lat);
  const lonN = Number(lon);

  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;
  if (latN < -90 || latN > 90) return null;
  if (lonN < -180 || lonN > 180) return null;

  return { lat: latN, lon: lonN };
}

/**
 * Fetch con timeout para evitar que el endpoint se quede colgado
 * y te genere 504 en el proxy del frontend.
 */
async function fetchWithTimeout(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// ------------------------------
// RUTA TEST: comprobar que el backend responde
// ------------------------------
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

// Marca de agua para saber qué backend está corriendo
app.get("/api/whoami", (req, res) => {
  res.json({
    ok: true,
    name: "BACKEND_TIEMPO",
    port: process.env.PORT || 4000,
    time: new Date().toISOString(),
  });
});

// ------------------------------
// RUTA TIEMPO (Open-Meteo)
// ------------------------------

// Cache simple en memoria (evita llamar al API cada refresco)
let weatherCache = {
  timestamp: 0,
  data: null,
};

// Traducción de códigos de Open-Meteo a texto + emoji
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
  if ([96, 99].includes(code))
    return { text: "Tormenta con granizo", emoji: "⛈️🧊" };
  return { text: "Tiempo variable", emoji: "🌥️" };
}

app.get("/api/weather/current", async (req, res) => {
  try {
    // Coordenadas del club desde .env (validadas)
    const parsed = parseLatLon(process.env.CLUB_LAT, process.env.CLUB_LON);

    // Si faltan o son inválidas, devolvemos error claro
    if (!parsed) {
      return res.status(500).json({
        ok: false,
        message: "CLUB_LAT / CLUB_LON inválidos o no definidos en el .env del backend",
      });
    }

    const { lat, lon } = parsed;

    // Cache
    const cacheSeconds = Number(process.env.WEATHER_CACHE_SECONDS || 300);
    const now = Date.now();

    const isCacheValid =
      weatherCache.data && now - weatherCache.timestamp < cacheSeconds * 1000;

    if (isCacheValid) {
      return res.json(weatherCache.data);
    }

    // URL de Open-Meteo
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation_probability,wind_speed_10m,weather_code,is_day` +
      `&wind_speed_unit=kmh&timezone=auto`;

    // Timeout para evitar cuelgues
    const timeoutMs = Number(process.env.WEATHER_TIMEOUT_MS || 4500);
    const response = await fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        message: "Error consultando el servicio del tiempo (Open-Meteo)",
        status: response.status,
      });
    }

    const json = await response.json();

    // Datos actuales
    const current = json.current || {};

    const temperature = current.temperature_2m;
    const precipitationProbability = current.precipitation_probability;
    const windSpeed = current.wind_speed_10m;
    const weatherCode = current.weather_code;
    const isDay = current.is_day;

    // Si por cualquier cosa viniese raro, no rompemos
    const mapped = mapWeatherCodeToText(
      typeof weatherCode === "number" ? weatherCode : -1
    );

    // Estado de pista (reglas simples)
    const pistaRiesgo =
      (typeof precipitationProbability === "number" &&
        precipitationProbability >= 50) ||
      (typeof windSpeed === "number" && windSpeed >= 30);

    const payload = {
      ok: true,
      club: { lat, lon },
      updatedAt: new Date().toISOString(),
      temperature: typeof temperature === "number" ? temperature : null,
      precipitationProbability:
        typeof precipitationProbability === "number" ? precipitationProbability : null,
      windSpeed: typeof windSpeed === "number" ? windSpeed : null,
      weatherCode: typeof weatherCode === "number" ? weatherCode : null,
      isDay: typeof isDay === "number" ? isDay : null,
      description: mapped.text,
      emoji: mapped.emoji,
      pista: pistaRiesgo ? "RIESGO" : "OK",
    };

    // Guardamos cache
    weatherCache = { timestamp: now, data: payload };

    return res.json(payload);
  } catch (error) {
    // Si fue timeout del fetch
    if (error?.name === "AbortError") {
      return res.status(504).json({
        ok: false,
        message: "Timeout consultando el servicio del tiempo (Open-Meteo)",
      });
    }

    console.error("❌ Error en /api/weather/current:", error);

    return res.status(500).json({
      ok: false,
      message: "Error interno al obtener el tiempo",
      details: String(error?.message || error),
    });
  }
});

// ------------------------------
// MySQL
// ------------------------------

// Convertimos el puerto a número (si viene undefined, por defecto 3306)
const DB_PORT = Number(process.env.DB_PORT || 3306);

// Creamos conexión MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: DB_PORT,
});

// Conectar a MySQL (si falla, el backend sigue vivo, pero lo deja claro)
db.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con MySQL:", err.message);
  } else {
    console.log("✅ Conectado correctamente a MySQL");
  }
});

// Ruta raíz
app.get("/", (req, res) => {
  res.send("¡Backend funcionando!");
});

// ------------------------------
// Catch-all 404 (útil para debug)
// Esto hace que cualquier ruta no encontrada devuelva JSON,
// así el frontend no se rompe intentando parsear HTML.
// ------------------------------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada",
    method: req.method,
    path: req.url,
  });
});

// ------------------------------
// Iniciar servidor (IMPORTANTE)
// 0.0.0.0 = accesible desde otros dispositivos de la red
// ------------------------------
const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend activo en http://127.0.0.1:${PORT}`);
});
