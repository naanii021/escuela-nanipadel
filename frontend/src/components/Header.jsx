import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { getUser, isLogged, logout as doLogout } from "../services/auth";
import "./header.css";

function Header() {
  const navigate = useNavigate();
  const location = useLocation(); // Esto hace que se re-renderice al navegar

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

          {/* Zona de acceso */}
          {!logged ? (
            <NavLink to="/login" className="navBtn">
              Entrar
            </NavLink>
          ) : (
            <>
              {(user?.rol === "profesor" || user?.rol === "admin") && (
                <NavLink to="/panel" className={({ isActive }) => (isActive ? "active" : "")}>
                  Panel
                </NavLink>
              )}

              <span className="navUser">{user?.nombre}</span>

              <button className="navBtn navBtnDanger" onClick={handleLogout}>
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