import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import {
  NOTIFICATION_EVENTS,
  notifyEvent,
} from "../services/notificationService.js";

const router = express.Router();
const query = (sql, params = []) => db.promise().query(sql, params);

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";
const OPEN_MATCH_MAX_PLAYERS = 4;

// Middleware opcional: permite enriquecer la respuesta si el usuario está logueado
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch {
      req.user = null;
    }
  }

  next();
}

async function getTableColumns(tableName) {
  const [rows] = await query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

async function tableExists(tableName) {
  const [rows] = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

function selectColumn(columns, expression, fallback, alias) {
  return columns.has(alias) ? expression : `${fallback} AS ${alias}`;
}

function normalizeLevel(value) {
  if (value === "" || value === null || value === undefined) return null;

  const level = Number(value);
  return Number.isInteger(level) && level >= 0 && level <= 6 ? level : null;
}

// ==============================
// Helpers de formato
// ==============================

function capitalizar(texto = "") {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

function formatearFechaES(fechaValor) {
  if (!fechaValor) return "";

  let fecha;

  // Si MySQL ya devuelve un objeto Date, lo usamos directamente
  if (fechaValor instanceof Date) {
    fecha = fechaValor;
  } else {
    const texto = String(fechaValor).trim();

    // Si viene en formato YYYY-MM-DD, lo parseamos manualmente
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      const [year, month, day] = texto.split("-").map(Number);
      fecha = new Date(year, month - 1, day);
    } else {
      // Último intento genérico
      fecha = new Date(texto);
    }
  }

  // Si sigue siendo inválida, devolvemos el valor en bruto
  if (Number.isNaN(fecha.getTime())) {
    return String(fechaValor);
  }

  const textoFormateado = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);

  return capitalizar(textoFormateado);
}

function formatearHora(hora) {
  return String(hora || "").slice(0, 5);
}

// Convierte lo que venga del frontend en una lista limpia de invitados.
// Acepta:
// - invitados: ["Carlos", "Mario"]
// - num_invitados: 2
// - invitados_count: 2
function normalizarInvitados(body = {}) {
  // Si viene un array de nombres, limpiamos textos vacíos
  if (Array.isArray(body.invitados)) {
    return body.invitados
      .map((nombre, index) => {
        const limpio = String(nombre || "").trim();

        return limpio || `Invitado ${index + 1}`;
      })
      .filter(Boolean)
      .slice(0, OPEN_MATCH_MAX_PLAYERS - 1);
  }

  // Si viene un número, generamos nombres automáticos
  const cantidad = Number(body.num_invitados ?? body.invitados_count ?? 0);

  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return [];
  }

  return Array.from(
    {
      length: Math.min(cantidad, OPEN_MATCH_MAX_PLAYERS - 1),
    },
    (_item, index) => `Invitado ${index + 1}`,
  );
}

// Inserta invitados/amigos de un usuario en una partida abierta.
// Cada invitado ocupa una plaza más.
async function insertarInvitadosPartida(
  connection,
  reservaId,
  userId,
  invitados = [],
) {
  // Si no hay invitados, no hacemos nada
  if (!Array.isArray(invitados) || invitados.length === 0) {
    return;
  }

  // Insertamos una fila por cada invitado
  for (const nombreInvitado of invitados) {
    await connection.query(
      `INSERT INTO reservas_pista_participantes
        (reserva_id, usuario_id, alumno_id, tipo_participante, nombre_invitado, invitado_de_usuario_id, estado, es_creador)
       VALUES (?, NULL, NULL, 'invitado', ?, ?, 'confirmado', 0)`,
      [reservaId, nombreInvitado, userId],
    );
  }
}

