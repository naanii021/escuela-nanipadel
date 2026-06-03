import "./footer.css";
import { buildClubWhatsappUrl } from "../services/whatsappLinks";

// Pie de página de la aplicación
function Footer() {
  return (
    <footer className="footer">
      <div className="container footerInner">
        <span>© 2026 NaniPadel</span>
        <span className="muted">Proyecto académico · DAM</span>
        <a href={buildClubWhatsappUrl("Hola, quiero información sobre NaniPadel")} target="_blank" rel="noopener noreferrer">
          Hablar por WhatsApp
        </a>
      </div>
    </footer>
  );
}

export default Footer;
