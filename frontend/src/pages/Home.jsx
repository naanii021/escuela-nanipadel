import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getWeatherForClub } from "../services/weatherService";
import HomeNewsCard from "../components/HomeNewsCard";
import "./home.css";

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;

const FEATURES = [
  {
    icon: "🎾",
    title: "Reservas rapidas y claras",
    description:
      "Consulta disponibilidad real de pistas, encuentra tu hueco y confirma en segundos sin llamadas ni cruces de mensajes.",
  },
  {
    icon: "📚",
    title: "Clases por nivel y objetivo",
    description:
      "Desde iniciacion hasta competicion, con grupos, horarios y seguimiento pensados para una escuela de padel viva.",
  },
  {
    icon: "🏆",
    title: "Torneos, liga y vida de club",
    description:
      "Toda la actividad del club en un mismo sitio: competiciones, jornadas, avisos y momentos que mantienen la comunidad en movimiento.",
  },
  {
    icon: "🌦️",
    title: "Estado de pista con sensor XIAO",
    description:
      "El tiempo y las condiciones de juego forman parte del proyecto: una capa util para decidir cuando reservar y como preparar la sesion.",
  },
];

const QUICK_LINKS = [
  {
    icon: "🎾",
    title: "Reservar pista",
    description: "Elige hora, pista y juega sin esperas.",
    to: "/reservas",
    accent: "green",
  },
  {
    icon: "📘",
    title: "Clases por niveles",
    description: "Busca el grupo que mejor encaja contigo.",
    to: "/clases",
    accent: "blue",
  },
  {
    icon: "🏆",
    title: "Torneos y liga",
    description: "Sigue la actividad competitiva del club.",
    to: "/torneos",
    accent: "gold",
  },
  {
    icon: "📸",
    title: "Galeria del club",
    description: "Revisa fotos de alumnos, jornadas y eventos.",
    to: "/galeria",
    accent: "slate",
  },
];

const NEWS_ITEMS = [
  {
    id: 1,
    category: "Liga",
    date: "26 abr 2026",
    title: "La liga femenina firma otra jornada solida en casa",
    summary:
      "El equipo mantiene buenas sensaciones tras una nueva ronda con ritmo alto, buen ambiente y apoyo del club en pista.",
    image: `${process.env.PUBLIC_URL}/fotosLiga/ligafem.jpeg`,
    featured: true,
  },
  {
    id: 2,
    category: "Clases",
    date: "24 abr 2026",
    title: "Nueva sesion tecnica con foco en bandeja y juego de red",
    summary:
      "Los grupos de clases siguen trabajando automatismos y lectura de punto con sesiones mas dinamicas y seguimiento por nivel.",
    image: `${process.env.PUBLIC_URL}/fotosClase/clases.jpeg`,
  },
  {
    id: 3,
    category: "Club",
    date: "22 abr 2026",
    title: "Premios y momentos destacados tras el torneo del club",
    summary:
      "La entrega de premios refuerza el ambiente de escuela real, con alumnos, competicion y comunidad compartiendo pista y club.",
    image: `${process.env.PUBLIC_URL}/fotosAlumnos/premiodanipau.jpeg`,
  },
  {
    id: 4,
    category: "Alumnos",
    date: "19 abr 2026",
    title: "Mas actividad social y partidos entre alumnos durante la semana",
    summary:
      "La plataforma sigue ayudando a mover reservas, clases y partidos entre alumnos para que el club no se pare.",
    image: `${process.env.PUBLIC_URL}/fotosAlumnos/nani.jpeg`,
  },
];

function formatDay(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === tomorrow.toDateString()) return "Manana";

  return date.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" });
}

