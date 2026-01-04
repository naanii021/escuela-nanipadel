// Página de clases disponibles
import "./clases.css";

function Clases() {
  return (
    <section className="clases">
      {/* Título principal */}
      <h2>Clases disponibles</h2>
      <p className="intro">
        Elige entre clases según tu nivel, horario o tipo de grupo.
      </p>

      {/* Listado de clases (simulado) */}
      <div className="listaClases">
        <div className="claseCard">
          <h3>Iniciación adultos</h3>
          <p><strong>Día:</strong> Lunes y Miércoles</p>
          <p><strong>Hora:</strong> 18:00 - 19:00</p>
          <p><strong>Profesor:</strong> Dani</p>
        </div>

        <div className="claseCard">
          <h3>Infantil medio</h3>
          <p><strong>Día:</strong> Martes y Jueves</p>
          <p><strong>Hora:</strong> 17:00 - 18:00</p>
          <p><strong>Profesor:</strong> Pau</p>
        </div>

        <div className="claseCard">
          <h3>Avanzado mixto</h3>
          <p><strong>Día:</strong> Viernes</p>
          <p><strong>Hora:</strong> 19:00 - 20:30</p>
          <p><strong>Profesor:</strong> Dani</p>
        </div>
      </div>
    </section>
  );
}

export default Clases;
