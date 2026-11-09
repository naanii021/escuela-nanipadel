import { useEffect, useRef, useState } from "react";
import { IcCheck } from "./Iconos";
import { MOTIVOS_CANCELACION } from "./panelUtils";

function Contenido({ grupoNombre, fechaTexto, ocupado, error, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [recuperable, setRecuperable] = useState(true);

  return (
    <div className="ppDialogBody ppCancelBody">
      <h2 id="pp-cancelar-title">Cancelar la clase</h2>
      <fieldset className="ppMotivos">
        <legend>¿Por qué se cancela?</legend>
        <div className="ppMotivoGrid">
          {MOTIVOS_CANCELACION.map((item) => (
            <button
              key={item.key}
              type="button"
              className="ppMotivo"
              aria-pressed={motivo === item.key}
              disabled={ocupado}
              onClick={() => setMotivo(item.key)}
            >
              {motivo === item.key && <IcCheck />}
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      {motivo === "otro" && (
        <label className="ppField">
          <span>Cuéntalo en pocas palabras (opcional)</span>
          <input type="text" value={texto} maxLength={80} disabled={ocupado} onChange={(e) => setTexto(e.target.value)} placeholder="Por ejemplo: obras en la pista" />
        </label>
      )}

      <label className="ppCheckRow">
        <input type="checkbox" checked={recuperable} disabled={ocupado} onChange={(e) => setRecuperable(e.target.checked)} />
        <span>Los alumnos podrán recuperarla</span>
      </label>

      <p className="ppCancelAviso">
        Se cancelará la clase de <strong>{grupoNombre}</strong> del {fechaTexto}. No hace falta marcar la asistencia.
      </p>
      {error && <p className="ppInlineError" role="alert">{error}</p>}

      <div className="ppDialogActions">
        <button type="button" className="ppBtn" onClick={onCancelar} disabled={ocupado}>No, volver</button>
        <button
          type="button"
          className="ppBtn ppBtnDanger"
          disabled={!motivo || ocupado}
          onClick={() => onConfirmar({ motivo, texto: motivo === "otro" ? texto.trim() : "", recuperable })}
        >
          {ocupado ? "Un momento..." : "Sí, cancelar la clase"}
        </button>
      </div>
      {!motivo && <p className="ppFieldNote ppCancelPista">Elige un motivo para poder cancelar.</p>}
    </div>
  );
}

// Hoja para cancelar toda la clase: motivo de un toque, casilla de recuperación y confirmación clara.
// En el móvil entra desde abajo; en pantallas grandes es un cuadro centrado.
export default function CancelarClaseHoja({ abierto, grupoNombre, fechaTexto, ocupado = false, error = "", onConfirmar, onCancelar }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (abierto && !dialog.open) dialog.showModal?.();
    if (!abierto && dialog.open) dialog.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="ppDialog ppCancelDialog"
      aria-labelledby="pp-cancelar-title"
      onCancel={(event) => { event.preventDefault(); if (!ocupado) onCancelar(); }}
      onClick={(event) => { if (event.target === ref.current && !ocupado) onCancelar(); }}
    >
      {abierto && (
        <Contenido grupoNombre={grupoNombre} fechaTexto={fechaTexto} ocupado={ocupado} error={error} onConfirmar={onConfirmar} onCancelar={onCancelar} />
      )}
    </dialog>
  );
}
