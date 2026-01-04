import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./header.css";

// Cabecera principal de la aplicación
function Header() {
  const navigate = useNavigate();

  // ✅ Simulación de sesión (por ahora)
  // Luego lo cambiaremos por: token JWT en localStorage + rol real desde backend
  const [isLogged, setIsLogged] = useState(false);
  const [role, setRole] = useState(""); // "profesor" | "admin" | ""

  // Simula un login rápido (solo para probar el flujo)
  const fakeLoginProfesor = () => {
    setIsLogged(true);
    setRole("profesor");
    navigate("/panel"); // Te lleva al panel
  };

  // Simula cerrar sesión
  const logout = () => {
    setIsLogged(false);
    setRole("");
    navigate("/"); // Te devuelve al inicio
  };

  return (
    <div className="headerWrap">
      <div className="container header">
        {/* Marca */}
        <div className="brand">
          <div className="badge" aria-hidden="true" />
          <div className="brandText">
            <h1>NaniPadel</h1>
            <p>Reservas, clases y torneos</p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="nav" aria-label="Navegación principal">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Inicio
          </NavLink>

          <NavLink to="/reservas" className={({ isActive }) => (isActive ? "active" : "")}>
            Reservas
          </NavLink>

          <NavLink to="/clases" className={({ isActive }) => (isActive ? "active" : "")}>
            Clases
          </NavLink>

          <NavLink to="/torneos" className={({ isActive }) => (isActive ? "active" : "")}>
            Torneos
          </NavLink>

          <NavLink to="/galeria" className={({ isActive }) => (isActive ? "active" : "")}>
            Galería
          </NavLink>

          {/* ✅ Zona de acceso */}
          {!isLogged ? (
            <>
              

              {/* Opción 2: botón temporal para simular login de profesor */}
              <button className="navBtn" onClick={fakeLoginProfesor}>
                Entrar (profe)
              </button>
            </>
          ) : (
            <>
              {/* ✅ Solo mostramos Panel si es profesor o admin */}
              {(role === "profesor" || role === "admin") && (
                <NavLink to="/panel" className={({ isActive }) => (isActive ? "active" : "")}>
                  Panel
                </NavLink>
              )}

              <button className="navBtn navBtnDanger" onClick={logout}>
                Salir
              </button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}

export default Header;
