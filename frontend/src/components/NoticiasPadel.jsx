import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../services/api";
import { haceCuanto } from "../services/fechas";
import "./noticiasPadel.css";

const REFRESCO_MS = 5 * 60 * 1000;
const MAX_TITULARES = 6;

function IconoFuera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

// Titulares de pádel de la prensa deportiva. Cada uno abre la noticia en la web del medio.
// Se refrescan solos mientras la página está abierta; si no hay titulares, la sección no sale.
export default function NoticiasPadel() {
  const [noticias, setNoticias] = useState([]);
  const [ahora, setAhora] = useState(() => new Date());

  const cargar = useCallback(() => {
    apiGet("/api/noticias/padel")
      .then((data) => {
        if (Array.isArray(data?.noticias)) setNoticias(data.noticias.slice(0, MAX_TITULARES));
        setAhora(new Date());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    let ultima = Date.now();
    const refrescar = () => {
      if (document.visibilityState !== "visible") return;
      ultima = Date.now();
      cargar();
    };
    const id = window.setInterval(refrescar, REFRESCO_MS);
    // Al volver a la pestaña tras un rato, se ponen al día sin esperar al siguiente turno.
    const alVolver = () => {
      if (document.visibilityState === "visible" && Date.now() - ultima > REFRESCO_MS) refrescar();
    };
    // "hace 5 min" avanza aunque no lleguen titulares nuevos.
    const reloj = window.setInterval(() => setAhora(new Date()), 60 * 1000);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(id);
      window.clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  if (!noticias.length) return null;

  const fuentes = [...new Set(noticias.map((noticia) => noticia.fuente))].join(" y ");

  return (
    <section className="noticiasPadel" aria-labelledby="noticias-padel-title">
      <div className="sectionHeader">
        <h2 id="noticias-padel-title">Noticias del pádel</h2>
        <p>Lo último de {fuentes}. Al tocar un titular se abre la noticia en su web.</p>
      </div>
      <ul className="noticiasPadelLista">
        {noticias.map((noticia) => {
          const cuando = noticia.fecha ? haceCuanto(noticia.fecha, ahora) : "";
          return (
            <li key={noticia.enlace}>
              <a href={noticia.enlace} target="_blank" rel="noopener noreferrer">
                <span className="noticiasPadelTexto">
                  <strong>{noticia.titulo}</strong>
                  <small>
                    {noticia.fuente}
                    {cuando && (
                      <>
                        {" · "}
                        <time dateTime={noticia.fecha}>{cuando}</time>
                      </>
                    )}
                  </small>
                </span>
                <IconoFuera />
                <span className="visuallyHidden"> (se abre en otra pestaña)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
