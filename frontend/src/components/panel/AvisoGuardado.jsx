import { useCallback, useEffect, useRef, useState } from "react";
import { IcAviso, IcCheck } from "./Iconos";

// Aviso fijo abajo de la pantalla para confirmar lo que se acaba de guardar.
// Está siempre montado (role="status") para que el lector de pantalla lo anuncie
// y para que la salida pueda animarse con una transición.
export function useAvisoGuardado(duracion = 5000) {
  const [aviso, setAviso] = useState(null);
  const timer = useRef(null);

  const mostrar = useCallback((texto, tono = "ok") => {
    window.clearTimeout(timer.current);
    setAviso({ texto, tono, id: Date.now() });
    timer.current = window.setTimeout(() => setAviso((actual) => (actual ? { ...actual, cerrado: true } : actual)), duracion);
  }, [duracion]);

  const cerrar = useCallback(() => {
    window.clearTimeout(timer.current);
    setAviso((actual) => (actual ? { ...actual, cerrado: true } : actual));
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { aviso, mostrar, cerrar };
}

export default function AvisoGuardado({ aviso, onCerrar }) {
  const abierto = Boolean(aviso && !aviso.cerrado);
  return (
    <div className="ppToastZone" role="status" aria-live="polite">
      <div className="ppToast" data-open={abierto ? "true" : "false"} data-tone={aviso?.tono || "ok"} aria-hidden={!abierto}>
        <span className="ppToastIcon">{aviso?.tono === "error" ? <IcAviso /> : <IcCheck />}</span>
        <span className="ppToastText">{aviso?.texto}</span>
        <button type="button" className="ppToastClose" onClick={onCerrar} tabIndex={abierto ? 0 : -1}>Vale</button>
      </div>
    </div>
  );
}