async function getAlumnoForUser(userId) {
  const alumnosColumns = await getTableColumns("alumnos");
  if (!alumnosColumns.has("usuario_id")) return null;

  const selects = [
    "id",
    "nombre",
    "apellidos",
    alumnosColumns.has("nivel_juego") ? "nivel_juego" : "NULL AS nivel_juego",
  ];

  const [rows] = await query(
    `SELECT ${selects.join(", ")} FROM alumnos WHERE usuario_id = ? LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

async function getUserGameLevel(user) {
  const usuarioColumns = await getTableColumns("usuarios");
  let userLevel = null;

  if (usuarioColumns.has("nivel_juego")) {
    const [users] = await query(
      "SELECT nivel_juego FROM usuarios WHERE id = ? LIMIT 1",
      [user.id],
    );
    userLevel = normalizeLevel(users[0]?.nivel_juego);
  }

  if (userLevel !== null) return userLevel;

  const alumno = await getAlumnoForUser(user.id);
  return normalizeLevel(alumno?.nivel_juego);
}

function canJoinReservation(reserva, user, userLevel, userParticipant) {
  if (!user) {
    return {
      puede_unirse: false,
      motivo_no_unirse: "Debes iniciar sesion para unirte.",
    };
  }

  if (reserva.tipo_reserva !== "abierta") {
    return {
      puede_unirse: false,
      motivo_no_unirse: "No es una partida abierta.",
    };
  }

  if (reserva.estado === "cancelada") {
    return {
      puede_unirse: false,
      motivo_no_unirse: "La partida esta cancelada.",
    };
  }

  if (userParticipant) {
    return {
      puede_unirse: false,
      motivo_no_unirse: "Ya estas en esta partida.",
    };
  }

  if (
    Number(reserva.plazas_ocupadas || 0) >=
    Number(reserva.max_jugadores || OPEN_MATCH_MAX_PLAYERS)
  ) {
    return {
      puede_unirse: false,
      motivo_no_unirse: "Partida completa.",
    };
  }

  if (userLevel === null) {
    return {
      puede_unirse: false,
      motivo_no_unirse: "Configura tu nivel de juego antes de unirte.",
    };
  }

  if (reserva.nivel_min !== null && userLevel < Number(reserva.nivel_min)) {
    return {
      puede_unirse: false,
      motivo_no_unirse: "Tu nivel no coincide con esta partida.",
    };
  }

  if (reserva.nivel_max !== null && userLevel > Number(reserva.nivel_max)) {
    return {
      puede_unirse: false,
      motivo_no_unirse: "Tu nivel no coincide con esta partida.",
    };
  }

  return { puede_unirse: true, motivo_no_unirse: null };
}

async function getParticipantsByReservation(reservaIds) {
  // Si no hay reservas o no existe la tabla de participantes, devolvemos mapa vacío
  if (
    !reservaIds.length ||
    !(await tableExists("reservas_pista_participantes"))
  ) {
    return new Map();
  }

  // Leemos columnas reales para mantener compatibilidad con usuarios/alumnos
  const usuarioColumns = await getTableColumns("usuarios");
  const alumnoColumns = await getTableColumns("alumnos");

  // Helper para usar un campo de usuarios si existe
  const usuarioField = (field) =>
    usuarioColumns.has(field) ? `u.${field}` : "NULL";

  // Helper para usar un campo de alumnos si existe
  const alumnoField = (field) =>
    alumnoColumns.has(field) ? `a.${field}` : "NULL";

  const [rows] = await query(
    `SELECT
      rp.reserva_id,
      rp.usuario_id,
      rp.alumno_id,
      rp.estado,
      rp.es_creador,
      rp.tipo_participante,
      rp.nombre_invitado,
      rp.invitado_de_usuario_id,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN COALESCE(rp.nombre_invitado, 'Invitado')
        ELSE COALESCE(${alumnoField("nombre")}, ${usuarioField("nombre")}, 'Jugador')
      END AS nombre,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN NULL
        ELSE COALESCE(${alumnoField("apellidos")}, ${usuarioField("apellidos")})
      END AS apellidos,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN NULL
        ELSE COALESCE(${alumnoField("foto_perfil_url")}, ${usuarioField("foto_perfil_url")})
      END AS foto_perfil_url,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN NULL
        ELSE COALESCE(${alumnoField("nivel_juego")}, ${usuarioField("nivel_juego")})
      END AS nivel_juego,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN NULL
        ELSE COALESCE(${alumnoField("mano_dominante")}, ${usuarioField("mano_dominante")})
      END AS mano_dominante,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN NULL
        ELSE COALESCE(${alumnoField("lado_preferido")}, ${usuarioField("lado_preferido")})
      END AS lado_preferido,

      CASE
        WHEN rp.tipo_participante = 'invitado'
          THEN NULL
        ELSE COALESCE(${alumnoField("club_habitual")}, ${usuarioField("club_habitual")})
      END AS club_habitual

     FROM reservas_pista_participantes rp
     LEFT JOIN usuarios u ON u.id = rp.usuario_id
     LEFT JOIN alumnos a ON a.id = rp.alumno_id
     WHERE rp.reserva_id IN (${reservaIds.map(() => "?").join(", ")})
       AND rp.estado = 'confirmado'
     ORDER BY
       rp.es_creador DESC,
       CASE WHEN rp.tipo_participante = 'usuario' THEN 0 ELSE 1 END,
       rp.creado_en ASC`,
    reservaIds,
  );

  const map = new Map();

  // Agrupamos los participantes por reserva
  rows.forEach((row) => {
    if (!map.has(row.reserva_id)) map.set(row.reserva_id, []);
    map.get(row.reserva_id).push(row);
  });

  return map;
}

async function updateOpenReservationState(connection, reservaId) {
  const [countRows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM reservas_pista_participantes
     WHERE reserva_id = ? AND estado = 'confirmado'`,
    [reservaId],
  );

  const total = Number(countRows[0]?.total || 0);

  const [reservationRows] = await connection.query(
    "SELECT max_jugadores FROM reservas_pista WHERE id = ? LIMIT 1",
    [reservaId],
  );

  const maxPlayers = Number(
    reservationRows[0]?.max_jugadores || OPEN_MATCH_MAX_PLAYERS,
  );

  const nextStatus =
    total === 0 ? "cancelada" : total >= maxPlayers ? "confirmada" : "abierta";

  await connection.query("UPDATE reservas_pista SET estado = ? WHERE id = ?", [
    nextStatus,
    reservaId,
  ]);

  return total;
}

