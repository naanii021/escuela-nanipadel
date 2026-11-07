import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { getWeatherForClub, isRainy } from "../services/weatherService";
import { apiGet } from "../services/api";
import { getUser, isLogged } from "../services/auth";
import WeatherCourt3D from "../components/WeatherCourt3D";
import Hoja from "../components/Hoja";
import MisReservas from "../components/MisReservas";
import ContactoClub from "../components/ContactoClub";
import { ahoraMadrid, fechaRelativa } from "../services/fechas";
import "./home.css";
import "./inicio.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];
const DAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;

const ACTIONS = [
  { label: "Reservar pista", to: "/reservas", primary: true },
  { label: "Clases", to: "/clases" },
  { label: "Torneos", to: "/torneos" },
];

const SCENES = [
  { id: "ahora", label: "Ahora" },
  { id: "dia", label: "Día", night: false },
  { id: "noche", label: "Noche", night: true },
];

// Fotos destacadas del club (sin fecha: no son noticias, son imágenes de la galería).
const PHOTO_ITEMS = [
  {
    id: 1,
    category: "Liga",
    title: "La liga femenina jugando en casa",
    image: `${process.env.PUBLIC_URL}/fotosLiga/ligafem.jpeg`,
  },
  {
    id: 2,
    category: "Clases",
    title: "Clase técnica de bandeja y red",
    image: `${process.env.PUBLIC_URL}/fotosClase/clases.jpeg`,
  },
  {
    id: 3,
    category: "Torneos",
    title: "Entrega de premios del torneo del club",
    image: `${process.env.PUBLIC_URL}/fotosAlumnos/premiodanipau.jpeg`,
  },
];

function formatDay(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === tomorrow.toDateString()) return "Mañana";

  return date.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" });
}

