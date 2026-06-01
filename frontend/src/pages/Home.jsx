import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getWeatherForClub } from "../services/weatherService";
import { apiGet } from "../services/api";
import { isLogged } from "../services/auth";
import HomeNewsCard from "../components/HomeNewsCard";
import "./home.css";

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;

const PLATFORM_ITEMS = [
  {
    icon: "Reserva",
    title: "Reservas online",
    description:
      "Consulta huecos libres, elige pista y confirma tu reserva sin llamadas ni listas en papel.",
  },
  {
    icon: "Partidas",
    title: "Partidas abiertas",
    description:
      "Crea partidas con jugadores e invitados, controla plazas y avisa cuando el grupo se completa.",
  },
  {
    icon: "Clases",
    title: "Clases y grupos",
    description:
      "Organiza alumnos por niveles, horarios y grupos para que cada familia tenga la información clara.",
  },
  {
    icon: "Avisos",
    title: "Avisos del club",
    description:
      "Recibe comunicaciones importantes sobre reservas, clases, torneos y cambios de ultima hora.",
  },
  {
    icon: "Torneos",
    title: "Torneos y jornadas",
    description:
      "Consulta competiciones, fechas, plazas y actividades especiales organizadas por el club.",
  },
  {
    icon: "Tienda",
    title: "Tienda del club",
    description:
      "Encuentra material, servicios y productos utiles para entrenar y jugar mejor.",
  },
];

const QUICK_LINKS = [
  {
    icon: "Reserva",
    title: "Reservar pista",
    description: "Elige hora, pista y juega sin esperas.",
    to: "/reservas",
    accent: "green",
  },
  {
    icon: "Clases",
    title: "Clases por niveles",
    description: "Consulta niveles y horarios de la escuela.",
    to: "/clases",
    accent: "blue",
  },
  {
    icon: "Torneos",
    title: "Torneos y liga",
    description: "Mira torneos, plazas y fechas.",
    to: "/torneos",
    accent: "gold",
  },
  {
    icon: "Tienda",
    title: "Tienda del club",
    description: "Material y servicios para alumnos.",
    to: "/tienda",
    accent: "slate",
  },
];

