import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getUser, isLogged, logout as doLogout } from "../services/auth";
import NotificationBell from "./NotificationBell";
import "./header.css";

function Header() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const logged = isLogged();
  const user = getUser();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    doLogout();
    setMobileOpen(false);
    navigate("/");
  };

  const closeMobileMenu = () => setMobileOpen(false);
  const navClass = ({ isActive }) => (isActive ? "active" : "");
  const inicial = user?.nombre?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <div className={`headerWrap${scrolled ? " scrolled" : ""}`}>
      <div className="container header">
        <NavLink to="/" className="brand" aria-label="Ir al inicio">
          <div className="badge">
            <img src={`${process.env.PUBLIC_URL}/fotosLogo/iconoweb.jpeg`} alt="" />
          </div>
          <div className="brandText">
            <strong>NaniPadel</strong>
            <span>Reservas, clases y torneos</span>
          </div>
        </NavLink>

        <button
          type="button"
          className={`mobileMenuBtn${mobileOpen ? " isOpen" : ""}`}
          aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`headerRight${mobileOpen ? " isOpen" : ""}`}>
          <nav className="nav" aria-label="Navegacion principal">
            <NavLink to="/" end className={navClass} onClick={closeMobileMenu}>
              Inicio
            </NavLink>
            <NavLink to="/reservas" className={navClass} onClick={closeMobileMenu}>
              Reservas
            </NavLink>
            <NavLink to="/clases" className={navClass} onClick={closeMobileMenu}>
              Clases
            </NavLink>
            <NavLink to="/torneos" className={navClass} onClick={closeMobileMenu}>
              Torneos
            </NavLink>
            <NavLink to="/tienda" className={navClass} onClick={closeMobileMenu}>
              Tienda
            </NavLink>
            <NavLink to="/estado-pista" className={navClass} onClick={closeMobileMenu}>
              Estado pista
            </NavLink>
            <NavLink to="/galeria" className={navClass} onClick={closeMobileMenu}>
              Galeria
            </NavLink>
            {logged && (user?.rol === "profesor" || user?.rol === "profe" || user?.rol === "admin") && (
              <NavLink to="/panel" className={navClass} onClick={closeMobileMenu}>
                Panel
              </NavLink>
            )}
          </nav>

          <div className="headerActions">
            {!logged ? (
              <NavLink to="/login" className="loginBtn" onClick={closeMobileMenu}>
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
                <NotificationBell />
                <NavLink to="/perfil" className="navUserInfo" aria-label="Ver mi perfil" onClick={closeMobileMenu}>
                  <div className="navAvatar">{inicial}</div>
                  <span className="navUser">{user?.nombre}</span>
                </NavLink>
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
