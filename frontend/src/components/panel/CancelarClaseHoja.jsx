import { useEffect, useRef, useState } from "react";
import { apiGet } from "../../services/api";
import { IcCheck } from "./Iconos";
import { MOTIVOS_CANCELACION } from "./panelUtils";

const familias = (n) => (n === 1 ? "1 familia" : `${n} familias`);

// Texto llano del resultado del aviso (`aviso` de la respuesta de cancelar) para mostrarlo al profe.
// Devuelve "" si no se pidió aviso. Ejemplos: "Avisadas 8 familias." / "Avisadas 6 familias. No se pudo avisar a 2: llámalas."
export function textoAvisoFamilias(aviso) {
  if (!aviso) return "";
  const { estado, enviados = 0, fallidos = 0, sinTelefono = 0 } = aviso;
  if (estado === "desactivado") return "Los avisos por WhatsApp están desactivados: avisa a las familias por otro medio.";
  if (estado === "en_curso") return aviso.mensaje || "Enviando el aviso a las familias.";
  if (estado === "omitido" || (estado === "error" && !enviados && !fallidos)) return aviso.mensaje || "No se pudo avisar a las familias: llámalas.";
  const sin = fallidos + sinTelefono;
  const partes = [];
  if (enviados) partes.push(enviados === 1 ? "Avisada 1 familia." : `Avisadas ${enviados} familias.`);
  if (sin) partes.push(`No se pudo avisar a ${sin}: llámalas.`);
  if (!partes.length) return aviso.mensaje || "No había familias a las que avisar.";
  return partes.join(" ");
}

// Pregunta al backend si los avisos por WhatsApp están activos y a cuántas familias llegarían.
// Si falla o están apagados, la casilla simplemente no aparece (la cancelación no depende de ello).
function useAvisosWhatsapp(grupoId, fecha) {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    setEstado(null);
    if (!grupoId || !fecha) return undefined;
    let vigente = true;
    apiGet(`/api/gestion/control/avisos-whatsapp?grupo_id=${encodeURIComponent(grupoId)}&fecha=${encodeURIComponent(fecha)}`)
      .then((data) => { if (vigente) setEstado(data); })
      .catch(() => { if (vigente) setEstado(null); });
    return () => { vigente = false; };
  }, [grupoId, fecha]);
  return estado;
}

function Contenido({ grupoId, fecha, grupoNombre, fechaTexto, ocupado, error, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [recuperable, setRecuperable] = useState(true);
  const [avisar, setAvisar] = useState(false);
  const avisos = useAvisosWhatsapp(grupoId, fecha);
  const puedeAvisar = Boolean(avisos?.activo && avisos.destinatarios > 0);

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

      {puedeAvisar && (
        <label className="ppCheckRow ppCheckRowAviso">
          <input type="checkbox" checked={avisar} disabled={ocupado} aria-describedby="pp-avisar-nota" onChange={(e) => setAvisar(e.target.checked)} />
          <span>
            Avisar a las familias por WhatsApp
            <span className="ppCheckSub" id="pp-avisar-nota">
              {avisos.modo_prueba
                ? `Modo prueba: solo llegará a ${familias(avisos.destinatarios)} de prueba.`
                : `Llegará a ${familias(avisos.destinatarios)}.`}
              {avisos.sin_telefono > 0 && ` ${avisos.sin_telefono} sin teléfono válido: tendrás que llamarles.`}
            </span>
          </span>
        </label>
      )}

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
          onClick={() => onConfirmar({ motivo, texto: motivo === "otro" ? texto.trim() : "", recuperable, avisar_familias: puedeAvisar && avisar })}
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
// Con `grupoId` y `fecha` (AAAA-MM-DD) ofrece además la casilla "Avisar a las familias por WhatsApp"
// (desmarcada) si el backend dice que los avisos están activos; onConfirmar recibe `avisar_familias`.
export default function CancelarClaseHoja({ abierto, grupoId, fecha, grupoNombre, fechaTexto, ocupado = false, error = "", onConfirmar, onCancelar }) {
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
        <Contenido grupoId={grupoId} fecha={fecha} grupoNombre={grupoNombre} fechaTexto={fechaTexto} ocupado={ocupado} error={error} onConfirmar={onConfirmar} onCancelar={onCancelar} />
      )}
    </dialog>
  );
}
