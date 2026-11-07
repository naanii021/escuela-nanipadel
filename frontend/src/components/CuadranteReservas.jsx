import { Fragment } from "react";
import "./cuadranteReservas.css";

// Cuadrante de reservas: columnas = pistas, filas = franjas de 90 minutos agrupadas en
// Mañana, Tarde y Noche. Cada celda es un botón grande (o un texto, si no se puede tocar)
// con el estado en color y en palabras. Las flechas del teclado mueven entre celdas.

const FRANJAS = [
  { id: "manana", titulo: "Mañana", hasta: "14:00" },
  { id: "tarde", titulo: "Tarde", hasta: "20:00" },
  { id: "noche", titulo: "Noche", hasta: "24:00" },
];

function franjaDe(hora) {
  return FRANJAS.find((franja) => hora < franja.hasta) || FRANJAS[FRANJAS.length - 1];
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function plazasLibres(slot) {
  return Math.max(Number(slot?.maxJugadores || 4) - Number(slot?.plazasOcupadas || 0), 0);
}

export function esLibre(slot) {
  return slot.status === "disponible" && !slot.pasada;
}

const IconoPista = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
    <path d="M5 12h14M12 6.5v11M5 6.5h14M5 17.5h14" />
  </svg>
);

function Celda({ slot, precio, onReservar, onDetalle }) {
  const cuando = `${slot.courtName}, de ${slot.start} a ${slot.end}`;
  const comun = { "data-r": slot.fila, "data-c": slot.columna };

  if (slot.pasada) {
    return (
      <div className="cuCelda isPasada" {...comun}>
        <span className="cuOculto">{cuando}, ya ha pasado</span>
        <span aria-hidden="true">Ya ha pasado</span>
      </div>
    );
  }

  if (slot.mia) {
    const abierta = slot.status === "abierta";
    const faltan = plazasLibres(slot);
    return (
      <button
        type="button"
        className="cuCelda isMia"
        onClick={() => onDetalle(slot)}
        aria-label={`${cuando}, ${abierta ? `tu partida, ${faltan ? `faltan ${faltan}` : "completa"}` : "tu reserva"}. Ver o cancelar`}
        {...comun}
      >
        <strong>{abierta ? "Tu partida" : "Tu reserva"}</strong>
        <span>{abierta && faltan ? `Faltan ${faltan}` : "Ver o cancelar"}</span>
      </button>
    );
  }

  if (slot.status === "disponible") {
    return (
      <button
        type="button"
        className="cuCelda isLibre"
        onClick={() => onReservar(slot)}
        aria-label={`${cuando}, libre. Reservar por ${precio} euros`}
        {...comun}
      >
        <strong>Libre</strong>
        <span><b>Reservar</b> · {precio} €</span>
      </button>
    );
  }

  if (slot.status === "abierta") {
    const faltan = plazasLibres(slot);
    return (
      <button
        type="button"
        className="cuCelda isAbierta"
        onClick={() => onDetalle(slot)}
        aria-label={`${cuando}, partida abierta, ${faltan === 1 ? "falta 1 jugador" : `faltan ${faltan} jugadores`}. Ver la partida`}
        {...comun}
      >
        <strong>Partida abierta</strong>
        <span>{faltan === 1 ? "Falta 1" : `Faltan ${faltan}`}</span>
      </button>
    );
  }

  return (
    <div className="cuCelda isOcupada" {...comun}>
      <span className="cuOculto">{cuando}, ocupada</span>
      <span aria-hidden="true">Ocupada</span>
    </div>
  );
}

