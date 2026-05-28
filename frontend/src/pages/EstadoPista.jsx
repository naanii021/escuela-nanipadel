import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { getWeatherForClub } from "../services/weatherService";
import "./estadoPista.css";

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;
const COURT_PHOTOS_MANIFEST = `${process.env.PUBLIC_URL}/court-photos-manifest.json`;

function formatUpdatedAt(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES");
}

function isRecentReading(value) {
  if (!value) return false;
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt < 15 * 60 * 1000;
}

function formatSensorValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return `${value}${suffix}`;
  return `${Math.round(number * 10) / 10}${suffix}`;
}

function getSensorRecommendation(sensor) {
  if (!sensor) return "Esperando la ultima lectura del sensor.";
  if (Number(sensor.humedad) > 80) return "Pista humeda, revisar antes de jugar.";
  if (Number(sensor.temperatura) > 35) return "Mucho calor, hidratate.";
  if (Number(sensor.bateria_porcentaje) < 20) return "Bateria baja del sensor.";
  return "Condiciones buenas para jugar.";
}

function EstadoPista() {
  const [weather, setWeather] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [sensorError, setSensorError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPageData() {
      try {
        setLoading(true);
        setError("");

        const [weatherResult, sensorResult, photosResponse] = await Promise.all([
          getWeatherForClub(CLUB_LAT, CLUB_LON).then((data) => ({ ok: true, data })).catch((err) => ({ ok: false, err })),
          apiGet("/api/meteo-xiao/latest").then((data) => ({ ok: true, data })).catch((err) => ({ ok: false, err })),
          fetch(COURT_PHOTOS_MANIFEST, { cache: "no-store" }).catch(() => null),
        ]);

        if (!mounted) return;

        if (weatherResult.ok) {
          setWeather(weatherResult.data);
        } else {
          setError(weatherResult.err?.message || "No hemos podido cargar el tiempo online.");
        }

        if (sensorResult.ok) {
          setSensor(sensorResult.data?.meteo || null);
          setSensorError(sensorResult.data?.meteo ? "" : "No hay lecturas del sensor todavia.");
        } else {
          setSensor(null);
          setSensorError("No hemos podido cargar la lectura del sensor.");
        }

        if (photosResponse?.ok) {
          const manifest = await photosResponse.json();
          setPhotos(Array.isArray(manifest.photos) ? manifest.photos : []);
        } else {
          setPhotos([]);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "No hemos podido cargar el estado de pista.");
      } finally {
        if (mounted) {
          setLoading(false);
          setSensorLoading(false);
        }
      }
    }

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const overviewItems = [
    { label: "Temperatura", value: weather ? `${Math.round(weather.temperature)}°C` : "-" },
    { label: "Humedad", value: weather ? `${weather.humidity}%` : "-" },
    { label: "Presion", value: weather?.pressure ? `${Math.round(weather.pressure)} hPa` : "-" },
    { label: "Viento", value: weather?.windSpeed != null ? `${weather.windSpeed} km/h` : "-" },
    {
      label: "Lluvia",
      value:
        weather?.precipitationProbability != null
          ? `${weather.precipitationProbability}%`
          : "-",
    },
    { label: "Estado pista", value: weather?.pista || "-" },
  ];

  const sensorConnected = sensor && isRecentReading(sensor.creado_en);
  const sensorMetrics = [
    { label: "Temperatura", value: formatSensorValue(sensor?.temperatura, "°C") },
    { label: "Humedad", value: formatSensorValue(sensor?.humedad, "%") },
    { label: "Presion", value: formatSensorValue(sensor?.presion, " hPa") },
    { label: "Bateria", value: formatSensorValue(sensor?.bateria_porcentaje, "%") },
  ];

  return (
    <section className="estadoPistaPage">
      <section className="estadoHero">
        <div className="estadoHeroMain">
          <span className="estadoEyebrow">Tiempo y pista</span>
          <h1>Consulta si es buen momento para jugar</h1>
          <p>
            Revisa temperatura, viento, lluvia y recomendacion antes de reservar o salir hacia el club.
          </p>
          <div className="estadoHeroActions">
            <Link className="btn btn-primary" to="/reservas">
              Reservar pista
            </Link>
            <Link className="btn btn-ghost estadoGhostBtn" to="/">
              Volver al inicio
            </Link>
          </div>
        </div>

        <div className="estadoNowCard">
          <div className="estadoNowTop">
            <div>
              <span className="estadoNowLabel">Lectura actual</span>
              <h2>Norba Padel</h2>
            </div>
            <span className={`estadoBadge ${weather?.pista === "RIESGO" ? "estadoBadgeRisk" : ""}`}>
              {weather?.pista || "Sin datos"}
            </span>
          </div>

          {loading && <p className="estadoLoading">Cargando estado de pista...</p>}
          {!loading && error && <p className="estadoError">{error}</p>}

          {!loading && !error && weather && (
            <>
              <div className="estadoNowMain">
                <div className="estadoNowIcon" aria-hidden="true">
                  {weather.emoji}
                </div>
                <div>
                  <p className="estadoNowTemp">{Math.round(weather.temperature)}°C</p>
                  <p className="estadoNowDesc">{weather.description}</p>
                  <p className="estadoNowFeel">
                    Sensacion termica: {Math.round(weather.apparentTemperature)}°C
                  </p>
                </div>
              </div>

              <div className="estadoHighlights">
                <span className="estadoChip">UV: {weather.uvIndex ?? "-"}</span>
                <span className="estadoChip">Viento: {weather.windSpeed} km/h</span>
                <span className="estadoChip">
                  Lluvia: {weather.precipitationProbability ?? "-"}%
                </span>
              </div>

              {weather.recomendacion && (
                <div className={`estadoAdvice rec-${weather.recomendacion.nivel}`}>
                  <strong>{weather.recomendacion.titulo}</strong>
                  <p>{weather.recomendacion.mensaje}</p>
                </div>
              )}

              <p className="estadoUpdated">Ultima actualizacion: {formatUpdatedAt(weather.updatedAt)}</p>
            </>
          )}
        </div>
      </section>

      <section className="estadoSensorCard">
        <div className="estadoSensorHead">
          <div>
            <span className="estadoSectionEyebrow">Sensor del club</span>
            <h2>Ultima lectura del XIAO</h2>
          </div>
          <span className={`estadoSensorBadge ${sensorConnected ? "isConnected" : "isOffline"}`}>
            {sensorConnected ? "Sensor conectado" : "Sensor sin conexion"}
          </span>
        </div>

        {sensorLoading ? (
          <p className="estadoLoading">Cargando lectura del sensor...</p>
        ) : sensorError ? (
          <p className="estadoError">{sensorError}</p>
        ) : sensor ? (
          <>
            <div className="estadoSensorGrid">
              {sensorMetrics.map((item) => (
                <article className="estadoMetricCard" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>

            <div className="estadoSensorFooter">
              <div>
                <span>Estado</span>
                <strong>{sensor.estado || "Lectura recibida"}</strong>
              </div>
              <div>
                <span>Ultima actualizacion</span>
                <strong>{formatUpdatedAt(sensor.creado_en)}</strong>
              </div>
            </div>

            <div className={`estadoAdvice ${sensorConnected ? "rec-bueno" : "rec-regular"}`}>
              <strong>Recomendacion del sensor</strong>
              <p>{getSensorRecommendation(sensor)}</p>
            </div>
          </>
        ) : (
          <p className="estadoEmpty">Aun no hay lecturas del sensor disponibles.</p>
        )}
      </section>

      <section className="estadoPanel">
        <div className="estadoPanelHead">
          <div>
              <span className="estadoSectionEyebrow">Resumen</span>
            <h3>Datos utiles para decidir si jugar</h3>
          </div>
          <p>
            Una lectura rapida de las condiciones que mas influyen en pista.
          </p>
        </div>

        <div className="estadoMetricsGrid">
          {overviewItems.map((item) => (
            <article className="estadoMetricCard" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="estadoDetailLayout">
        <article className="estadoForecastCard">
          <div className="estadoSectionHead">
            <span className="estadoSectionEyebrow">Prevision</span>
            <h3>Prevision de los proximos dias</h3>
          </div>

          <div className="estadoForecastList">
            {weather?.forecast?.length ? (
              weather.forecast.map((day) => (
                <div className="estadoForecastRow" key={day.date}>
                  <span className="estadoForecastDay">
                    {new Date(day.date).toLocaleDateString("es-ES", {
                      weekday: "short",
                      day: "2-digit",
                    })}
                  </span>
                  <span className="estadoForecastIcon">{day.emoji}</span>
                  <span className="estadoForecastText">{day.description}</span>
                  <span className="estadoForecastTemp">
                    {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                  </span>
                </div>
              ))
            ) : (
              <p className="estadoEmpty">La prevision aparecera aqui cuando haya datos disponibles.</p>
            )}
          </div>
        </article>

        <article className="estadoModuleCard">
          <div className="estadoSectionHead">
            <span className="estadoSectionEyebrow">Consejos</span>
            <h3>Antes de entrar en pista</h3>
          </div>

          <ul className="estadoModuleList">
            <li>Revisa viento y lluvia antes de salir de casa.</li>
            <li>Si hay calor, hidrata bien y evita las horas mas duras.</li>
            <li>Con frio, calienta unos minutos mas antes de jugar.</li>
            <li>Si la pista aparece en riesgo, consulta con el club antes de reservar.</li>
          </ul>
        </article>
      </section>

      <section className="estadoPhotosSection">
        <div className="estadoSectionHead">
          <span className="estadoSectionEyebrow">Pistas</span>
          <h3>Fotos del entorno de juego</h3>
        </div>

        {photos.length > 0 ? (
          <div className="estadoPhotosGrid">
            {photos.map((photo) => (
              <article className="estadoPhotoCard" key={photo.id}>
                <img src={photo.src} alt={photo.title} className="estadoPhotoImage" />
                <div className="estadoPhotoBody">
                  <strong>{photo.title}</strong>
                  <p>{photo.desc}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="estadoPhotoPlaceholder">
            <strong>Aun no hay fotos de pista.</strong>
            <p>
              Cuando el club anada fotos del entorno de juego, apareceran aqui.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

export default EstadoPista;
