import { NavLink, useNavigate } from "react-router-dom";
import { getUser, isLogged, logout as doLogout } from "../services/auth";
import "./header.css";

function Header() {
  const navigate = useNavigate();

  const logged = isLogged();
  const user = getUser();

  const handleLogout = () => {
    doLogout();
    navigate("/");
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
        <div className="headerRight">
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

            {logged && (user?.rol === "profesor" || user?.rol === "admin") && (
              <NavLink to="/panel" className={({ isActive }) => (isActive ? "active" : "")}>
                Panel
              </NavLink>
            )}
          </nav>

          <div className="headerActions">
            {!logged ? (
              <NavLink to="/login" className="navBtn navBtnPrimary">
                Entrar
              </NavLink>
            ) : (
              <>
                <span className="navUser">{user?.nombre}</span>

                <button className="navBtn navBtnDanger" onClick={handleLogout}>
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
