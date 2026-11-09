// Horas libres para reservar pista, con la misma regla que la página de Reservas.
import { apiGet } from "./api";
import { ahoraMadrid, esPasada } from "./fechas";

// Turnos de 90 minutos que se pueden reservar cada día.
export const HORAS_RESERVA = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00", "22:30"];

// Una hora está libre si ninguna reserva activa la ocupa (las partidas abiertas sin
// jugadores no cuentan) y todavía no ha empezado.
export function contarHorasLibres(pistas, reservas, fechaISO, ahora = new Date()) {
  const ocupadas = new Set(
    (reservas || [])
      .filter((r) => r.estado !== "cancelada")
      .filter((r) => r.tipo_reserva !== "abierta" || Number(r.plazas_ocupadas || 0) > 0)
      .map((r) => `${r.pista_id}|${String(r.hora_inicio).slice(0, 5)}`)
  );
  let libres = 0;
  HORAS_RESERVA.forEach((hora) => {
    if (esPasada(fechaISO, hora, ahora)) return;
    (pistas || []).forEach((pista) => {
      if (!ocupadas.has(`${pista.id}|${hora}`)) libres += 1;
    });
  });
  return libres;
}

export async function horasLibresHoy() {
  const hoy = ahoraMadrid().fecha;
  const [pistas, reservas] = await Promise.all([apiGet("/api/reservas/pistas"), apiGet(`/api/reservas?fecha=${hoy}`)]);
  if (!pistas?.ok || !reservas?.ok || !Array.isArray(pistas.pistas)) throw new Error("Sin datos de reservas");
  return contarHorasLibres(pistas.pistas, reservas.reservas, hoy);
}
