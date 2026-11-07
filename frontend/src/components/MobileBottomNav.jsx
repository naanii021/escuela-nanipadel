import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getUser, isLogged, loginHref } from "../services/auth";
import ContactoClub from "./ContactoClub";
import Hoja from "./Hoja";
import "./mobileBottomNav.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];

// Iconos de trazo, 24 px, todos con el mismo grosor.
const ICONS = {
  inicio: <path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" />,
  reservar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8.5 14.5l2.2 2.2 4.6-4.6" />
    </>
  ),
  clases: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
    </>
  ),
  avisos: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 15 18 9Z" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.6 18.2c1.2-2 3.1-3.2 5.4-3.2s4.2 1.2 5.4 3.2" />
    </>
  ),
  panel: (
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </>
  ),
  lista: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5h6v2.5H9zM8.5 11l1.5 1.5 3-3M8.5 16.5h7" />
    </>
  ),
  whatsapp: <path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6Z" />,
  contacto: <path d="M5 4h3.5l1.6 4-2.1 1.4a11 11 0 0 0 6.6 6.6l1.4-2.1 4 1.6V19a2 2 0 0 1-2.2 2A17 17 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />,
  entrar: <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 8l4 4-4 4M14 12H4" />,
};

function Icon({ name }) {
  return (
    <svg className="mobileNavIcon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function isActive(pathname, to, exact = false) {
  const path = to.split("?")[0];
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function MobileBottomNav() {
  const location = useLocation();
  const [contactOpen, setContactOpen] = useState(false);
  const logged = isLogged();
  const user = getUser();
  const role = String(user?.rol || "").toLowerCase();
  const isStaff = logged && STAFF_ROLES.includes(role);

  let items;
  if (isStaff) {
    // Staff: la tarea principal (pasar lista) a un toque. La bandeja de WhatsApp está dentro del panel.
    items = [
      { to: "/", label: "Inicio", icon: "inicio", exact: true },
      { to: "/panel?seccion=control", label: "Pasar lista", icon: "lista", activeWhen: () => location.pathname === "/panel" && /seccion=control/.test(location.search) },
      { to: "/panel", label: "Panel", icon: "panel", activeWhen: () => location.pathname === "/panel" && !/seccion=control/.test(location.search) },
      { to: "/avisos", label: "Avisos", icon: "avisos" },
      { to: "/perfil", label: "Perfil", icon: "perfil" },
    ];
  } else if (logged) {
    items = [
      { to: "/", label: "Inicio", icon: "inicio", exact: true },
      { to: "/reservas", label: "Reservar", icon: "reservar" },
      { to: "/clases", label: "Clases", icon: "clases" },
      { to: "/avisos", label: "Avisos", icon: "avisos" },
      { to: "/perfil", label: "Perfil", icon: "perfil" },
    ];
  } else {
    items = [
      { to: "/", label: "Inicio", icon: "inicio", exact: true },
      { to: "/reservas", label: "Reservar", icon: "reservar" },
      { to: "/clases", label: "Clases", icon: "clases" },
      { action: "contacto", label: "Contacto", icon: "contacto" },
      { to: loginHref(location.pathname), match: "/login", label: "Entrar", icon: "entrar" },
    ];
  }

  return (
    <>
      <nav className="mobileBottomNav" aria-label="Navegación inferior">
        {items.map((item) => {
          if (item.action === "contacto") {
            return (
              <button key="contacto" type="button" className={`mobileNavItem${contactOpen ? " isActive" : ""}`} onClick={() => setContactOpen(true)}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          }
          const active = item.activeWhen ? item.activeWhen() : isActive(location.pathname, item.match || item.to, item.exact);
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={() => `mobileNavItem${active ? " isActive" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {contactOpen && (
        <Hoja titulo="Hablar con el club" subtitulo="Te respondemos por WhatsApp o por teléfono." onCerrar={() => setContactOpen(false)}>
          <ContactoClub />
        </Hoja>
      )}
    </>
  );
}

export default MobileBottomNav;
