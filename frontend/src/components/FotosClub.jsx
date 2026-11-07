import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./fotosClub.css";

const MAX_FOTOS = 6;
const CADA_MS = 7000;

function conPublicUrl(ruta) {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function prefiereMenosMovimiento() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function IconoPausa({ pausado }) {
  return pausado ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="5.5" width="4" height="13" rx="1" />
      <rect x="13.5" y="5.5" width="4" height="13" rx="1" />
    </svg>
  );
}

// Fotos del club: cada visita salen otras al azar de la galería. La destacada cambia con un
// fundido cada 7 s; se para al pasar el ratón, al tocarla o con el botón de pausa.
export default function FotosClub() {
  const [fotos, setFotos] = useState([]);
  const [actual, setActual] = useState(0);
  const [cargadas, setCargadas] = useState(() => new Set([0, 1]));
  const [encima, setEncima] = useState(false);
  const [pausada, setPausada] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  const [reducido] = useState(prefiereMenosMovimiento);
  const seccionRef = useRef(null);
  const tiraRef = useRef(null);
  const toqueRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    fetch(conPublicUrl("/gallery-manifest.json"), { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        const lista = Array.isArray(data?.photos) ? data.photos.filter((foto) => foto?.src) : [];
        if (!cancelado) setFotos(barajar(lista).slice(0, MAX_FOTOS));
      })
      .catch(() => {
        if (!cancelado) setFotos([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Solo pasa fotos mientras la sección se ve.
  useEffect(() => {
    const seccion = seccionRef.current;
    if (!seccion || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entrada]) => setEnPantalla(entrada.isIntersecting), { threshold: 0.35 });
    observer.observe(seccion);
    return () => observer.disconnect();
  }, [fotos.length]);

  const ir = useCallback(
    (indice) => {
      if (!fotos.length) return;
      const siguiente = (indice + fotos.length) % fotos.length;
      setActual(siguiente);
      // Se precarga la siguiente para que el fundido no muestre un hueco.
      setCargadas((antes) => new Set([...antes, siguiente, (siguiente + 1) % fotos.length]));
    },
    [fotos.length]
  );

  const corriendo = fotos.length > 1 && !reducido && !pausada && !encima && enPantalla;

  useEffect(() => {
    if (!corriendo) return undefined;
    const id = window.setTimeout(() => {
      if (document.visibilityState === "visible") ir(actual + 1);
    }, CADA_MS);
    return () => window.clearTimeout(id);
  }, [corriendo, actual, ir]);

  // La miniatura activa se mantiene a la vista en la tira deslizable del móvil.
  useEffect(() => {
    const tira = tiraRef.current;
    const boton = tira?.children[actual];
    if (!tira || !boton || tira.scrollWidth <= tira.clientWidth) return;
    const destino = boton.offsetLeft - (tira.clientWidth - boton.offsetWidth) / 2;
    tira.scrollTo({ left: destino, behavior: reducido ? "auto" : "smooth" });
  }, [actual, reducido]);

  if (!fotos.length) return null;

  const foto = fotos[actual];

  // Deslizar el dedo sobre la foto grande pasa a la anterior o la siguiente.
  const alTocar = (event) => {
    setPausada(true);
    toqueRef.current = { x: event.clientX, y: event.clientY };
  };
  const alSoltar = (event) => {
    const inicio = toqueRef.current;
    toqueRef.current = null;
    if (!inicio) return;
    const dx = event.clientX - inicio.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - inicio.y)) ir(actual + (dx < 0 ? 1 : -1));
  };

  return (
    <section className="fotosClub" aria-labelledby="fotos-club-title" ref={seccionRef}>
      <div className="sectionHeader sectionHeaderInline">
        <div>
          <h2 id="fotos-club-title">Fotos del club</h2>
        </div>
        <Link className="newsMoreBtn" to="/galeria">
          Ver todas las fotos
        </Link>
      </div>

      <div className="fotosClubCuerpo">
        <figure
          className="fotosClubDestacada"
          onMouseEnter={() => setEncima(true)}
          onMouseLeave={() => setEncima(false)}
          onPointerDown={alTocar}
          onPointerUp={alSoltar}
          onPointerCancel={() => {
            toqueRef.current = null;
          }}
        >
          <div className="fotosClubMarco">
            {fotos.map((item, indice) =>
              cargadas.has(indice) ? (
                <img
                  key={item.src}
                  src={conPublicUrl(item.src)}
                  alt={indice === actual ? item.title || "Foto del club" : ""}
                  aria-hidden={indice === actual ? undefined : "true"}
                  className={indice === actual ? "isActual" : ""}
                  decoding="async"
                  draggable="false"
                />
              ) : null
            )}
          </div>
          <figcaption>
            <span>{foto.category}</span>
            <strong>{foto.title}</strong>
          </figcaption>
          {fotos.length > 1 && !reducido && (
            <button
              type="button"
              className="fotosClubPausa"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setPausada((valor) => !valor)}
              aria-label={pausada ? "Seguir pasando las fotos" : "Parar las fotos"}
            >
              <IconoPausa pausado={pausada} />
            </button>
          )}
        </figure>

        {fotos.length > 1 && (
          <div className="fotosClubTira" ref={tiraRef} role="group" aria-label="Elegir foto">
            {fotos.map((item, indice) => (
              <button
                type="button"
                key={item.src}
                className={indice === actual ? "isActual" : ""}
                aria-pressed={indice === actual}
                aria-label={`Foto ${indice + 1} de ${fotos.length}: ${item.title || item.category || "del club"}`}
                onClick={() => {
                  setPausada(true);
                  ir(indice);
                }}
              >
                <img src={conPublicUrl(item.src)} alt="" loading="lazy" decoding="async" draggable="false" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