async function notifyReservaCreada(reservaId, userId) {
  try {
    const [rows] = await query(
      `SELECT
         r.id,
         r.fecha,
         r.hora_inicio,
         r.duracion_min,
         r.tipo_reserva,
         p.nombre AS pista_nombre,
         u.nombre AS usuario_nombre
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       LEFT JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.id = ?
       LIMIT 1`,
      [reservaId],
    );

    const reserva = rows[0];
    if (!reserva) return;

    const fechaBonita = formatearFechaES(reserva.fecha);
    const horaInicio = formatearHora(reserva.hora_inicio);

    await notifyEvent({
      type: NOTIFICATION_EVENTS.RESERVA_CREADA,
      recipientUserIds: [userId],
      createdByUserId: userId,

      // Si es partida abierta, no la damos por cerrada todavía.
      // Solo avisamos de que queda creada y esperando jugadores.
      title:
        reserva.tipo_reserva === "abierta"
          ? "Partida abierta creada"
          : "Reserva confirmada",

      body:
        reserva.tipo_reserva === "abierta"
          ? `Hola ${reserva.usuario_nombre || "jugador"}, tu partida abierta en la ${reserva.pista_nombre} ha quedado creada para el ${fechaBonita} a las ${horaInicio}. De momento está pendiente de completarse con 4 jugadores. Te avisaremos cuando la partida quede cerrada al 100%.`
          : `Hola ${reserva.usuario_nombre || "jugador"}, tu reserva en la ${reserva.pista_nombre} ha quedado confirmada para el ${fechaBonita} a las ${horaInicio}. ¡Nos vemos en pista!`,

      payload: {
        reserva_id: reserva.id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        duracion_min: reserva.duracion_min,
        tipo_reserva: reserva.tipo_reserva,
      },
    });
  } catch (e) {
    console.error("Error notificando reserva creada:", e);
  }
}

async function notifyReservaCancelada(reservaId, actorUserId) {
  try {
    const [rows] = await query(
      `SELECT
         r.id,
         r.usuario_id,
         r.fecha,
         r.hora_inicio,
         r.duracion_min,
         p.nombre AS pista_nombre,
         u.nombre AS usuario_nombre
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       LEFT JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.id = ?
       LIMIT 1`,
      [reservaId],
    );

    const reserva = rows[0];
    if (!reserva?.usuario_id) return;

    const fechaBonita = formatearFechaES(reserva.fecha);
    const horaInicio = formatearHora(reserva.hora_inicio);

    await notifyEvent({
      type: NOTIFICATION_EVENTS.RESERVA_CANCELADA,
      recipientUserIds: [reserva.usuario_id],
      createdByUserId: actorUserId,
      title: "Reserva cancelada",
      body: `Hola ${reserva.usuario_nombre || "jugador"}, tu reserva en la ${reserva.pista_nombre} ha sido cancelada. Estaba prevista para el ${fechaBonita} a las ${horaInicio}.`,
      payload: {
        reserva_id: reserva.id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        duracion_min: reserva.duracion_min,
      },
    });
  } catch (e) {
    console.error("Error notificando reserva cancelada:", e);
  }
}

