import { buildClubPhoneUrl, buildClubWhatsappUrl, clubPhoneLabel } from "../services/whatsappLinks";
import "./contactoClub.css";

export function IconoWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6Z" />
    </svg>
  );
}

export function IconoTelefono() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h3.5l1.6 4-2.1 1.4a11 11 0 0 0 6.6 6.6l1.4-2.1 4 1.6V19a2 2 0 0 1-2.2 2A17 17 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />
    </svg>
  );
}

// Dos botones grandes: escribir por WhatsApp y llamar al club.
export default function ContactoClub({ mensaje = "Hola, tengo una consulta sobre NaniPadel", compacto = false, className = "" }) {
  return (
    <div className={`contactoClub${compacto ? " isCompacto" : ""} ${className}`.trim()}>
      <a className="contactoBtn isWhatsapp" href={buildClubWhatsappUrl(mensaje)} target="_blank" rel="noopener noreferrer">
        <IconoWhatsapp />
        <span>Escribir por WhatsApp</span>
      </a>
      <a className="contactoBtn isLlamar" href={buildClubPhoneUrl()}>
        <IconoTelefono />
        <span>
          Llamar al club
          {!compacto && <small>{clubPhoneLabel()}</small>}
        </span>
      </a>
    </div>
  );
}
