import { useEffect, useRef, useState } from "react";
import "./hoja.css";

// Mensaje flotante. Los de éxito se quitan solos a los 6 s; los de error se quedan hasta cerrarlos.
// Uso: <Toast mensaje={toast} onCerrar={() => setToast(null)} />, con toast = { texto, tipo: "ok" | "error" }.
export default function Toast({ mensaje, onCerrar }) {
  const [visible, setVisible] = useState(false);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  useEffect(() => {
    if (!mensaje) return undefined;
    setVisible(false);
    const entrada = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setVisible(true)));
    let salida;
    if (mensaje.tipo !== "error") {
      salida = window.setTimeout(() => setVisible(false), 6000);
    }
    return () => {
      window.cancelAnimationFrame(entrada);
      window.clearTimeout(salida);
    };
  }, [mensaje]);

  if (!mensaje) return null;

  const tipo = mensaje.tipo === "error" ? "isError" : "isOk";

  return (
    <div
      className={`toastNani ${tipo}${visible ? " isVisible" : " isSaliendo"}`}
      role={mensaje.tipo === "error" ? "alert" : "status"}
      aria-live={mensaje.tipo === "error" ? "assertive" : "polite"}
      onTransitionEnd={(event) => {
        if (!visible && event.propertyName === "opacity") onCerrarRef.current?.();
      }}
    >
      <p>{mensaje.texto}</p>
      <button type="button" onClick={() => setVisible(false)}>Cerrar</button>
    </div>
  );
}
