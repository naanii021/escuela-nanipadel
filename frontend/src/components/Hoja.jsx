import { useCallback, useEffect, useId, useRef, useState } from "react";
import "./hoja.css";

// Ventana común: hoja que sube desde abajo en el móvil y diálogo centrado en escritorio.
// Se cierra con la X, tocando fuera, con Escape y con el botón Atrás del móvil.
// El padre la monta para abrirla y la desmonta en onCerrar.

const pila = [];
let popsIgnorados = 0;

function escucharAtras() {
  window.addEventListener("popstate", () => {
    if (popsIgnorados > 0) {
      popsIgnorados -= 1;
      return;
    }
    const ultima = pila[pila.length - 1];
    if (ultima) ultima.porAtras();
  });
}

let escuchando = false;

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Hoja({ titulo, subtitulo, onCerrar, children, pie, tamano = "normal", className = "" }) {
  const panelRef = useRef(null);
  const onCerrarRef = useRef(onCerrar);
  const cerradaPorAtras = useRef(false);
  const avisado = useRef(false);
  const [cerrando, setCerrando] = useState(false);
  const tituloId = useId();
  onCerrarRef.current = onCerrar;

  const cerrar = useCallback(() => setCerrando(true), []);
  const avisarCierre = useCallback(() => {
    if (avisado.current) return;
    avisado.current = true;
    onCerrarRef.current?.();
  }, []);

  useEffect(() => {
    if (!escuchando) {
      escucharAtras();
      escuchando = true;
    }
    const entrada = {
      porAtras: () => {
        cerradaPorAtras.current = true;
        setCerrando(true);
      },
    };
    pila.push(entrada);
    window.history.pushState({ ...(window.history.state || {}), hojaNani: true }, "");

    const anterior = document.activeElement;
    const panel = panelRef.current;
    const primero = panel?.querySelector("[data-autofocus]") || panel;
    primero?.focus({ preventScroll: true });
    document.documentElement.classList.add("hojaAbierta");

    return () => {
      pila.splice(pila.indexOf(entrada), 1);
      if (!pila.length) document.documentElement.classList.remove("hojaAbierta");
      if (!cerradaPorAtras.current && window.history.state?.hojaNani) {
        popsIgnorados += 1;
        window.history.back();
      }
      if (anterior && typeof anterior.focus === "function" && document.contains(anterior)) {
        anterior.focus({ preventScroll: true });
      }
    };
  }, []);

  // Al terminar la animación de salida se avisa al padre (con red de seguridad por si no hay animación).
  useEffect(() => {
    if (!cerrando) return undefined;
    const temporizador = window.setTimeout(avisarCierre, 260);
    return () => window.clearTimeout(temporizador);
  }, [cerrando, avisarCierre]);

  const alTeclear = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      cerrar();
      return;
    }
    if (event.key !== "Tab") return;
    const enfocables = [...panelRef.current.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null);
    if (!enfocables.length) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (event.shiftKey && (document.activeElement === primero || document.activeElement === panelRef.current)) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  };

  return (
    <div className={`hojaFondo${cerrando ? " isCerrando" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) cerrar(); }}>
      <div
        ref={panelRef}
        className={`hoja hoja-${tamano}${cerrando ? " isCerrando" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={alTeclear}
        onAnimationEnd={(event) => { if (cerrando && event.target === event.currentTarget) avisarCierre(); }}
      >
        <span className="hojaAsa" aria-hidden="true" />
        <header className="hojaCabecera">
          <div>
            <h2 id={tituloId}>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" className="hojaCerrar" onClick={cerrar}>
            Cerrar
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="hojaCuerpo">{typeof children === "function" ? children(cerrar) : children}</div>
        {pie && <footer className="hojaPie">{typeof pie === "function" ? pie(cerrar) : pie}</footer>}
      </div>
    </div>
  );
}
