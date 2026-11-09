import { useEffect, useMemo, useState } from "react";
import { apiPatch } from "../../services/api";
import { formatFecha, hora, nombreCompleto, plural } from "./panelUtils";

const ESTADOS = [
  { key: "pendiente", label: "Sin fecha todavía" },
  { key: "asignada", label: "Con fecha" },
  { key: "recuperada", label: "Ya recuperada" },
  { key: "cancelada", label: "Anulada" },
];
const FILTROS = [
  { key: "pendiente", label: "Sin fecha" },
  { key: "asignada", label: "Con fecha" },
  { key: "hechas", label: "Hechas o anuladas" },
];

function borradorDe(item) {
  return {
    estado: item.estado || "pendiente",
    fecha_recuperacion: item.fecha_recuperacion || "",
    sesion_recuperacion_id: item.sesion_recuperacion_id ? String(item.sesion_recuperacion_id) : "",
  };
}

export default function Recuperaciones({ recuperaciones, sesiones, cargando, error, onRecargar, onAviso }) {
  const [filtro, setFiltro] = useState("pendiente");
  const [borradores, setBorradores] = useState({});
  const [guardandoId, setGuardandoId] = useState(null);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    setBorradores(Object.fromEntries(recuperaciones.map((item) => [item.id, borradorDe(item)])));
  }, [recuperaciones]);

  const cuentas = useMemo(() => ({
    pendiente: recuperaciones.filter((item) => item.estado === "pendiente").length,
    asignada: recuperaciones.filter((item) => item.estado === "asignada").length,
    hechas: recuperaciones.filter((item) => item.estado === "recuperada" || item.estado === "cancelada").length,
  }), [recuperaciones]);

  const visibles = recuperaciones.filter((item) => (
    filtro === "hechas" ? item.estado === "recuperada" || item.estado === "cancelada" : item.estado === filtro
  ));

  const cambiar = (id, cambios) => setBorradores((actual) => ({ ...actual, [id]: { ...actual[id], ...cambios } }));

  const guardar = async (item) => {
    const borrador = borradores[item.id];
    if (!borrador) return;
    try {
      setGuardandoId(item.id);
      setErrores((actual) => ({ ...actual, [item.id]: "" }));
      await apiPatch(`/api/gestion/control/recuperaciones/${item.id}`, {
        estado: borrador.estado,
        fecha_recuperacion: borrador.fecha_recuperacion || null,
        sesion_recuperacion_id: borrador.sesion_recuperacion_id || null,
      });
      onAviso?.(`Recuperación de ${nombreCompleto({ nombre: item.alumno_nombre, apellidos: item.alumno_apellidos })} guardada.`);
      await onRecargar?.();
    } catch (e) {
      setErrores((actual) => ({ ...actual, [item.id]: `${e.message || "No se ha podido guardar."} Puedes volver a intentarlo.` }));
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <section className="ppSection" aria-labelledby="pp-rec-title">
      <div className="ppSectionHead">
        <h2 id="pp-rec-title">Recuperaciones</h2>
        <p>Aquí se apuntan las faltas justificadas y las clases canceladas que se pueden recuperar.</p>
      </div>

      <div className="ppSegmentedTabs" role="group" aria-label="Qué recuperaciones ver">
        {FILTROS.map((item) => (
          <button key={item.key} type="button" aria-pressed={filtro === item.key} onClick={() => setFiltro(item.key)}>
            {item.label} <span className="ppCount">{cuentas[item.key]}</span>
          </button>
        ))}
      </div>

      {cargando && <p className="ppEmpty">Cargando recuperaciones...</p>}
      {error && (
        <div className="ppInlineError" role="alert">
          <span>{error}</span>
          <button type="button" className="ppBtn" onClick={onRecargar}>Reintentar</button>
        </div>
      )}
      {!cargando && !error && visibles.length === 0 && (
        <p className="ppEmpty">
          {filtro === "pendiente" ? "No hay recuperaciones sin fecha. Todo al día." : "No hay ninguna en este apartado."}
        </p>
      )}

      {!cargando && visibles.length > 0 && (
        <ul className="ppRecList">
          {visibles.map((item) => {
            const borrador = borradores[item.id] || borradorDe(item);
            const opciones = sesiones.filter((sesion) => (
              sesion.estado !== "cancelada" && sesion.fecha === borrador.fecha_recuperacion && Number(sesion.id) !== Number(item.sesion_origen_id)
            ));
            const nombre = nombreCompleto({ nombre: item.alumno_nombre, apellidos: item.alumno_apellidos });
            return (
              <li className="ppRecCard" key={item.id}>
                <div className="ppRecHead">
                  <strong>{nombre}</strong>
                  <span>
                    {item.motivo === "clase_cancelada"
                      ? `Clase cancelada el ${formatFecha(item.fecha_original)} (${item.grupo_origen})`
                      : `Faltó el ${formatFecha(item.fecha_original)} a ${item.grupo_origen}`}
                  </span>
                  {item.fecha_recuperacion && <span>Recupera el {formatFecha(item.fecha_recuperacion)}</span>}
                </div>
                <div className="ppRecForm">
                  <label className="ppField">
                    <span>Día para recuperar</span>
                    <input
                      type="date"
                      value={borrador.fecha_recuperacion}
                      onChange={(e) => cambiar(item.id, {
                        fecha_recuperacion: e.target.value,
                        sesion_recuperacion_id: "",
                        estado: e.target.value && borrador.estado === "pendiente" ? "asignada" : borrador.estado,
                      })}
                    />
                  </label>
                  {borrador.fecha_recuperacion && (
                    opciones.length ? (
                      <label className="ppField">
                        <span>En qué clase</span>
                        <select value={borrador.sesion_recuperacion_id} onChange={(e) => cambiar(item.id, { sesion_recuperacion_id: e.target.value })}>
                          <option value="">Sin elegir</option>
                          {opciones.map((sesion) => (
                            <option key={sesion.id} value={sesion.id}>{hora(sesion.hora_inicio)} · {sesion.grupo_nombre}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="ppFieldNote">Ese día todavía no hay lista pasada de ninguna clase. Puedes guardar solo el día.</p>
                    )
                  )}
                  <label className="ppField">
                    <span>Estado</span>
                    <select value={borrador.estado} onChange={(e) => cambiar(item.id, { estado: e.target.value })}>
                      {ESTADOS.map((estado) => <option key={estado.key} value={estado.key}>{estado.label}</option>)}
                    </select>
                  </label>
                  {errores[item.id] && <p className="ppInlineError" role="alert">{errores[item.id]}</p>}
                  <button type="button" className="ppBtn ppBtnPrimary" onClick={() => guardar(item)} disabled={guardandoId === item.id}>
                    {guardandoId === item.id ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!cargando && recuperaciones.length > 0 && (
        <p className="ppFieldNote">{plural(recuperaciones.length, "recuperación", "recuperaciones")} en este curso.</p>
      )}
    </section>
  );
}
