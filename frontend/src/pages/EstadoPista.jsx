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
        setError(err.message || "No hemos podido cargar el estado de pista.");
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