// Flechas: van a la celda tocable más cercana en esa dirección.
function moverConFlechas(event) {
  const pasos = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
  const actual = event.target.closest?.("button.cuCelda");
  if (!pasos || !actual) return;
  const tabla = event.currentTarget;
  let fila = Number(actual.dataset.r);
  let columna = Number(actual.dataset.c);
  for (let i = 0; i < 40; i += 1) {
    fila += pasos[0];
    columna += pasos[1];
    const destino = tabla.querySelector(`[data-r="${fila}"][data-c="${columna}"]`);
    if (!destino) return;
    if (destino.tagName === "BUTTON") {
      event.preventDefault();
      destino.focus();
      destino.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
  }
}

// filas: [[slot pista 1, slot pista 2…], …] ya filtradas (sin las pasadas si se ocultan).
// ahora: "HH:MM" si el día mostrado es hoy; se dibuja la línea de "ahora".
export default function CuadranteReservas({ pistas, filas, ahora, precio, ocupado, onReservar, onDetalle }) {
  const libresPorPista = pistas.map((_, columna) => filas.filter((fila) => esLibre(fila[columna])).length);
  const indiceAhora = ahora ? (() => {
    const i = filas.findIndex((fila) => !fila[0].pasada);
    return i === -1 ? filas.length : i;
  })() : -1;

  const grupos = [];
  filas.forEach((fila, indice) => {
    const franja = franjaDe(fila[0].start);
    let grupo = grupos[grupos.length - 1];
    if (!grupo || grupo.franja !== franja) {
      grupo = { franja, filas: [] };
      grupos.push(grupo);
    }
    grupo.filas.push({ fila, indice });
  });

  const lineaAhora = (
    <tr className="cuAhora" key="ahora">
      <td colSpan={pistas.length + 1}>
        <span className="cuAhoraMarca">Ahora · {ahora}</span>
      </td>
    </tr>
  );

  return (
    <div className={`cuMarco${pistas.length > 2 ? " isAncho" : ""}${ocupado ? " isOcupado" : ""}`} aria-busy={ocupado || undefined} style={{ "--pistas": pistas.length }}>
      <table className="cuTabla" onKeyDown={moverConFlechas}>
        <caption className="cuOculto">Horas libres y ocupadas por pista. Toca una hora libre para reservarla.</caption>
        <thead>
          <tr>
            <th scope="col" className="cuEsquina">Hora</th>
            {pistas.map((pista, columna) => (
              <th scope="col" key={pista.id}>
                <span className="cuPista">
                  <span className="cuPistaIcono">{IconoPista}</span>
                  <strong>{pista.nombre}</strong>
                </span>
                <small className={libresPorPista[columna] ? "" : "isNinguna"}>
                  {libresPorPista[columna] ? plural(libresPorPista[columna], "libre", "libres") : "Completa"}
                </small>
              </th>
            ))}
          </tr>
        </thead>
        {grupos.map(({ franja, filas: filasGrupo }) => {
          const libres = filasGrupo.reduce((total, { fila }) => total + fila.filter(esLibre).length, 0);
          return (
            <tbody key={franja.id} className="cuFranja">
              <tr className="cuFranjaTitulo">
                <th scope="rowgroup" colSpan={pistas.length + 1}>
                  <span className="cuFranjaTexto">
                    <span>{franja.titulo}</span>
                    <small>{libres ? plural(libres, "hora libre", "horas libres") : "Nada libre"}</small>
                  </span>
                </th>
              </tr>
              {filasGrupo.map(({ fila, indice }) => (
                <Fragment key={fila[0].start}>
                {indice === indiceAhora ? lineaAhora : null}
                <tr className={fila[0].pasada ? "isPasada" : ""}>
                  <th scope="row" className="cuHora">
                    <strong>{fila[0].start}</strong>
                    <span>a {fila[0].end}</span>
                  </th>
                  {fila.map((slot, columna) => (
                    <td key={slot.id}>
                      <Celda slot={{ ...slot, fila: indice, columna }} precio={precio} onReservar={onReservar} onDetalle={onDetalle} />
                    </td>
                  ))}
                </tr>
                </Fragment>
              ))}
              {indiceAhora === filas.length && franja === grupos[grupos.length - 1].franja ? lineaAhora : null}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

export function Leyenda({ precio, className = "" }) {
  return (
    <ul className={`cuLeyenda ${className}`} aria-label="Qué significa cada color">
      <li><span className="cuMuestra isLibre" aria-hidden="true" />Libre · {precio} €</li>
      <li><span className="cuMuestra isMia" aria-hidden="true" />Tu reserva</li>
      <li><span className="cuMuestra isAbierta" aria-hidden="true" />Partida abierta</li>
      <li><span className="cuMuestra isOcupada" aria-hidden="true" />Ocupada</li>
    </ul>
  );
}
