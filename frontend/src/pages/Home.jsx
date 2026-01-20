// Importamos Link para navegación interna, el CSS y hooks
import { Link } from "react-router-dom";
import "./home.css";
import { useEffect, useState } from "react"; 
import { getWeatherForClub } from "../services/weatherService";

// URL base del backend (vacía en local, IP/dominio en producción)
const API_BASE = process.env.REACT_APP_API_URL || "";


// Página principal del proyecto (Home)
function Home() {
  // Estado con los datos del tiempo
  const [weather, setWeather] = useState(null);

  // Estados auxiliares para UX
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");



// Coordenadas fijas del club
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


  return (
    <section className="home">
      {/* HERO */}
      <section className="hero">
        <div className="card heroGrid">
          {/* Columna izquierda: mensaje principal */}
          <div className="heroLeft">
            <div className="pill">
              <span className="dot" aria-hidden="true" />
              Escuela Norba Pádel | Gestión y reservas
            </div>

            <h2>
              Tu escuela de pádel, mas fácil que nunca.
            </h2>

            <p>
              La mejor escuela de pádel en <strong>Cáceres</strong>, con gestión online de
              reservas, clases y torneos. ¡Únete y mejora tu juego hoy!
            </p>

            {/* Botones de llamada a la acción */}
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
            </div>
          </div>

          {/* Columna derecha: indicadores clave (KPI) */}
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

            {/* Caja del tiempo */}
            <div className="weatherBox">
              <div className="weatherTop">
                <h4>Tiempo en la pista</h4>
                <span className="weatherBadge">Club descubierto</span>
              </div>

              {weatherLoading && (
                <p className="weatherHint">Cargando tiempo...</p>
              )}

              {!weatherLoading && weatherError && (
                <p className="weatherHint">❌ {weatherError}</p>
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

                  <div className="weatherChips">
                    <span className="chip">Viento: {weather.windSpeed} km/h</span>
                    <span className="chip">
                      Lluvia: {weather.precipitationProbability}%
                    </span>

                    <span
                      className={`chip ${
                        weather.pista === "RIESGO" ? "chipRisk" : "chipOk"
                      }`}
                    >
                      Pista: {weather.pista}
                    </span>
                  </div>

                  <p className="weatherHint">
                    Actualizado en:{" "}
                    {new Date(weather.updatedAt).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Ventajas */}
      <section className="features">
        <div className="featuresHead">
          <h3>¿Por qué usar nuestra plataforma?</h3>
          <p>
            La manera mas rapida de jugar al pádel en Norba Pádel, sin complicaciones.
            <br />
            Busca tu hora, avisa a tus amigos, reserva y disfruta.
          </p>
        </div>

        <div className="featuresGrid">
          <div className="featureCard">
            <strong>Gestión fácil</strong>
            <p>Te buscamos hueco a tu nivel y horarios.</p>
          </div>

          <div className="featureCard">
            <strong>Para todos</strong>
            <p>Clases para niños, adultos y profesionales. <br /> Todos los niveles.

            </p>
          </div>

          <div className="featureCard">
            <strong>Automatización</strong>
            <p>Recordatorios, avisos y control rápido de tus clases y torneos.</p>
          </div>

          <div className="featureCard">
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
              <span className="qiTitle">Reservar pista</span>
              <span className="qiDesc">Elige pista y horario</span>
            </Link>

            <Link className="quickItem" to="/clases">
              <span className="qiTitle">Clases por niveles</span>
              <span className="qiDesc">Iniciación, medio, avanzado</span>
            </Link>

            <Link className="quickItem" to="/torneos">
              <span className="qiTitle">Torneos</span>
              <span className="qiDesc">Menores y adultos</span>
            </Link>

            <Link className="quickItem" to="/galeria">
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
