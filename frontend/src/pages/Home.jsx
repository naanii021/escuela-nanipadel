import { Link } from "react-router-dom";
import "./home.css";
import { useEffect, useState } from "react";
import { getWeatherForClub } from "../services/weatherService";

function Home() {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  const CLUB_LAT = 39.483017;
  const CLUB_LON = -6.364445;

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

  const formatDay = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === tomorrow.toDateString()) return "Mañana";
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" });
  };

  return (
    <section className="home">
      {/* HERO */}
      <section className="hero">
        <div className="heroCard heroGrid">
          <div className="heroLeft">
            <div className="pill">
              <span className="dot" aria-hidden="true" />
              Escuela Norba Pádel | Gestión y reservas
            </div>

            <h2>Tu escuela de pádel,<br />más fácil que nunca.</h2>

            <p>
              La mejor escuela de pádel en <strong>Cáceres</strong>, con gestión online de
              reservas, clases y torneos. ¡Únete y mejora tu juego hoy!
            </p>

            <div className="ctaRow">
              <Link className="btn btn-primary" to="/reservas">Reservar pista</Link>
              <Link className="btn btn-ghost" to="/clases">Ver clases</Link>
              <Link className="btn btn-ghost" to="/torneos">Ver torneos</Link>
            </div>
          </div>

          <div className="heroRight">
            <div className="kpi">
              <div className="kpiItem">
                <strong>Reservas en 30s</strong>
                <span>Flujo rápido y sin líos</span>
              </div>
              <div className="kpiItem">
                <strong>Clases</strong>
                <span>Todos los niveles y horarios</span>
              </div>
              <div className="kpiItem">
                <strong>Todo en uno</strong>
                <span>Clases, torneos y mucho pádel</span>
              </div>
            </div>

            {/* Panel del tiempo */}
            <div
              className="weatherBox weatherBoxClickable"
              onClick={() => weather && setShowWeatherModal(true)}
              role="button"
              tabIndex={0}
            >
              <div className="weatherTop">
                <h4>Tiempo en la pista</h4>
                <span className="weatherBadge">Ver más</span>
              </div>

              {weatherLoading && <p className="weatherHint">Cargando tiempo...</p>}

              {!weatherLoading && weatherError && (
                <p className="weatherHint">❌ {weatherError}</p>
              )}

              {!weatherLoading && !weatherError && weather && (
                <>
                  <div className="weatherMain">
                    <div className="weatherIcon" aria-hidden="true">{weather.emoji}</div>
                    <div>
                      <p className="weatherTemp">{weather.temperature}ºC</p>
                      <p className="weatherDesc">{weather.description}</p>
                    </div>
                  </div>

                  <div className="weatherChips">
                    <span className="chip">Viento: {weather.windSpeed} km/h</span>
                    <span className="chip">Lluvia: {weather.precipitationProbability}%</span>
                    <span className={`chip ${weather.pista === "RIESGO" ? "chipRisk" : "chipOk"}`}>
                      Pista: {weather.pista}
                    </span>
                  </div>

                  <p className="weatherHint">
                    Pulsa para ver previsión semanal y recomendaciones
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modal del tiempo */}
      {showWeatherModal && weather && (
        <div className="weatherModalBackdrop" onClick={() => setShowWeatherModal(false)}>
          <div className="weatherModal" onClick={(e) => e.stopPropagation()}>
            <div className="weatherModalHead">
              <h3>Tiempo en Norba Pádel</h3>
              <button className="weatherCloseBtn" onClick={() => setShowWeatherModal(false)}>✕</button>
            </div>

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
                <span className="wdLabel">💧 Humedad</span>
                <span className="wdValue">{weather.humidity}%</span>
              </div>
              <div className="weatherDetailItem">
                <span className="wdLabel">💨 Viento</span>
                <span className="wdValue">{weather.windSpeed} km/h</span>
              </div>
              <div className="weatherDetailItem">
                <span className="wdLabel">🌧️ Lluvia</span>
                <span className="wdValue">{weather.precipitationProbability}%</span>
              </div>
              <div className="weatherDetailItem">
                <span className="wdLabel">☀️ Índice UV</span>
                <span className="wdValue">{weather.uvIndex ?? "—"}</span>
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
                <h4>Previsión de los próximos 7 días</h4>
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
                      <span className="fDayRain">💧 {day.precipitationProbability}%</span>
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

      {/* Ventajas */}
      <section className="features">
        <div className="featuresHead">
          <h3>¿Por qué usar nuestra plataforma?</h3>
          <p>
            La manera más rápida de jugar al pádel en Norba Pádel, sin complicaciones.
            <br />
            Busca tu hora, avisa a tus amigos, reserva y disfruta.
          </p>
        </div>

        <div className="featuresGrid">
          <div className="featureCard">
            <span className="featureIcon">📅</span>
            <strong>Gestión fácil</strong>
            <p>Te buscamos hueco a tu nivel y horarios.</p>
          </div>
          <div className="featureCard">
            <span className="featureIcon">👥</span>
            <strong>Para todos</strong>
            <p>Clases para niños, adultos y profesionales. Todos los niveles.</p>
          </div>
          <div className="featureCard">
            <span className="featureIcon">⚡</span>
            <strong>Automatización</strong>
            <p>Recordatorios, avisos y control rápido de tus clases y torneos.</p>
          </div>
          <div className="featureCard">
            <span className="featureIcon">🎯</span>
            <strong>100% personalizado</strong>
            <p>Clases individuales para mejorar todos los aspectos.</p>
          </div>
        </div>
      </section>

      {/* Accesos rápidos */}
      <section className="quick">
        <div className="quickCard">
          <h3>Accesos rápidos</h3>
          <p>Empieza por lo importante con un clic, no esperes más.</p>

          <div className="quickGrid">
            <Link className="quickItem" to="/reservas">
              <span className="qiIcon">🎾</span>
              <span className="qiTitle">Reservar pista</span>
              <span className="qiDesc">Elige pista y horario</span>
            </Link>
            <Link className="quickItem" to="/clases">
              <span className="qiIcon">📚</span>
              <span className="qiTitle">Clases por niveles</span>
              <span className="qiDesc">Iniciación, medio, avanzado</span>
            </Link>
            <Link className="quickItem" to="/torneos">
              <span className="qiIcon">🏆</span>
              <span className="qiTitle">Torneos</span>
              <span className="qiDesc">Menores y adultos</span>
            </Link>
            <Link className="quickItem" to="/galeria">
              <span className="qiIcon">📸</span>
              <span className="qiTitle">Galería</span>
              <span className="qiDesc">Fotos de alumnos y competiciones</span>
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}

export default Home;