// Notifica a los demás jugadores cuando alguien se une a una partida abierta
async function notifyPartidaAbiertaUnido(reservaId, joinedUserId) {
  try {
    // Buscamos los datos principales de la reserva y el nombre del jugador que se ha unido
    const [rows] = await query(
      `SELECT
         r.id,
         r.fecha,
         r.hora_inicio,
         r.duracion_min,
         r.tipo_reserva,
         p.nombre AS pista_nombre,
         u.nombre AS jugador_nombre
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       LEFT JOIN usuarios u ON u.id = ?
       WHERE r.id = ?
       LIMIT 1`,
      [joinedUserId, reservaId],
    );

    const reserva = rows[0];

    // Si no existe la reserva o no es partida abierta, no notificamos
    if (!reserva || reserva.tipo_reserva !== "abierta") return;

    // Buscamos los jugadores confirmados de la partida, excepto el que acaba de unirse
    const [recipientRows] = await query(
      `SELECT DISTINCT usuario_id
       FROM reservas_pista_participantes
       WHERE reserva_id = ?
         AND estado = 'confirmado'
         AND usuario_id IS NOT NULL
         AND usuario_id <> ?`,
      [reservaId, joinedUserId],
    );

    const recipientUserIds = recipientRows
      .map((row) => Number(row.usuario_id))
      .filter(Boolean);

    // Si no hay nadie más en la partida, no hay a quién avisar
    if (!recipientUserIds.length) return;

    const fechaBonita = formatearFechaES(reserva.fecha);
    const horaInicio = formatearHora(reserva.hora_inicio);
    const jugadorNombre = reserva.jugador_nombre || "Un jugador";

    // Enviamos notificación interna y WhatsApp según preferencias del usuario
    await notifyEvent({
      type: NOTIFICATION_EVENTS.PARTIDA_ABIERTA_UNIDO,
      recipientUserIds,
      createdByUserId: joinedUserId,
      title: "Nuevo jugador en tu partida",
      body: `${jugadorNombre} se ha unido a tu partida abierta en la ${reserva.pista_nombre} del ${fechaBonita} a las ${horaInicio}.`,
      payload: {
        reserva_id: reserva.id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        duracion_min: reserva.duracion_min,
        tipo_reserva: reserva.tipo_reserva,
        jugador_id: joinedUserId,
      },
    });
  } catch (e) {
    console.error("Error notificando jugador unido a partida abierta:", e);
  }
}

// Notifica a los jugadores restantes cuando alguien se sale de una partida abierta
async function notifyPartidaAbiertaSalida(reservaId, actorUserId) {
  try {
    // Buscamos los datos principales de la reserva y el nombre del jugador que se ha salido
    const [rows] = await query(
      `SELECT
         r.id,
         r.fecha,
         r.hora_inicio,
         r.duracion_min,
         r.tipo_reserva,
         p.nombre AS pista_nombre,
         u.nombre AS jugador_nombre
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       LEFT JOIN usuarios u ON u.id = ?
       WHERE r.id = ?
       LIMIT 1`,
      [actorUserId, reservaId],
    );

    const reserva = rows[0];

    // Si no existe la reserva o no es partida abierta, no notificamos
    if (!reserva || reserva.tipo_reserva !== "abierta") return;

    // Buscamos los jugadores que siguen confirmados, excepto el que se ha salido
    const [recipientRows] = await query(
      `SELECT DISTINCT usuario_id
       FROM reservas_pista_participantes
       WHERE reserva_id = ?
         AND estado = 'confirmado'
         AND usuario_id IS NOT NULL
         AND usuario_id <> ?`,
      [reservaId, actorUserId],
    );

    const recipientUserIds = recipientRows
      .map((row) => Number(row.usuario_id))
      .filter(Boolean);

    // Si no queda nadie en la partida, no hay a quién avisar
    if (!recipientUserIds.length) return;

    const fechaBonita = formatearFechaES(reserva.fecha);
    const horaInicio = formatearHora(reserva.hora_inicio);
    const jugadorNombre = reserva.jugador_nombre || "Un jugador";

    // Enviamos notificación interna y WhatsApp según preferencias del usuario
    await notifyEvent({
      type: NOTIFICATION_EVENTS.PARTIDA_ABIERTA_SALIDA,
      recipientUserIds,
      createdByUserId: actorUserId,
      title: "Jugador fuera de la partida",
      body: `${jugadorNombre} se ha salido de la partida abierta en la ${reserva.pista_nombre} del ${fechaBonita} a las ${horaInicio}.`,
      payload: {
        reserva_id: reserva.id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        duracion_min: reserva.duracion_min,
        tipo_reserva: reserva.tipo_reserva,
        jugador_id: actorUserId,
      },
    });
  } catch (e) {
    console.error("Error notificando jugador salido de partida abierta:", e);
  }
}

