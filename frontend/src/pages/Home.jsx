// Importamos Link para navegación interna y el CSS
import { Link } from "react-router-dom";
import "./home.css";

// Página principal del proyecto (Home)
function Home() {
  return (
    <section className="hero">
      <div className="card heroGrid">
        {/* Columna izquierda: mensaje principal */}
        <div className="heroLeft">
          <h2>
            Tu escuela de pádel, organizada.
            <br />
            Simple, rápida y bonita.
          </h2>

          <p>
            Reserva pista, consulta clases y apúntate a torneos desde un solo sitio.
            Hecho para alumnos, profes y gestión del club.
          </p>

          {/* Botones de llamada a la acción */}
          <div className="ctaRow">
            <Link className="btn btn-primary" to="/reservas">
              Reservar pista
            </Link>
            <Link className="btn btn-ghost" to="/clases">
              Ver clases
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
              <strong>Roles</strong>
              <span>Alumno / Profesor / Admin</span>
            </div>
            <div className="kpiItem">
              <strong>Todo en uno</strong>
              <span>Clases, torneos y mensajes</span>
            </div>
          </div>

          {/* Bloque futuro para mostrar el clima */}
          <div className="weatherBox">
            <h4>Tiempo en la pista</h4>
            <p>🌤️ 23ºC - Soleado</p> {/* Sustituiremos con datos reales después */}
          </div>
        </div>
      </div>

      {/* NUEVA sección: Ventajas del sistema */}
      <section className="features">
        <h3>¿Por qué usar nuestra plataforma?</h3>
        <div className="featuresGrid">
          <div className="featureCard">
            <strong>Gestión fácil</strong>
            <p>Organiza todo desde tu móvil o PC.</p>
          </div>
          <div className="featureCard">
            <strong>Para todos</strong>
            <p>Diseñado para alumnos, profes y gestores.</p>
          </div>
          <div className="featureCard">
            <strong>100% personalizada</strong>
            <p>Adaptada a la escuela Norba Pádel.</p>
          </div>
        </div>
      </section>
    </section>
  );
}

export default Home;