function Home() {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError("");
        const data = await getWeatherForClub(CLUB_LAT, CLUB_LON);
        if (!data.ok) throw new Error("No se pudo obtener el tiempo");
        setWeather(data);
      } catch (err) {
        setWeatherError(err.message || "Error obteniendo el tiempo");
      } finally {
        setWeatherLoading(false);
      }
    };

    loadWeather();
  }, []);

  const featuredNews = NEWS_ITEMS.find((item) => item.featured) || NEWS_ITEMS[0];
  const secondaryNews = NEWS_ITEMS.filter((item) => item.id !== featuredNews.id);

  return (
    <section className="home">
      <section className="hero">
        <div className="heroCard heroGrid">
          <div className="heroLeft">
            <div className="pill">
              <span className="dot" aria-hidden="true" />
              Escuela Norba Padel | Club, clases y reservas
            </div>

            <h2>
              Tu escuela de padel,
              <br />
              mejor organizada y mas viva.
            </h2>

            <p>
              Una plataforma pensada para un club real: reservas rapidas, clases por nivel,
              competicion activa y estado de pista conectado al proyecto con sensor <strong>XIAO</strong>.
            </p>

            <div className="ctaRow">
              <Link className="btn btn-primary" to="/reservas">
                Reservar pista
              </Link>
              <Link className="btn btn-ghost" to="/clases">
                Ver clases
              </Link>
              <Link className="btn btn-ghost" to="/torneos">
                Torneos y liga
              </Link>
            </div>

            <div className="heroNotes">
              <div className="heroNoteCard">
                <strong>Club activo cada semana</strong>
                <span>Clases, reservas, torneos y alumnos moviendo la escuela a diario.</span>
              </div>
              <div className="heroNoteCard">
                <strong>Informacion util antes de jugar</strong>
                <span>El bloque del tiempo ayuda a decidir cuando reservar y como preparar la pista.</span>
              </div>
            </div>
          </div>

          <div className="heroRight">
            <div className="kpi">
              <div className="kpiItem">
                <strong>Reservas en 30s</strong>
                <span>Proceso rapido y claro para jugar sin rodeos</span>
              </div>
              <div className="kpiItem">
                <strong>Escuela por niveles</strong>
                <span>Clases, grupos y horarios para cada perfil</span>
              </div>
              <div className="kpiItem">
                <strong>Club conectado</strong>
                <span>Competicion, actividad y seguimiento en un mismo sitio</span>
              </div>
            </div>

            {/* El tiempo sigue siendo una pieza principal del valor del proyecto */}
            <div
              className="weatherBox weatherBoxClickable"
              onClick={() => weather && setShowWeatherModal(true)}
              role="button"
              tabIndex={0}
            >
              <div className="weatherTop">
                <div>
                  <span className="weatherEyebrow">Sensor XIAO en pista</span>
                  <h4>Tiempo y estado de juego</h4>
                </div>
                <span className="weatherBadge">Ver mas</span>
              </div>

              {weatherLoading && <p className="weatherHint">Cargando tiempo...</p>}

              {!weatherLoading && weatherError && (
                <p className="weatherHint">Error: {weatherError}</p>
              )}

              {!weatherLoading && !weatherError && weather && (
                <>
                  <div className="weatherMain">
                    <div className="weatherIcon" aria-hidden="true">
                      {weather.emoji}
                    </div>
                    <div>
                      <p className="weatherTemp">{weather.temperature}ºC</p>
                      <p className="weatherDesc">{weather.description}</p>
                    </div>
                  </div>

                  <div className="weatherStatusRow">
                    <div className="weatherStatusCard">
                      <span>Estado pista</span>
                      <strong>{weather.pista}</strong>
                    </div>
                    <div className="weatherStatusCard">
                      <span>Sensacion</span>
                      <strong>{Math.round(weather.apparentTemperature)}ºC</strong>
                    </div>
                  </div>

                  <div className="weatherChips">
                    <span className="chip">Viento: {weather.windSpeed} km/h</span>
                    <span className="chip">Lluvia: {weather.precipitationProbability}%</span>
                    <span className={`chip ${weather.pista === "RIESGO" ? "chipRisk" : "chipOk"}`}>
                      Jugar: {weather.pista === "RIESGO" ? "Con cautela" : "Buen momento"}
                    </span>
                  </div>

                  <p className="weatherHint">
                    Pulsa para ver prevision semanal, humedad, UV y recomendaciones de juego.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {showWeatherModal && weather && (
        <div className="weatherModalBackdrop" onClick={() => setShowWeatherModal(false)}>
          <div className="weatherModal" onClick={(event) => event.stopPropagation()}>
            <div className="weatherModalHead">
              <h3>Tiempo en Norba Padel</h3>
              <button className="weatherCloseBtn" onClick={() => setShowWeatherModal(false)}>
                ×
              </button>
            </div>

            <div className="weatherCurrentBig">
              <div className="weatherCurrentIcon">{weather.emoji}</div>
              <div className="weatherCurrentInfo">
                <p className="weatherCurrentTemp">{Math.round(weather.temperature)}°C</p>
                <p className="weatherCurrentDesc">{weather.description}</p>
                <p className="weatherCurrentFeel">
                  Sensacion termica: {Math.round(weather.apparentTemperature)}°C
                </p>
              </div>
            </div>

            <div className="weatherDetailGrid">
              <div className="weatherDetailItem">
                <span className="wdLabel">Humedad</span>
                <span className="wdValue">{weather.humidity}%</span>
              </div>
              <div className="weatherDetailItem">
                <span className="wdLabel">Viento</span>
                <span className="wdValue">{weather.windSpeed} km/h</span>
              </div>
              <div className="weatherDetailItem">
                <span className="wdLabel">Lluvia</span>
                <span className="wdValue">{weather.precipitationProbability}%</span>
              </div>
              <div className="weatherDetailItem">
                <span className="wdLabel">Indice UV</span>
                <span className="wdValue">{weather.uvIndex ?? "-"}</span>
              </div>
            </div>

            {weather.recomendacion && (
              <div className={`recomendacionBox rec-${weather.recomendacion.nivel}`}>
                <div className="recIcon">{weather.recomendacion.icono}</div>
                <div className="recText">
                  <strong>{weather.recomendacion.titulo}</strong>
                  <p>{weather.recomendacion.mensaje}</p>
                </div>
              </div>
            )}

            {weather.forecast && weather.forecast.length > 0 && (
              <div className="forecastSection">
                <h4>Prevision de los proximos 7 dias</h4>
                <div className="forecastList">
                  {weather.forecast.map((day) => (
                    <div className="forecastDay" key={day.date}>
                      <span className="fDayName">{formatDay(day.date)}</span>
                      <span className="fDayIcon">{day.emoji}</span>
                      <span className="fDayDesc">{day.description}</span>
                      <span className="fDayTemps">
                        <strong>{Math.round(day.tempMax)}°</strong>
                        <span className="fDayMin"> / {Math.round(day.tempMin)}°</span>
                      </span>
                      <span className="fDayRain">{day.precipitationProbability}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="weatherUpdated">
              Actualizado: {new Date(weather.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <section className="features">
        <div className="sectionHeader">
          <span className="sectionEyebrow">Por que funciona</span>
          <h3>Una home pensada para mover una escuela de padel real</h3>
          <p>
            La plataforma no solo muestra informacion: organiza reservas, clases, competicion y
            condiciones de juego para que el club tenga ritmo todos los dias.
          </p>
        </div>

        <div className="featuresGrid">
          {FEATURES.map((feature) => (
            <article className="featureCard" key={feature.title}>
              <span className="featureIcon">{feature.icon}</span>
              <strong>{feature.title}</strong>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="quick">
        <div className="quickCard">
          <div className="sectionHeader sectionHeaderInline">
            <div>
              <span className="sectionEyebrow">Empieza aqui</span>
              <h3>Accesos rapidos del club</h3>
            </div>
            <p>
              Las acciones que mas usa una escuela real: reservar, revisar clases, seguir torneos y
              ver la actividad del club.
            </p>
          </div>

          <div className="quickGrid">
            {QUICK_LINKS.map((item) => (
              <Link className={`quickItem quickItem-${item.accent}`} to={item.to} key={item.title}>
                <span className="qiIcon">{item.icon}</span>
                <span className="qiTitle">{item.title}</span>
                <span className="qiDesc">{item.description}</span>
                <span className="qiAction">Entrar</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="newsSection">
        <div className="sectionHeader sectionHeaderInline">
          <div>
            <span className="sectionEyebrow">Club en marcha</span>
            <h3>Noticias del club</h3>
          </div>
          <Link className="newsMoreBtn" to="/galeria">
            Ver todas
          </Link>
        </div>

        <div className="newsLayout">
          <article className="newsFeatured">
            <img src={featuredNews.image} alt={featuredNews.title} className="newsFeaturedImage" />
            <div className="newsFeaturedOverlay" />
            <div className="newsFeaturedContent">
              <div className="newsMeta">
                <span className="newsCategory">{featuredNews.category}</span>
                <span className="newsDate">{featuredNews.date}</span>
              </div>
              <h4>{featuredNews.title}</h4>
              <p>{featuredNews.summary}</p>
              <Link className="newsReadBtn" to="/galeria">
                Seguir actividad del club
              </Link>
            </div>
          </article>

          <div className="newsList">
            {secondaryNews.map((item) => (
              <HomeNewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

export default Home;