// Notifica a todos los jugadores cuando la partida abierta se completa
async function notifyPartidaAbiertaCompleta(reservaId, actorUserId) {
  try {
    // Buscamos los datos principales de la reserva
    const [rows] = await query(
      `SELECT
         r.id,
         r.fecha,
         r.hora_inicio,
         r.duracion_min,
         r.tipo_reserva,
         r.max_jugadores,
         p.nombre AS pista_nombre
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       WHERE r.id = ?
       LIMIT 1`,
      [reservaId],
    );

    const reserva = rows[0];

    // Si no existe o no es partida abierta, no hacemos nada
    if (!reserva || reserva.tipo_reserva !== "abierta") return;

    // Buscamos todos los jugadores confirmados de esa partida
    const [participantRows] = await query(
      `SELECT DISTINCT usuario_id
       FROM reservas_pista_participantes
       WHERE reserva_id = ?
         AND estado = 'confirmado'
         AND usuario_id IS NOT NULL`,
      [reservaId],
    );

    const recipientUserIds = participantRows
      .map((row) => Number(row.usuario_id))
      .filter(Boolean);

    const maxJugadores = Number(
      reserva.max_jugadores || OPEN_MATCH_MAX_PLAYERS,
    );

    // Solo avisamos si la partida está completa
    if (recipientUserIds.length < maxJugadores) return;

    const fechaBonita = formatearFechaES(reserva.fecha);
    const horaInicio = formatearHora(reserva.hora_inicio);

    // Enviamos notificación interna y WhatsApp a todos los jugadores
    await notifyEvent({
      type: NOTIFICATION_EVENTS.PARTIDA_ABIERTA_COMPLETA,
      recipientUserIds,
      createdByUserId: actorUserId,
      title: "Partida completa",
      body: `Tu partida abierta en la ${reserva.pista_nombre} del ${fechaBonita} a las ${horaInicio} ya está completa con ${maxJugadores} jugadores. La pista queda cerrada al 100%. ¡Nos vemos en pista!`,
      payload: {
        reserva_id: reserva.id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        duracion_min: reserva.duracion_min,
        tipo_reserva: reserva.tipo_reserva,
        max_jugadores: maxJugadores,
      },
    });
  } catch (e) {
    console.error("Error notificando partida abierta completa:", e);
  }
}

