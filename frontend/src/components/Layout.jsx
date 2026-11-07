import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import ClubAssistant from "./ClubAssistant";
import MobileBottomNav from "./MobileBottomNav";
import "./layout.css";

// Al cambiar de página se vuelve arriba (salvo enlaces a un #ancla), para ver el título de la nueva página.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

// Layout general que envuelve las páginas
function Layout({ children }) {
  return (
    <div className="appShell">
      <ScrollToTop />
      <Header />

      {/* Contenido principal */}
      <main className="main" id="contenido">
        <div className="container">{children}</div>
      </main>

      <Footer />
      <ClubAssistant />
      <MobileBottomNav />
    </div>
  );
}

export default Layout;
