import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getUser, isLogged, logout as doLogout } from "../services/auth";
import "./header.css";

function Header() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  const logged = isLogged();
  const user = getUser();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    doLogout();
    navigate("/");
  };

  const navClass = ({ isActive }) => (isActive ? "active" : "");
  const inicial = user?.nombre?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <div className={`headerWrap${scrolled ? " scrolled" : ""}`}>
      <div className="container header">

        <NavLink to="/" className="brand" aria-label="Ir al inicio">
          <div className="badge">
            <span>NP</span>
          </div>
          <div className="brandText">
            <strong>NaniPadel</strong>
            <span>Reservas, clases y torneos</span>
          </div>
        </NavLink>

        <div className="headerRight">
          <nav className="nav" aria-label="Navegación principal">
            <NavLink to="/" end className={navClass}>Inicio</NavLink>
            <NavLink to="/reservas" className={navClass}>Reservas</NavLink>
            <NavLink to="/clases" className={navClass}>Clases</NavLink>
            <NavLink to="/torneos" className={navClass}>Torneos</NavLink>
            <NavLink to="/galeria" className={navClass}>Galería</NavLink>
            {logged && (user?.rol === "profesor" || user?.rol === "admin") && (
              <NavLink to="/panel" className={navClass}>Panel</NavLink>
            )}
          </nav>

          <div className="headerActions">
            {!logged ? (
              <NavLink to="/login" className="loginBtn">
                <span className="loginBtnShimmer" aria-hidden="true" />
                <span>Entrar</span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </NavLink>
            ) : (
              <>
                <div className="navUserInfo">
                  <div className="navAvatar">{inicial}</div>
                  <span className="navUser">{user?.nombre}</span>
                </div>
                <button className="logoutBtn" onClick={handleLogout}>
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
