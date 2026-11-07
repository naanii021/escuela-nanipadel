import { Link } from "react-router-dom";
import CLUB from "../config/club";
import ContactoClub from "./ContactoClub";
import { buildClubWhatsappUrl } from "../services/whatsappLinks";
import "./footer.css";

const ENLACES_ESCUELA = [
  { label: "Clases", to: "/clases" },
  { label: "Horarios y reservar pista", to: "/reservas" },
  { label: "Torneos", to: "/torneos" },
  { label: "Fotos", to: "/galeria" },
];

const ENLACES_LEGALES = [
  { label: "Aviso legal", to: "/aviso-legal" },
  { label: "Privacidad", to: "/privacidad" },
  { label: "Cookies", to: "/cookies" },
];

const HUECOS_PATROCINIO = 4;
const MENSAJE_PATROCINIO = "Hola, me interesa patrocinar la Escuela NaniPadel. ¿Me contáis qué opciones hay?";

const ICONOS_REDES = {
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r=".6" fill="currentColor" />
    </>
  ),
  facebook: <path d="M14.5 8.5H16V5h-2a4 4 0 0 0-4 4v2.5H8V15h2v6h3.5v-6H16l.5-3.5h-3V9.5a1 1 0 0 1 1-1Z" />,
  tiktok: <path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5M14 3.5a4.5 4.5 0 0 0 4.5 4.5" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.2 9.3 4.6 2.7-4.6 2.7Z" fill="currentColor" />
    </>
  ),
};

const NOMBRES_REDES = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube" };

function esEnlace(valor) {
  return /^https?:\/\//i.test(String(valor || "").trim());
}

function rutaPublica(ruta) {
  if (esEnlace(ruta)) return ruta;
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}${String(ruta).startsWith("/") ? ruta : `/${ruta}`}`;
}

function IconoRed({ red }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS_REDES[red]}
    </svg>
  );
}

function Dato({ etiqueta, valor, enlace }) {
  const texto = String(valor || "").trim();
  return (
    <div className="footerDato">
      <dt>{etiqueta}</dt>
      <dd className={texto ? "" : "isPendiente"}>
        {!texto ? "Próximamente" : enlace ? (
          <a href={enlace} target={enlace.startsWith("http") ? "_blank" : undefined} rel={enlace.startsWith("http") ? "noopener noreferrer" : undefined}>
            {texto}
          </a>
        ) : (
          texto
        )}
      </dd>
    </div>
  );
}

// Pie de página: la escuela, contacto, redes, patrocinadores y textos legales.
// Los datos que faltan se rellenan en src/config/club.js.
function Footer() {
  const redes = Object.entries(CLUB.redes || {}).filter(([red, url]) => ICONOS_REDES[red] && esEnlace(url));
  const patrocinadores = (CLUB.patrocinadores || []).filter((p) => p && String(p.nombre || "").trim());
  const huecos = Math.max(0, HUECOS_PATROCINIO - patrocinadores.length);
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footerInner">
        <div className="footerColumnas">
          <nav className="footerColumna" aria-labelledby="footer-escuela">
            <h2 id="footer-escuela">La escuela</h2>
            <ul className="footerLista">
              {ENLACES_ESCUELA.map((enlace) => (
                <li key={enlace.to}>
                  <Link to={enlace.to}>{enlace.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="footerColumna footerContacto" aria-labelledby="footer-contacto">
            <h2 id="footer-contacto">Contacto</h2>
            <ContactoClub mensaje="Hola, quiero información sobre NaniPadel" />
            <dl className="footerDatos">
              <Dato etiqueta="Dirección" valor={CLUB.direccion} enlace={esEnlace(CLUB.mapa) ? CLUB.mapa : ""} />
              <Dato etiqueta="Horario de atención" valor={CLUB.horario} />
              {String(CLUB.email || "").trim() && <Dato etiqueta="Correo" valor={CLUB.email} enlace={`mailto:${CLUB.email.trim()}`} />}
            </dl>
          </section>

          <section className="footerColumna" aria-labelledby="footer-redes">
            <h2 id="footer-redes">Síguenos</h2>
            {redes.length ? (
              <ul className="footerLista footerRedes">
                {redes.map(([red, url]) => (
                  <li key={red}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <IconoRed red={red} />
                      {NOMBRES_REDES[red]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="footerPendiente">Muy pronto en Instagram y Facebook. Mientras, escríbenos por WhatsApp.</p>
            )}
          </section>
        </div>

        <section className="footerPatrocinio" aria-labelledby="footer-patrocinio">
          <h2 id="footer-patrocinio">Patrocinadores</h2>
          <ul className="footerPatrocinadores">
            {patrocinadores.map((p) => {
              const contenido = p.logo ? <img src={rutaPublica(p.logo)} alt={p.nombre} loading="lazy" /> : <strong>{p.nombre}</strong>;
              return (
                <li key={p.nombre}>
                  {esEnlace(p.url) ? (
                    <a className="footerPatrocinador" href={p.url} target="_blank" rel="noopener noreferrer sponsored">
                      {contenido}
                    </a>
                  ) : (
                    <span className="footerPatrocinador">{contenido}</span>
                  )}
                </li>
              );
            })}
            {Array.from({ length: huecos }, (_, index) => (
              <li key={`hueco-${index}`}>
                <a className="footerPatrocinador isHueco" href={buildClubWhatsappUrl(MENSAJE_PATROCINIO)} target="_blank" rel="noopener noreferrer">
                  <strong>Tu marca aquí</strong>
                  <span>Hazte patrocinador</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="footerBase">
          <p className="footerLegal">© {year} {CLUB.nombre} · Proyecto académico de DAM</p>
          <nav aria-label="Textos legales">
            <ul className="footerLegales">
              {ENLACES_LEGALES.map((enlace) => (
                <li key={enlace.to}>
                  <Link to={enlace.to}>{enlace.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
