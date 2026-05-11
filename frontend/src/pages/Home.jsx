import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getWeatherForClub } from "../services/weatherService";
import HomeNewsCard from "../components/HomeNewsCard";
import "./home.css";

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;

const PLATFORM_ITEMS = [
  {
    icon: "🎾",
    title: "Reservar pista sin complicarte",
    description:
      "Mira los huecos libres, elige pista y confirma tu reserva en pocos pasos.",
  },
  {
    icon: "📚",
    title: "Seguir tus clases de la escuela",
    description:
      "Consulta grupos, horarios y avisos para entrenar siempre con la informacion clara.",
  },
  {
    icon: "🏆",
    title: "Estar al dia de torneos y liga",
    description:
      "Revisa competiciones, jornadas y momentos del club sin perderte lo importante.",
  },
  {
    icon: "🌦️",
    title: "Comprobar la pista antes de salir",
    description:
      "Consulta tiempo, viento y recomendacion de juego antes de venir al club.",
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
    description: "Consulta niveles y horarios de la escuela.",
    to: "/clases",
    accent: "blue",
  },
  {
    icon: "🏆",
    title: "Torneos y liga",
    description: "Mira torneos, plazas y fechas.",
    to: "/torneos",
    accent: "gold",
  },
  {
    icon: "📸",
    title: "Galeria del club",
    description: "Fotos de alumnos, clases y jornadas.",
    to: "/galeria",
    accent: "slate",
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
    title: "Sesion tecnica para mejorar bandeja y red",
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

  const featuredNews = NEWS_ITEMS.find((item) => item.featured) || NEWS_ITEMS[0];
  const secondaryNews = NEWS_ITEMS.filter((item) => item.id !== featuredNews.id);

  return (
    <section className="home">
      <section className="hero">
        <div className="heroCard heroGrid">
          <div className="heroLeft">
            <div className="pill">
              <span className="dot" aria-hidden="true" />
              Escuela Norba Padel | Clases, reservas y club
            </div>

            <h2>
              Tu escuela de padel,
              <br />
              mas facil de seguir.
            </h2>

            <p>
              Todo lo que necesitas para entrenar, reservar pista y estar al dia con la escuela,
              tambien con el estado de pista conectado al sensor <strong>XIAO</strong>.
            </p>

            <div className="ctaRow">
              <Link className="btn btn-primary" to="/reservas">
                Reservar pista
              </Link>
              <Link className="btn btn-ghost" to="/clases">
                Ver clases
              </Link>
            </div>
          </div>

          <div className="heroRight">
            <div className="heroStatusStrip" aria-label="Resumen rapido del club">
              <div className="heroStatusItem">
                <span>Reservas</span>
                <strong>Rapidas</strong>
              </div>
              <div className="heroStatusItem">
                <span>Clases</span>
                <strong>Por nivel</strong>
              </div>
              <div className="heroStatusItem">
                <span>Club</span>
                <strong>Activo</strong>
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
                  <span className="weatherEyebrow">Tiempo en pista</span>
                  <h4>Antes de venir a jugar</h4>
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
                    Pulsa para ver la prevision y recomendaciones antes de reservar.
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
            <Link className="weatherModalPageLink" to="/estado-pista">
              Abrir pagina completa
            </Link>
          </div>
        </div>
      )}

      <section className="features">
        <div className="platformBlock">
          <div className="platformIntro">
            <span className="sectionEyebrow">Que puedes hacer</span>
            <h3>Todo lo importante de la escuela en un mismo sitio</h3>
            <p>
              Consulta tus clases, reserva pista, revisa torneos y mira si las condiciones acompanan
              antes de venir al club.
            </p>
            <div className="platformLeadCard">
              <strong>Hecha para alumnos, familias y el equipo de la escuela.</strong>
              <span>
                Menos dudas, menos mensajes sueltos y mas informacion clara para entrenar y jugar.
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
              <span className="sectionEyebrow">Empieza aqui</span>
              <h3>Lo que mas se usa en el club</h3>
            </div>
            <p>
              Atajos para reservar, consultar clases, ver torneos y seguir la vida de la escuela.
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
