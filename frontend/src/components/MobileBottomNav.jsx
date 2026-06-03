import { NavLink, useLocation } from "react-router-dom";
import { getUser, isLogged } from "../services/auth";
import "./mobileBottomNav.css";

const STAFF_ROLES = ["admin", "profesor", "profe"];

function itemClass(pathname, to, exact = false) {
  if (exact) return pathname === to ? "isActive" : "";
  return pathname === to || pathname.startsWith(`${to}/`) ? "isActive" : "";
}

function MobileBottomNav() {
  const location = useLocation();
  const logged = isLogged();
  const user = getUser();
  const role = String(user?.rol || "").toLowerCase();
  const isAdmin = role === "admin";
  const isStaff = STAFF_ROLES.includes(role);

  const items = isStaff
    ? [
        { to: "/", label: "Inicio", icon: "⌂", exact: true },
        { to: "/reservas", label: "Reservas", icon: "◫" },
        { to: "/panel", label: "Panel", icon: "▦" },
        isAdmin
          ? { to: "/panel/whatsapp", label: "WhatsApp", icon: "◌" }
          : { to: "/avisos", label: "Avisos", icon: "!" },
        { to: logged ? "/perfil" : "/login", label: "Perfil", icon: "○" },
      ]
    : [
        { to: "/", label: "Inicio", icon: "⌂", exact: true },
        { to: "/reservas", label: "Reservas", icon: "◫" },
        { to: "/clases", label: "Clases", icon: "▤" },
        { to: logged ? "/avisos" : "/login", label: "Avisos", icon: "!" },
        { to: logged ? "/perfil" : "/login", label: "Perfil", icon: "○" },
      ];

  return (
    <nav className="mobileBottomNav" aria-label="Navegación inferior móvil">
      {items.map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          className={`mobileNavItem ${itemClass(location.pathname, item.to, item.exact)}`}
        >
          <span className="mobileNavIcon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileBottomNav;
