import ContactoClub from "./ContactoClub";
import "./footer.css";

// Pie de página: contacto directo con el club.
function Footer() {
  return (
    <footer className="footer">
      <div className="container footerInner">
        <div className="footerContacto">
          <strong>¿Tienes alguna duda? Habla con el club</strong>
          <ContactoClub mensaje="Hola, quiero información sobre NaniPadel" />
        </div>
        <p className="footerLegal">© 2026 NaniPadel · Proyecto académico de DAM</p>
      </div>
    </footer>
  );
}

export default Footer;
