// Página de torneos
import "./torneos.css";

function Torneos() {
  return (
    <section className="torneos">
      {/* Título principal */}
      <h2>Torneos</h2>
      <p className="intro">
        Apúntate a nuestros torneos según tu edad y nivel.
      </p>

      {/* Listado de torneos */}
      <div className="listaTorneos">

        {/* Torneo adultos */}
        <div className="torneoCard">
          <img
            src="https://images.unsplash.com/photo-1603112579965-7a0c1e3b7a4f"
            alt="Torneo adultos"
          />

          <div className="torneoInfo">
            <h3>Torneo Adultos</h3>
            <p><strong>Modalidad:</strong> Masculino / Femenino / Mixto</p>
            <p><strong>Fecha:</strong> 15 de Junio</p>
            <p><strong>Nivel:</strong> Medio - Avanzado</p>

            <button className="btnApuntarse">
              Apuntarse
            </button>
          </div>
        </div>

        {/* Torneo menores */}
        <div className="torneoCard">
          <img
            src="https://images.unsplash.com/photo-1599058917212-d750089bc07e"
            alt="Torneo menores"
          />

          <div className="torneoInfo">
            <h3>Torneo Menores</h3>
            <p><strong>Edad:</strong> 8 a 14 años</p>
            <p><strong>Fecha:</strong> 22 de Junio</p>
            <p><strong>Nivel:</strong> Iniciación - Medio</p>

            <button className="btnApuntarse">
              Apuntarse
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}

export default Torneos;
