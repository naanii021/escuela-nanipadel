import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getUser, isLogged, loginHref, logout as doLogout } from "../services/auth";
import NotificationBell from "./NotificationBell";
import ContactoClub from "./ContactoClub";
import { TIENDA_VISIBLE } from "../config/club";
import "./header.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const logged = isLogged();
  const user = getUser();
  const isStaff = STAFF_ROLES.includes(String(user?.rol || "").toLowerCase());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // El menú se cierra al cambiar de página y con Escape.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("menuAbierto");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("menuAbierto");
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    doLogout();
    setMobileOpen(false);
    navigate("/");
  };

  const closeMobileMenu = () => setMobileOpen(false);
  const navClass = ({ isActive }) => (isActive ? "active" : "");
  const inicial = user?.nombre?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <div className={`headerWrap${scrolled ? " scrolled" : ""}${mobileOpen ? " menuOpen" : ""}`}>
      <div className="container header">
        <NavLink to="/" className="brand" aria-label="NaniPadel, ir al inicio">
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
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileOpen}
          aria-controls="menu-principal"
          onClick={() => setMobileOpen((value) => !value)}
        >
          <span className="mobileMenuIcon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="mobileMenuText">{mobileOpen ? "Cerrar" : "Menú"}</span>
        </button>

        {mobileOpen && <button type="button" className="menuFondo" aria-label="Cerrar menú" tabIndex={-1} onClick={closeMobileMenu} />}

        <div id="menu-principal" className={`headerRight${mobileOpen ? " isOpen" : ""}`}>
          <nav className="nav" aria-label="Navegación principal">
            <NavLink to="/" end className={navClass} onClick={closeMobileMenu}>
              Inicio
            </NavLink>
            <NavLink to="/reservas" className={navClass} onClick={closeMobileMenu}>
              Reservar pista
            </NavLink>
            <NavLink to="/clases" className={navClass} onClick={closeMobileMenu}>
              Clases
            </NavLink>
            <NavLink to="/torneos" className={navClass} onClick={closeMobileMenu}>
              Torneos
            </NavLink>
            {TIENDA_VISIBLE && (
              <NavLink to="/tienda" className={navClass} onClick={closeMobileMenu}>
                Tienda
              </NavLink>
            )}
            <NavLink to="/estado-pista" className={navClass} onClick={closeMobileMenu}>
              Tiempo y pista
            </NavLink>
            <NavLink to="/galeria" className={navClass} onClick={closeMobileMenu}>
              Fotos
            </NavLink>
            {logged && (
              <NavLink to="/avisos" className={navClass} onClick={closeMobileMenu}>
                Avisos
              </NavLink>
            )}
            {logged && isStaff && (
              <NavLink to="/panel?seccion=control" className={() => `navPasarLista${location.pathname === "/panel" && /seccion=control/.test(location.search) ? " active" : ""}`} onClick={closeMobileMenu}>
                Pasar lista
              </NavLink>
            )}
            {logged && isStaff && (
              <NavLink to="/panel" className={() => (location.pathname.startsWith("/panel") && !/seccion=control/.test(location.search) ? "active" : "")} onClick={closeMobileMenu}>
                Panel
              </NavLink>
            )}
          </nav>

          <div className="headerActions">
            {!logged ? (
              <NavLink to={loginHref(location.pathname)} className="loginBtn" onClick={closeMobileMenu}>
                <span>Entrar</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </NavLink>
            ) : (
              <>
                <NotificationBell />
                <NavLink to="/perfil" className="navUserInfo" aria-label={`Mi perfil: ${user?.nombre || ""}`} onClick={closeMobileMenu}>
                  <div className="navAvatar" aria-hidden="true">{inicial}</div>
                  <span className="navUser">{user?.nombre}</span>
                </NavLink>
                <button type="button" className="logoutBtn" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </>
            )}
          </div>

          <div className="menuContacto">
            <strong>¿Necesitas ayuda? Habla con el club</strong>
            <ContactoClub compacto />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
