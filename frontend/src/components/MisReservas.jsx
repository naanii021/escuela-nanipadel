import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatch } from "../services/api";
import { isLogged } from "../services/auth";
import { fechaRelativa, horaFin } from "../services/fechas";
import { requestNotificationsRefresh } from "../services/notificationEvents";
import Hoja from "./Hoja";
import "./misReservas.css";

export function textoReserva(reserva) {
  const fin = horaFin(reserva.hora_inicio, reserva.duracion_min || 90);
  return `${fechaRelativa(reserva.fecha)}, de ${reserva.hora_inicio} a ${fin}`;
}

// Lista "Tus próximas reservas" con cancelar a un toque (más la confirmación).
// recarga: número que cambia cuando el padre quiere que se vuelva a pedir la lista.
// onCambio: se llama después de cancelar o salir de una partida.
export default function MisReservas({ recarga = 0, onCambio, titulo = "Tus próximas reservas", mostrarVacio = true, enlaceReservar = false }) {
  const [reservas, setReservas] = useState(null);
  const [aCancelar, setACancelar] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    if (!isLogged()) return;
    apiGet("/api/reservas/mias")
      .then((data) => setReservas(Array.isArray(data.reservas) ? data.reservas : []))
      .catch(() => setReservas(null));
  }, []);

  useEffect(() => { cargar(); }, [cargar, recarga]);

  if (!isLogged() || reservas === null) return null;
  if (!reservas.length && !mostrarVacio && !aviso) return null;

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      if (aCancelar.es_mia) {
        await apiPatch(`/api/reservas/${aCancelar.id}/cancelar`);
      } else {
        await apiDelete(`/api/reservas/${aCancelar.id}/participantes/me`);
      }
      setAviso(aCancelar.es_mia
        ? `Reserva cancelada: ${aCancelar.pista_nombre}, ${textoReserva(aCancelar)}.`
        : `Has salido de la partida de ${aCancelar.pista_nombre}.`);
      setACancelar(null);
      cargar();
      requestNotificationsRefresh();
      onCambio?.();
    } catch (e) {
      setError(e.message || "No hemos podido cancelar. Inténtalo otra vez o llama al club.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="misReservas" aria-labelledby="mis-reservas-titulo">
      <h2 id="mis-reservas-titulo">{titulo}</h2>

      {aviso && (
        <div className="mensajeCaja isOk misReservasAviso" role="status">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso("")}>Cerrar</button>
        </div>
      )}

      {reservas.length === 0 ? (
        <p className="misReservasVacio">
          No tienes reservas próximas.
          {enlaceReservar && <> <Link to="/reservas">Reservar pista</Link></>}
        </p>
      ) : (
        <ul className="misReservasLista">
          {reservas.map((reserva) => (
            <li key={reserva.id}>
              <div>
                <strong>{textoReserva(reserva)}</strong>
                <span>
                  {reserva.pista_nombre}
                  {reserva.tipo_reserva === "abierta" ? " · Partida abierta" : ""}
                </span>
              </div>
              <button type="button" className="btnGrande isPeligroSuave" onClick={() => { setError(""); setACancelar(reserva); }}>
                {reserva.es_mia ? "Cancelar" : "Salir"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aCancelar && (
        <Hoja
          titulo={aCancelar.es_mia ? "¿Cancelar esta reserva?" : "¿Salir de la partida?"}
          onCerrar={() => setACancelar(null)}
          pie={(cerrar) => (
            <>
              <button type="button" className="btnGrande isPeligro" onClick={confirmar} disabled={enviando} data-autofocus>
                {enviando ? "Cancelando…" : aCancelar.es_mia ? "Sí, cancelar la reserva" : "Sí, salir de la partida"}
              </button>
              <button type="button" className="btnGrande isSecundario" onClick={cerrar}>
                No, mantenerla
              </button>
            </>
          )}
        >
          {error && <div className="mensajeCaja isError" role="alert">{error}</div>}
          <p className="misReservasPregunta">
            <strong>{aCancelar.pista_nombre}</strong>
            <span>{textoReserva(aCancelar)}</span>
          </p>
          {!aCancelar.es_mia && <p>Si llevas invitados, también dejarán su plaza.</p>}
        </Hoja>
      )}
    </section>
  );
}