function formatHour(isoTime) {
  return new Date(isoTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function Home() {
  const loggedIn = isLogged();
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [sceneId, setSceneId] = useState("ahora");
  const [todayClasses, setTodayClasses] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [activeAlertsError, setActiveAlertsError] = useState("");
  const [nextClass, setNextClass] = useState(null);
  const role = String(getUser()?.rol || "").toLowerCase();
  const isStaff = loggedIn && STAFF_ROLES.includes(role);

  const loadWeather = useCallback(async () => {
    try {
      setWeatherError("");
      const data = await getWeatherForClub(CLUB_LAT, CLUB_LON);
      if (!data.ok) throw new Error("No hemos podido consultar el tiempo.");
      setWeather(data);
    } catch (err) {
      setWeatherError(err.message || "No hemos podido consultar el tiempo.");
    }
  }, []);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

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

  // Alumno: su próxima clase, para no tener que entrar en Clases.
  useEffect(() => {
    if (!loggedIn || isStaff) return;
    apiGet("/api/clases/mis-clases")
      .then((data) => {
        if (data?.tipoVista !== "alumno") return;
        const sesion = (data.proximasSesiones || data.proximas_clases || [])[0];
        if (!sesion) return;
        const grupo = (data.clases || []).find((item) => String(item.id) === String(sesion.grupo_id)) || data.grupo || {};
        setNextClass({
          fecha: sesion.fecha,
          hora: String(sesion.hora_inicio || grupo.hora_inicio || "").slice(0, 5),
          nombre: grupo.nombre || "Tu clase",
          pista: sesion.pista_habitual || grupo.pista_habitual || "",
        });
      })
      .catch(() => setNextClass(null));
  }, [loggedIn, isStaff]);

  // Atajo para profesores y admin: las clases de hoy con acceso directo a pasar lista.
  useEffect(() => {
    if (!isStaff) return;
    apiGet("/api/gestion/control/grupos")
      .then((data) => {
        const today = DAY_LETTERS[new Date().getDay()];
        const own = data.profesor_actual_id
          ? data.grupos.filter((group) => group.profesor_id === data.profesor_actual_id)
          : data.grupos;
        setTodayClasses(
          own
            .filter((group) => group.dia1 === today || group.dia2 === today)
            .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)))
        );
      })
      .catch(() => setTodayClasses([]));
  }, [isStaff]);

  // Clase de ahora (empezada y sin terminar) y la siguiente, en hora de Madrid.
  const nowMinutes = (() => {
    const [hh, mm] = ahoraMadrid().hora.split(":").map(Number);
    return hh * 60 + mm;
  })();
  const toMinutes = (value) => {
    const [hh, mm] = String(value || "").split(":").map(Number);
    return hh * 60 + (mm || 0);
  };
  const nowClassId = todayClasses.find((g) => toMinutes(g.hora_inicio) <= nowMinutes && nowMinutes < toMinutes(g.hora_inicio) + Number(g.duracion_min || 60))?.id;
  const nextClassId = todayClasses.find((g) => toMinutes(g.hora_inicio) > nowMinutes)?.id;

  const scene = SCENES.find((item) => item.id === sceneId) || SCENES[0];
  const sceneIndex = SCENES.indexOf(scene);
  const previewing = scene.id !== "ahora";
  const night = scene.night ?? Number(weather?.isDay) === 0;
  const rain = scene.rain ?? (weather ? isRainy(weather) : false);
  const playable = weather ? weather.playability.playable : null;
  const verdictClass = playable === null ? "isPending" : playable ? "isPlayable" : "isBlocked";
  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let headline = "Consultando el tiempo…";
  if (weatherError) headline = "No hemos podido ver el tiempo";
  else if (playable === true) headline = "Hoy se puede jugar";
  else if (playable === false) headline = "Hoy mejor no jugar";

  return (
    <div className="inicio">
      {todayClasses.length > 0 && (
        <section className="inicioHoy" aria-labelledby="inicio-hoy-title">
          <div className="sectionHeader sectionHeaderInline">
            <div>
              <h2 id="inicio-hoy-title">Hoy: pasar lista</h2>
            </div>
          </div>
          <ul className="inicioHoyList">
            {todayClasses.map((group) => {
              const label = group.id === nowClassId ? "Ahora" : group.id === nextClassId ? "Siguiente" : "";
              return (
                <li key={group.id} className={label ? `is${label}` : ""}>
                  <Link to={`/panel?seccion=control&grupo=${group.id}`}>
                    <strong>{String(group.hora_inicio).slice(0, 5)}</strong>
                    <span>
                      {label && <b className="inicioHoyEtiqueta">{label}</b>}
                      {String(group.nombre).replace(/\s*·\s*\d{1,2}:\d{2}\s*$/, "")}
                      {group.pista_habitual ? <small>{group.pista_habitual}</small> : null}
                    </span>
                    <em>Pasar lista</em>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={`inicioHero${night ? " isNight" : ""}${rain ? " isRaining" : ""}`}>
        <WeatherCourt3D weather={weather} night={night} rain={rain} />

        <div className="inicioInner">
          <div className="inicioInfo">
            <span className="inicioEyebrow">Escuela NaniPadel · {today}</span>

            <h1 id="home-title" className={`inicioVerdict ${verdictClass}`}>
              <span className="inicioVerdictDot" aria-hidden="true" />
              {headline}
            </h1>

            <p className="inicioReason" aria-live="polite">
              {weatherError
                ? "Puedes reservar igualmente y comprobarlo más tarde."
                : weather
                  ? `${weather.playability.reason}. ${weather.description}, ${Math.round(weather.temperature)}°C.`
                  : "Un momento, estamos mirando cómo está la pista."}
            </p>

            {weatherError && (
              <button type="button" className="inicioRetry" onClick={loadWeather}>
                Reintentar
              </button>
            )}

            {weather && (
              <dl className="inicioStats">
                <div>
                  <dt>Lluvia</dt>
                  <dd>{weather.precipitationProbability}%</dd>
                </div>
                <div>
                  <dt>Viento</dt>
                  <dd>{Math.round(weather.windSpeed)} km/h</dd>
                </div>
                <div>
                  <dt>Humedad</dt>
                  <dd>{weather.humidity}%</dd>
                </div>
              </dl>
            )}

            <nav className="inicioActions" aria-label="Acciones principales">
              {ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`inicioAction${action.primary ? " isPrimary" : ""}`}
                >
                  {action.label}
                </Link>
              ))}
            </nav>

            {weather && weather.hourly.length > 0 && (
              <div className="inicioHours">
                <div className="inicioHoursHead">
                  <span>Próximas horas</span>
                  <button type="button" onClick={() => setShowWeatherModal(true)}>
                    Previsión 7 días
                  </button>
                </div>
                <ol className="inicioHoursList">
                  {weather.hourly.slice(0, 8).map((hour, index) => (
                    <li
                      key={hour.time}
                      className={hour.playable ? "isPlayable" : "isBlocked"}
                    >
                      <span>{index === 0 ? "Ahora" : formatHour(hour.time)}</span>
                      <i aria-hidden="true" />
                      <strong>{Math.round(hour.temperature)}°</strong>
                      <small>{hour.playable ? "Se juega" : "No"}</small>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="inicioPreview">
              <span id="inicio-preview-label">Ver la pista de</span>
              <div className="inicioTabs" role="group" aria-labelledby="inicio-preview-label" style={{ "--i": sceneIndex }}>
                {SCENES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === sceneId}
                    onClick={() => setSceneId(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="inicioWeather" aria-label="Condiciones de la pista">
            {weather && (
              <div className="inicioWeatherNow">
                <strong>{Math.round(weather.temperature)}°</strong>
                <span>{previewing ? `Vista previa: ${scene.label.toLowerCase()}` : weather.description}</span>
              </div>
            )}
          </aside>

        </div>
      </section>

      {showWeatherModal && weather && (
        <Hoja titulo="El tiempo en la pista" tamano="ancha" className="hojaTiempo" onCerrar={() => setShowWeatherModal(false)}>
          <div className="weatherCurrentBig">
            <div className="weatherCurrentIcon">{weather.emoji}</div>
            <div className="weatherCurrentInfo">
              <p className="weatherCurrentTemp">{Math.round(weather.temperature)}°C</p>
              <p className="weatherCurrentDesc">{weather.description}</p>
              <p className="weatherCurrentFeel">
                Sensación térmica: {Math.round(weather.apparentTemperature)}°C
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
              <span className="wdLabel">Índice UV</span>
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
            Actualizado a las {new Date(weather.updatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <Link className="weatherModalPageLink" to="/estado-pista">
            Ver todos los detalles del tiempo
          </Link>
        </Hoja>
      )}

      {loggedIn && !isStaff && (
        <section className="inicioTuyo" aria-label="Tus próximas citas">
          {nextClass && (
            <div className="inicioProximaClase">
              <h2>Tu próxima clase</h2>
              <p>
                <strong>{fechaRelativa(nextClass.fecha)}{nextClass.hora ? `, a las ${nextClass.hora}` : ""}</strong>
                <span>{nextClass.nombre}{nextClass.pista ? ` · ${nextClass.pista}` : ""}</span>
              </p>
              <Link className="newsMoreBtn" to="/clases">Ver mis clases</Link>
            </div>
          )}
          <MisReservas enlaceReservar />
        </section>
      )}

      {!loggedIn && (
        <section className="inicioNuevo" aria-labelledby="inicio-nuevo-title">
          <div>
            <h2 id="inicio-nuevo-title">¿Eres nuevo en la escuela?</h2>
            <p>Clases de pádel para niños y adultos, de iniciación a competición. Pregúntanos sin compromiso y te buscamos grupo.</p>
            <Link className="inicioNuevoLink" to="/clases">Ver las clases y apuntarme</Link>
          </div>
          <ContactoClub mensaje="Hola, quiero información para apuntarme a clases de pádel" />
        </section>
      )}

      {loggedIn && (
        <section className="homeAlerts">
          <div className="sectionHeader sectionHeaderInline">
            <div>
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

      <section className="inicioNews" aria-labelledby="inicio-news-title">
        <div className="sectionHeader sectionHeaderInline">
          <div>
            <h2 id="inicio-news-title">Fotos del club</h2>
          </div>
          <Link className="newsMoreBtn" to="/galeria">
            Ver todas las fotos
          </Link>
        </div>

        <div className="inicioNewsGrid">
          {PHOTO_ITEMS.map((item) => (
            <Link className="inicioNewsCard" to="/galeria" key={item.id}>
              <img src={item.image} alt="" loading="lazy" />
              <div>
                <span>{item.category}</span>
                <h3>{item.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;