// GET /api/reservas?fecha=2026-03-30&pista_id=1
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { fecha, pista_id } = req.query;
    const reservaColumns = await getTableColumns("reservas_pista");
    const filters = [];
    const values = [];

    if (fecha) {
      filters.push("r.fecha = ?");
      values.push(fecha);
    }

    if (pista_id) {
      filters.push("r.pista_id = ?");
      values.push(pista_id);
    }

    filters.push("r.estado != 'cancelada'");
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await query(
      `SELECT
        r.id,
        ${selectColumn(reservaColumns, "r.alumno_id", "NULL", "alumno_id")},
        r.usuario_id,
        r.nombre_cliente,
        r.telefono_cliente,
        r.pista_id,
        p.nombre AS pista_nombre,
        r.fecha,
        r.hora_inicio,
        r.duracion_min,
        r.estado,
        ${selectColumn(reservaColumns, "r.tipo_reserva", "'completa'", "tipo_reserva")},
        ${selectColumn(
          reservaColumns,
          "r.max_jugadores",
          OPEN_MATCH_MAX_PLAYERS,
          "max_jugadores",
        )},
        ${selectColumn(reservaColumns, "r.nivel_min", "NULL", "nivel_min")},
        ${selectColumn(reservaColumns, "r.nivel_max", "NULL", "nivel_max")},
        r.notas,
        r.creado_en
       FROM reservas_pista r
       JOIN pistas p ON p.id = r.pista_id
       ${where}
       ORDER BY r.hora_inicio, r.pista_id`,
      values,
    );

    const participantsMap = await getParticipantsByReservation(
      rows.map((row) => row.id),
    );

    const userLevel = req.user ? await getUserGameLevel(req.user) : null;

    const reservas = rows.map((row) => {
      const participantes = participantsMap.get(row.id) || [];

      const userParticipant = req.user
        ? participantes.find(
            (item) => String(item.usuario_id) === String(req.user.id),
          )
        : null;

      const plazasOcupadas =
        row.tipo_reserva === "abierta"
          ? participantes.length
          : OPEN_MATCH_MAX_PLAYERS;

      const joinState = canJoinReservation(
        { ...row, plazas_ocupadas: plazasOcupadas },
        req.user,
        userLevel,
        userParticipant,
      );

      return {
        ...row,
        max_jugadores: Number(row.max_jugadores || OPEN_MATCH_MAX_PLAYERS),
        nivel_min: row.nivel_min === null ? null : Number(row.nivel_min),
        nivel_max: row.nivel_max === null ? null : Number(row.nivel_max),
        plazas_ocupadas: plazasOcupadas,
        participantes,
        ...joinState,
      };
    });

    res.json({ ok: true, reservas });
  } catch (e) {
    console.error("Error GET /api/reservas:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// GET /api/reservas/pistas
router.get("/pistas", async (_req, res) => {
  try {
    const [rows] = await query(
      "SELECT id, nombre FROM pistas WHERE activa = 1 ORDER BY id",
    );
    res.json({ ok: true, pistas: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// POST /api/reservas
// Crea reserva completa o partida abierta
router.post("/", requireAuth, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    const reservaColumns = await getTableColumns("reservas_pista");
    const tipoReserva =
      req.body.tipo_reserva === "abierta" ? "abierta" : "completa";

    // Invitados/amigos que trae el usuario al crear una partida abierta.
    // Cada invitado ocupará una plaza más en la partida.
    const invitadosPartida =
      tipoReserva === "abierta" ? normalizarInvitados(req.body) : [];

    const {
      nombre_cliente,
      telefono_cliente,
      pista_id,
      fecha,
      hora_inicio,
      duracion_min,
      notas,
    } = req.body;

    if (!pista_id || !fecha || !hora_inicio) {
      return res.status(400).json({
        ok: false,
        message: "Faltan campos obligatorios (pista_id, fecha, hora_inicio)",
      });
    }

    if (
      tipoReserva === "abierta" &&
      (!(await tableExists("reservas_pista_participantes")) ||
        !reservaColumns.has("tipo_reserva"))
    ) {
      return res.status(400).json({
        ok: false,
        message: "Falta aplicar la migracion de partidas abiertas en MySQL.",
      });
    }

    const nivelMin = normalizeLevel(req.body.nivel_min);
    const nivelMax = normalizeLevel(req.body.nivel_max);

    if (tipoReserva === "abierta") {
      if (nivelMin === null || nivelMax === null || nivelMin > nivelMax) {
        return res.status(400).json({
          ok: false,
          message: "Selecciona un rango de nivel valido.",
        });
      }

      const userLevel = await getUserGameLevel(req.user);

      if (userLevel === null) {
        return res.status(400).json({
          ok: false,
          message:
            "Configura tu nivel de juego antes de crear una partida abierta.",
        });
      }

      if (userLevel < nivelMin || userLevel > nivelMax) {
        return res.status(400).json({
          ok: false,
          message: "Tu nivel debe estar dentro del rango de la partida.",
        });
      }

      // El creador ocupa 1 plaza.
      // Sus invitados ocupan plazas adicionales.
      const plazasIniciales = 1 + invitadosPartida.length;

      if (plazasIniciales > OPEN_MATCH_MAX_PLAYERS) {
        return res.status(400).json({
          ok: false,
          message: `Una partida abierta solo puede tener ${OPEN_MATCH_MAX_PLAYERS} jugadores.`,
        });
      }
    }

    await connection.beginTransaction();

    // Bloquea el hueco de pista para evitar reservas simultáneas
    const [existing] = await connection.query(
      `SELECT id FROM reservas_pista
       WHERE pista_id = ? AND fecha = ? AND hora_inicio = ? AND estado != 'cancelada'
       FOR UPDATE`,
      [pista_id, fecha, hora_inicio],
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: "Esa pista ya esta reservada en esa fecha y hora",
      });
    }

    const [userReservas] = await connection.query(
      `SELECT id FROM reservas_pista
       WHERE usuario_id = ? AND fecha = ? AND estado != 'cancelada'
       FOR UPDATE`,
      [req.user.id, fecha],
    );

    if (userReservas.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message:
          "Ya tienes una reserva para este dia. Solo se permite una reserva por dia.",
      });
    }

    const payload = {
      alumno_id: null,
      usuario_id: req.user.id,
      nombre_cliente: nombre_cliente || req.user.nombre,
      telefono_cliente: telefono_cliente || null,
      pista_id,
      fecha,
      hora_inicio,
      duracion_min: duracion_min || 90,
      tipo_reserva: tipoReserva,
      max_jugadores: OPEN_MATCH_MAX_PLAYERS,
      nivel_min: tipoReserva === "abierta" ? nivelMin : null,
      nivel_max: tipoReserva === "abierta" ? nivelMax : null,
      // Si crea una partida abierta ya completa con invitados,
      // la dejamos directamente confirmada.
      estado:
        tipoReserva === "abierta"
          ? 1 + invitadosPartida.length >= OPEN_MATCH_MAX_PLAYERS
            ? "confirmada"
            : "abierta"
          : "confirmada",
      notas: notas || null,
    };

    const fields = Object.keys(payload).filter((field) =>
      reservaColumns.has(field),
    );

    const [result] = await connection.query(
      `INSERT INTO reservas_pista (${fields.join(", ")}) VALUES (${fields
        .map(() => "?")
        .join(", ")})`,
      fields.map((field) => payload[field]),
    );

    if (tipoReserva === "abierta") {
      const alumno = await getAlumnoForUser(req.user.id);

      // Insertamos al creador como primer participante de la partida abierta
      await connection.query(
        `INSERT INTO reservas_pista_participantes
      (reserva_id, usuario_id, alumno_id, tipo_participante, nombre_invitado, invitado_de_usuario_id, estado, es_creador)
     VALUES (?, ?, ?, 'usuario', NULL, NULL, 'confirmado', 1)`,
        [result.insertId, req.user.id, alumno?.id || null],
      );

      // Insertamos los invitados/amigos del creador, si ha añadido alguno
      await insertarInvitadosPartida(
        connection,
        result.insertId,
        req.user.id,
        invitadosPartida,
      );
    }

    await connection.commit();

    // Si la partida abierta se crea ya completa con invitados,
    // mandamos directamente el aviso de partida completa.
    // Si no está completa, mandamos el aviso normal de partida pendiente.
    if (
      tipoReserva === "abierta" &&
      1 + invitadosPartida.length >= OPEN_MATCH_MAX_PLAYERS
    ) {
      await notifyPartidaAbiertaCompleta(result.insertId, req.user.id);
    } else {
      await notifyReservaCreada(result.insertId, req.user.id);
    }

    res.status(201).json({
      ok: true,
      id: result.insertId,
      message:
        tipoReserva === "abierta"
          ? "Partida abierta creada correctamente"
          : "Reserva creada correctamente",
    });
  } catch (e) {
    await connection.rollback();
    console.error("Error POST /api/reservas:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

// POST /api/reservas/:id/unirse
router.post("/:id/unirse", requireAuth, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, tipo_reserva, estado, max_jugadores, nivel_min, nivel_max
       FROM reservas_pista
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ ok: false, message: "Reserva no encontrada" });
    }

    const reserva = rows[0];

    if (reserva.tipo_reserva !== "abierta" || reserva.estado === "cancelada") {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: "No puedes unirte a esta reserva",
      });
    }

    const userLevel = await getUserGameLevel(req.user);

    if (userLevel === null) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "Configura tu nivel de juego antes de unirte a partidas abiertas.",
      });
    }

    if (
      (reserva.nivel_min !== null && userLevel < Number(reserva.nivel_min)) ||
      (reserva.nivel_max !== null && userLevel > Number(reserva.nivel_max))
    ) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Tu nivel no coincide con esta partida.",
      });
    }

    const [already] = await connection.query(
      `SELECT id FROM reservas_pista_participantes
       WHERE reserva_id = ? AND usuario_id = ? AND estado = 'confirmado'
       LIMIT 1`,
      [req.params.id, req.user.id],
    );

    if (already.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: "Ya estas en esta partida.",
      });
    }

    // Invitados/amigos que trae el usuario al unirse.
    // Cada invitado ocupará una plaza adicional.
    const invitadosUnion = normalizarInvitados(req.body);

    // El usuario ocupa 1 plaza + sus invitados ocupan plazas extra
    const plazasSolicitadas = 1 + invitadosUnion.length;

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total
   FROM reservas_pista_participantes
   WHERE reserva_id = ? AND estado = 'confirmado'`,
      [req.params.id],
    );

    const plazasOcupadasActuales = Number(countRows[0]?.total || 0);
    const maxJugadores = Number(
      reserva.max_jugadores || OPEN_MATCH_MAX_PLAYERS,
    );

    // Comprobamos si caben el usuario y sus invitados
    if (plazasOcupadasActuales + plazasSolicitadas > maxJugadores) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: `No hay plazas suficientes. Quedan ${
          maxJugadores - plazasOcupadasActuales
        } plaza(s) libres.`,
      });
    }

    const alumno = await getAlumnoForUser(req.user.id);

    // Insertamos al usuario que se une como participante registrado
    await connection.query(
      `INSERT INTO reservas_pista_participantes
    (reserva_id, usuario_id, alumno_id, tipo_participante, nombre_invitado, invitado_de_usuario_id, estado, es_creador)
   VALUES (?, ?, ?, 'usuario', NULL, NULL, 'confirmado', 0)
   ON DUPLICATE KEY UPDATE
    estado = 'confirmado',
    alumno_id = VALUES(alumno_id),
    tipo_participante = 'usuario',
    nombre_invitado = NULL,
    invitado_de_usuario_id = NULL`,
      [req.params.id, req.user.id, alumno?.id || null],
    );

    // Insertamos los invitados/amigos del usuario, si trae alguno
    await insertarInvitadosPartida(
      connection,
      req.params.id,
      req.user.id,
      invitadosUnion,
    );

    const total = await updateOpenReservationState(connection, req.params.id);
    await connection.commit();

    if (total >= maxJugadores) {
      await notifyPartidaAbiertaCompleta(req.params.id, req.user.id);
    } else {
      await notifyPartidaAbiertaUnido(req.params.id, req.user.id);
    }

    // Si la partida ya está completa, avisamos a todos de que queda cerrada al 100%.
    if (total >= maxJugadores) {
      await notifyPartidaAbiertaCompleta(req.params.id, req.user.id);
    } else {
      // Si todavía faltan jugadores, solo avisamos a los demás de que alguien se ha unido.
      await notifyPartidaAbiertaUnido(req.params.id, req.user.id);
    }

    res.json({
      ok: true,
      plazas_ocupadas: total,
      message:
        total >= maxJugadores
          ? "Te has unido a la partida. La partida ya está completa."
          : "Te has unido a la partida",
    });
  } catch (e) {
    await connection.rollback();
    console.error("Error POST /api/reservas/:id/unirse:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/reservas/:id/participantes/me
router.delete("/:id/participantes/me", requireAuth, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, tipo_reserva, estado FROM reservas_pista WHERE id = ? FOR UPDATE",
      [req.params.id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ ok: false, message: "Reserva no encontrada" });
    }

    if (rows[0].tipo_reserva !== "abierta") {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: "Solo puedes salirte de partidas abiertas.",
      });
    }

    // Primero comprobamos que el usuario registrado está dentro de la partida
const [participantRows] = await connection.query(
  `SELECT id
   FROM reservas_pista_participantes
   WHERE reserva_id = ?
     AND usuario_id = ?
     AND tipo_participante = 'usuario'
     AND estado = 'confirmado'
   LIMIT 1`,
  [req.params.id, req.user.id]
);

if (participantRows.length === 0) {
  await connection.rollback();
  return res.status(404).json({
    ok: false,
    message: "No estas apuntado a esta partida.",
  });
}

// Cancelamos al usuario registrado
await connection.query(
  `UPDATE reservas_pista_participantes
   SET estado = 'cancelado'
   WHERE reserva_id = ?
     AND usuario_id = ?
     AND tipo_participante = 'usuario'
     AND estado = 'confirmado'`,
  [req.params.id, req.user.id]
);

// Cancelamos también sus invitados/amigos
// Como no tienen cuenta propia, dependen del usuario que los añadió
const [guestResult] = await connection.query(
  `UPDATE reservas_pista_participantes
   SET estado = 'cancelado'
   WHERE reserva_id = ?
     AND invitado_de_usuario_id = ?
     AND tipo_participante = 'invitado'
     AND estado = 'confirmado'`,
  [req.params.id, req.user.id]
);

// Recalculamos el estado de la partida después de quitar usuario + invitados
const total = await updateOpenReservationState(connection, req.params.id);
await connection.commit();

// Avisamos a los jugadores restantes de que alguien se ha salido.
// Si no queda nadie, la función no enviará nada.
await notifyPartidaAbiertaSalida(req.params.id, req.user.id);

res.json({
  ok: true,
  plazas_ocupadas: total,
  invitados_cancelados: guestResult.affectedRows,
  message:
    guestResult.affectedRows > 0
      ? `Has salido de la partida junto con ${guestResult.affectedRows} invitado(s).`
      : "Has salido de la partida",
});

    // Avisamos a los jugadores restantes de que alguien se ha salido.
    // Si no queda nadie, la función no enviará nada.
    await notifyPartidaAbiertaSalida(req.params.id, req.user.id);

    res.json({
      ok: true,
      plazas_ocupadas: total,
      message: "Has salido de la partida",
    });
  } catch (e) {
    await connection.rollback();
    console.error("Error DELETE /api/reservas/:id/participantes/me:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    connection.release();
  }
});

// PATCH /api/reservas/:id/cancelar
// Solo el dueño o admin puede cancelar
router.patch("/:id/cancelar", requireAuth, async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT id, usuario_id FROM reservas_pista WHERE id = ? AND estado != 'cancelada'",
      [req.params.id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ ok: false, message: "Reserva no encontrada" });
    }

    const reserva = rows[0];

    if (reserva.usuario_id !== req.user.id && req.user.rol !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "No puedes cancelar esta reserva",
      });
    }

    await query("UPDATE reservas_pista SET estado = 'cancelada' WHERE id = ?", [
      req.params.id,
    ]);

    await notifyReservaCancelada(req.params.id, req.user.id);

    res.json({ ok: true, message: "Reserva cancelada" });
  } catch (e) {
    console.error("Error PATCH /api/reservas/:id/cancelar:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
