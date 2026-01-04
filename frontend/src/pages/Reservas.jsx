// Página de reservas de pista
import "./reservas.css";

function Reservas() {
  return (
    <section className="reservas">
      {/* Título principal */}
      <h2>Reserva tu pista</h2>
      <p className="intro">
        Elige la hora y pista para jugar. Muy pronto podrás hacerlo online.
      </p>

      {/* Cuadrícula simulada de pistas y horarios */}
      <div className="gridReservas">
        {/* Repetimos esto por pista y hora (futuro dinámico) */}
        <div className="reservaCard disponible">
          <strong>Pista 1</strong>
          <span>18:00 - 19:00</span>
          <button>Reservar</button>
        </div>
        <div className="reservaCard ocupada">
          <strong>Pista 2</strong>
          <span>18:00 - 19:00</span>
          <button disabled>Ocupada</button>
        </div>
        <div className="reservaCard disponible">
          <strong>Pista 1</strong>
          <span>19:00 - 20:00</span>
          <button>Reservar</button>
        </div>
        <div className="reservaCard disponible">
          <strong>Pista 2</strong>
          <span>19:00 - 20:00</span>
          <button>Reservar</button>
        </div>
      </div>
    </section>
  );
}

export default Reservas;
