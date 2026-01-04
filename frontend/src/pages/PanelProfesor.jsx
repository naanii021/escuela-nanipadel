import React from "react";
import { Link } from "react-router-dom";
import "./panelProfesor.css";

function PanelProfesor() {
  return (
    <section className="panel-container">
      <h2>Panel del Profesor</h2>

      <div className="panel-grid">
        <Link to="/panel/mis-clases" className="panel-card">
          <h3>📚 Mis clases</h3>
          <p>Consulta y gestiona tus clases asignadas</p>
        </Link>

        <Link to="/panel/torneos" className="panel-card">
          <h3>🎾 Torneos</h3>
          <p>Crea y gestiona torneos del club</p>
        </Link>

        <Link to="/panel/alumnos" className="panel-card">
          <h3>👥 Alumnos</h3>
          <p>Consulta tus alumnos y su nivel</p>
        </Link>
      </div>
    </section>
  );
}

export default PanelProfesor;
