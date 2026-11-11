import { IcAviso, IcPersonas } from "./Iconos";
import { cuandoCambio, nombrePilaDe } from "./panelUtils";

function resumenCorto(resumen = {}) {
  const partes = [];
  const presente = Number(resumen.presente || 0);
  const falta = Number(resumen.falta || 0);
  const justificada = Number(resumen.justificada || 0);
  partes.push(`${presente} ${presente === 1 ? "vino" : "vinieron"}`);
  if (falta) partes.push(`${falta} ${falta === 1 ? "faltó" : "faltaron"}`);
  if (justificada) partes.push(`${justificada} ${justificada === 1 ? "justificada" : "justificadas"}`);
  return partes.join(", ");
}

// Texto llano de lo que hizo el compañero. Devuelve "" si no hay nada que avisar
// (solo existe la sesión, sin lista ni cancelación).
export function textoCambioCompanero(cambio, motivo = "") {
  if (!cambio) return "";
  const nombre = nombrePilaDe(cambio.profesor);
  const cuando = cuandoCambio(cambio.en);
  if (cambio.estado === "cancelada") {
    return `${nombre} canceló esta clase${motivo ? ` (${motivo})` : ""}${cuando ? ` ${cuando}` : ""}.`;
  }
  if (!cambio.hay_asistencia) return "";
  return `${nombre} ya pasó lista${cuando ? ` ${cuando}` : ""}: ${resumenCorto(cambio.resumen)}. Puedes corregirla.`;
}

// Aviso ámbar: otro profesor ya tocó esta clase. `nuevo` = lo guardó después de que yo abriera la lista.
export function AvisoCompanero({ cambio, motivo, nuevo, onVer }) {
  const texto = textoCambioCompanero(cambio, motivo);
  if (!texto) return null;
  const nombre = nombrePilaDe(cambio.profesor);
  return (
    <div className="ppSharedNotice" role="status" data-nuevo={nuevo ? "true" : "false"}>
      <IcPersonas className="ppSharedNoticeIcon" />
      <div className="ppSharedNoticeBody">
        <p>{texto}</p>
        {nuevo && <p className="ppSharedNoticeSub">Lo guardó mientras tenías esta lista abierta. Lo que has marcado tú sigue aquí.</p>}
        {nuevo && onVer && <button type="button" className="ppBtn" onClick={onVer}>Ver lo que guardó {nombre}</button>}
      </div>
    </div>
  );
}

// Conflicto 409: otro profesor guardó antes. Nada se ha escrito; se elige qué hacer.
export function AvisoConflicto({ conflicto, ocupado, onVer, onForzar }) {
  if (!conflicto) return null;
  const nombre = nombrePilaDe(conflicto.cambio?.profesor);
  const verbo = conflicto.tipo === "cancelar" ? "Cancelar" : conflicto.tipo === "reabrir" ? "Reabrir" : "Guardar";
  return (
    <div className="ppConflict" role="alert">
      <p className="ppConflictText"><IcAviso /><span>{conflicto.mensaje}</span></p>
      <p className="ppConflictSub">No se ha guardado nada todavía.{conflicto.tipo === "guardar" ? " Tus marcas siguen aquí." : ""}</p>
      <div className="ppConflictActions">
        <button type="button" className="ppBtn" onClick={onVer} disabled={ocupado}>Ver lo que guardó {nombre}</button>
        <button type="button" className="ppBtn ppBtnPrimary" onClick={onForzar} disabled={ocupado}>
          {ocupado ? "Un momento..." : `${verbo} igualmente`}
        </button>
      </div>
    </div>
  );
}
