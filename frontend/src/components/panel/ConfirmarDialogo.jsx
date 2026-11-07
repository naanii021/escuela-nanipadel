import { useEffect, useRef } from "react";

// Diálogo propio para acciones que cuestan deshacer (quitar un alumno, desactivar un grupo).
// Los botones dicen el resultado ("Quitar a Ana") en vez de "Aceptar".
export default function ConfirmarDialogo({ abierto, titulo, texto, confirmar, cancelar = "Cancelar", ocupado = false, error = "", onConfirmar, onCancelar }) {
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
      className="ppDialog"
      aria-labelledby="pp-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!ocupado) onCancelar(); }}
      onClick={(event) => { if (event.target === ref.current && !ocupado) onCancelar(); }}
    >
      {abierto && (
        <div className="ppDialogBody">
          <h2 id="pp-dialog-title">{titulo}</h2>
          {texto && <p>{texto}</p>}
          {error && <p className="ppInlineError" role="alert">{error}</p>}
          <div className="ppDialogActions">
            <button type="button" className="ppBtn" onClick={onCancelar} disabled={ocupado}>{cancelar}</button>
            <button type="button" className="ppBtn ppBtnDanger" onClick={onConfirmar} disabled={ocupado}>
              {ocupado ? "Un momento..." : confirmar}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
