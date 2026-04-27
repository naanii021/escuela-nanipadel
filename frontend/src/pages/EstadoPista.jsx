import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWeatherForClub } from "../services/weatherService";
import "./estadoPista.css";

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;
const COURT_PHOTOS_MANIFEST = `${process.env.PUBLIC_URL}/court-photos-manifest.json`;

function formatUpdatedAt(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES");
}

function EstadoPista() {
  const [weather, setWeather] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPageData() {
      try {
        setLoading(true);
        setError("");

        const [weatherData, photosResponse] = await Promise.all([
          getWeatherForClub(CLUB_LAT, CLUB_LON),
          fetch(COURT_PHOTOS_MANIFEST, { cache: "no-store" }).catch(() => null),
        ]);

        if (!mounted) return;

        setWeather(weatherData);

        if (photosResponse?.ok) {
          const manifest = await photosResponse.json();
          setPhotos(Array.isArray(manifest.photos) ? manifest.photos : []);
        } else {
          setPhotos([]);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "No se pudo cargar el estado de pista");
      } finally {
        if (mounted) setLoading(false);
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

  return (
    <section className="estadoPistaPage">
      <section className="estadoHero">
        <div className="estadoHeroMain">
          <span className="estadoEyebrow">Sensor XIAO y tiempo en pista</span>
          <h1>Estado completo de pista y condiciones de juego</h1>
          <p>
            Pagina propia para el modulo diferencial del proyecto. Aqui queda lista la base para
            mostrar el estado de juego con mas claridad, mas contexto y mejor lectura para el club.
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

      <section className="estadoPanel">
        <div className="estadoPanelHead">
          <div>
            <span className="estadoSectionEyebrow">Resumen tecnico</span>
            <h3>Datos listos para el modulo de pista</h3>
          </div>
          <p>
            Estructura lista para conectar mejor el sensor XIAO y crecer sin tocar la home.
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
            <h3>Lectura de los proximos dias</h3>
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
              <p className="estadoEmpty">La prevision aparecera aqui cuando haya datos cargados.</p>
            )}
          </div>
        </article>

        <article className="estadoModuleCard">
          <div className="estadoSectionHead">
            <span className="estadoSectionEyebrow">Modulo XIAO</span>
            <h3>Base visual para el proyecto</h3>
          </div>

          <ul className="estadoModuleList">
            <li>Espacio claro para estado de pista y recomendacion de juego.</li>
            <li>Tarjetas separadas para metricas ambientales y lectura rapida.</li>
            <li>Zona lista para ampliar sensores, historico o alertas futuras.</li>
            <li>Diseno coherente con home, galeria y resto del club.</li>
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
            <strong>Sin carpeta de pistas todavia.</strong>
            <p>
              Si luego creas <code>frontend/public/fotosPista</code>, esta pagina cargara las fotos
              sola.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

export default EstadoPista;