const PROJECT_POINTS = [
  {
    value: "Menos dudas",
    label: "La información importante queda visible para todos.",
  },
  {
    value: "Más rápido",
    label: "Reservas, partidos y avisos sin depender de mensajes sueltos.",
  },
  {
    value: "Para el dia a dia",
    label: "Pensado para alumnos, familias, profesores y equipo del club.",
  },
];
const NEWS_ITEMS = [
  {
    id: 1,
    category: "Liga",
    date: "26 abr 2026",
    title: "La liga femenina suma otra buena jornada en casa",
    summary:
      "El equipo compitio con buen ritmo y el ambiente del club se noto desde el primer partido.",
    image: `${process.env.PUBLIC_URL}/fotosLiga/ligafem.jpeg`,
    featured: true,
  },
  {
    id: 2,
    category: "Clases",
    date: "24 abr 2026",
    title: "Sesión técnica para mejorar bandeja y red",
    summary:
      "Los grupos trabajan situaciones reales de partido para ganar confianza y ordenar mejor el juego.",
    image: `${process.env.PUBLIC_URL}/fotosClase/clases.jpeg`,
  },
  {
    id: 3,
    category: "Club",
    date: "22 abr 2026",
    title: "Premios y buen ambiente tras el torneo del club",
    summary:
      "Alumnos y familias compartieron pista, premios y una jornada de esas que hacen club.",
    image: `${process.env.PUBLIC_URL}/fotosAlumnos/premiodanipau.jpeg`,
  },
  {
    id: 4,
    category: "Alumnos",
    date: "19 abr 2026",
    title: "Mas partidos entre alumnos durante la semana",
    summary:
      "La escuela sigue creciendo con reservas, clases y partidos organizados entre alumnos.",
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
  const loggedIn = isLogged();
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [activeAlertsError, setActiveAlertsError] = useState("");

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError("");
        const data = await getWeatherForClub(CLUB_LAT, CLUB_LON);
        if (!data.ok) throw new Error("No hemos podido consultar el tiempo.");
        setWeather(data);
      } catch (err) {
        setWeatherError(err.message || "No hemos podido consultar el tiempo.");
      } finally {
        setWeatherLoading(false);
      }
    };

    loadWeather();
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    apiGet("/api/notificaciones?limit=3&active=1&important=1")
      .then((data) => {
        setActiveAlerts(data.notifications || []);
        setActiveAlertsError("");
      })
      .catch(() => {
        setActiveAlerts([]);
        setActiveAlertsError("No se pudieron cargar las notificaciones. Inténtalo de nuevo más tarde.");
      });
  }, [loggedIn]);

  const featuredNews = NEWS_ITEMS.find((item) => item.featured) || NEWS_ITEMS[0];
  const secondaryNews = NEWS_ITEMS.filter((item) => item.id !== featuredNews.id);

  return (
    <main className="home" aria-labelledby="home-title">
      <header className="hero">
        <div className="heroCard heroGrid">
          <div className="heroLeft">
            <div className="pill">
              <span className="dot" aria-hidden="true" />
              Escuela NaniPadel
            </div>

            <h1 id="home-title">Tu escuela de pádel, organizada en una sola app.</h1>

            <p>
              NaniPadel centraliza reservas, partidas abiertas, clases, torneos y avisos del club
              para que alumnos, familias y profesores tengan toda la información siempre a mano.
            </p>

            <div className="ctaRow">
              <Link className="btn btn-primary" to="/reservas">
                Reservar pista
              </Link>
              <Link className="btn btn-ghost" to="/clases">
                Ver clases
              </Link>
              <Link className="btn btn-ghost" to="/torneos">
                Ver torneos
              </Link>
              <Link className="btn btn-ghost" to={loggedIn ? "/avisos" : "/login"}>
                {loggedIn ? "Mis avisos" : "Iniciar sesión"}
              </Link>
            </div>

            <div className="heroProof" aria-label="Ventajas principales de NaniPadel">
              <span>Reservas online</span>
              <span>Partidas abiertas</span>
              <span>Avisos del club</span>
            </div>
          </div>

          <div className="heroRight">
            <div className="heroStatusStrip" aria-label="Resumen rápido del club">
              <div className="heroStatusItem">
                <span>Reservas</span>
                <strong>Online</strong>
              </div>
              <div className="heroStatusItem">
                <span>Partidas</span>
                <strong>Abiertas</strong>
              </div>
              <div className="heroStatusItem">
                <span>Avisos</span>
                <strong>Conectados</strong>
              </div>
            </div>

            <div
              className="weatherBox weatherBoxClickable"
              onClick={() => weather && setShowWeatherModal(true)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && weather) {
                  event.preventDefault();
                  setShowWeatherModal(true);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Abrir detalle del tiempo y estado de pista"
            >
              <div className="weatherTop">
                <div>
                  <span className="weatherEyebrow">Tiempo en pista</span>
                  <h2>Antes de venir a jugar</h2>
                </div>
                <span className="weatherBadge">Ahora</span>
              </div>

              {weatherLoading && <p className="weatherHint">Cargando tiempo...</p>}

              {!weatherLoading && weatherError && (
                <p className="weatherHint">{weatherError}</p>
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
                      Pista: {weather.pista === "RIESGO" ? "Revisar antes" : "Buena para jugar"}
                    </span>
                  </div>

                  <p className="weatherHint">
                    Pulsa para ver la previsión y recomendaciones antes de reservar.
                  </p>
                  <Link
                    className="weatherPageLink"
                    to="/estado-pista"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Ver estado completo
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {showWeatherModal && weather && (
        <div className="weatherModalBackdrop" onClick={() => setShowWeatherModal(false)}>
          <div className="weatherModal" onClick={(event) => event.stopPropagation()}>
            <div className="weatherModalHead">
              <h2>Tiempo en Norba Padel</h2>
              <button
                className="weatherCloseBtn"
                onClick={() => setShowWeatherModal(false)}
                aria-label="Cerrar detalle del tiempo"
              >
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
                <h3>Previsión de los próximos 7 días</h3>
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
            <Link className="weatherModalPageLink" to="/estado-pista">
              Abrir pagina completa
            </Link>
          </div>
        </div>
      )}

      {loggedIn && (
        <section className="homeAlerts">
          <div className="sectionHeader sectionHeaderInline">
            <div>
              <span className="sectionEyebrow">Avisos activos</span>
              <h2>Lo importante del club</h2>
            </div>
            <Link className="newsMoreBtn" to="/avisos">
              Ver todos
            </Link>
          </div>

          {activeAlertsError ? (
            <p className="homeAlertsEmpty">{activeAlertsError}</p>
          ) : activeAlerts.length === 0 ? (
            <p className="homeAlertsEmpty">No tienes avisos pendientes.</p>
          ) : (
            <div className="homeAlertsGrid">
              {activeAlerts.map((item) => (
                <Link className={`homeAlertCard priority-${item.priority || "normal"}`} to="/avisos" key={item.id}>
                  <span>{item.category || item.tipo}</span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="projectStory" aria-labelledby="project-story-title">
        <div className="projectStoryIntro">
          <span className="sectionEyebrow">Club organizado</span>
          <h2 id="project-story-title">Todo el club mejor organizado.</h2>
          <p>
            Evita mensajes perdidos, horarios duplicados y dudas de ultima hora. Cada jugador puede
            consultar sus reservas, clases, avisos y torneos desde el mismo sitio.
          </p>
        </div>
        <div className="projectStoryGrid">
          {PROJECT_POINTS.map((item) => (
            <article className="projectStoryItem" key={item.value}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="features">
        <div className="platformBlock">
          <div className="platformIntro">
            <span className="sectionEyebrow">Qué puedes hacer</span>
            <h2>Todo lo importante de la escuela en un mismo sitio</h2>
            <p>
              Reserva pista, crea partidas abiertas, sigue tus clases, consulta avisos y mantente al
              dia de torneos, jornadas y servicios del club.
            </p>
            <div className="platformLeadCard">
              <strong>Hecha para alumnos, familias y el equipo de la escuela.</strong>
              <span>
                Menos dudas, menos mensajes sueltos y más información clara para entrenar y jugar.
              </span>
            </div>
          </div>

          <div className="platformGrid">
            {PLATFORM_ITEMS.map((item) => (
              <article className="platformItem" key={item.title}>
                <span className="platformIcon">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="quick">
        <div className="quickCard">
          <div className="sectionHeader sectionHeaderInline">
            <div>
              <span className="sectionEyebrow">Empieza aquí</span>
              <h2>Lo que más se usa en el club</h2>
            </div>
            <p>
              Atajos para reservar, consultar clases, ver torneos y entrar en la tienda del club.
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
            <h2>Noticias del club</h2>
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
              <h3>{featuredNews.title}</h3>
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
    </main>
  );
}

export default Home;
