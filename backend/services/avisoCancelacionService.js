// Aviso por WhatsApp a las familias cuando se cancela una clase.
//
// Todo está APAGADO por defecto. Solo se envía si:
//   - WHATSAPP_AVISOS_CLASES=true
//   - existen WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID (WhatsApp conectado a Meta)
//   - el profe lo pide en esa cancelación (casilla "Avisar a las familias por WhatsApp")
// Modo prueba: con WHATSAPP_AVISOS_SOLO_A (teléfonos separados por comas) solo se envía a esos
// números aunque el grupo tenga más. Con WHATSAPP_AVISOS_MODO_PRUEBA=true y la lista vacía no se
// envía a nadie. Detalles y plantilla de Meta en backend/WHATSAPP.md.
import { normalizePhoneNumber, sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from "./whatsappService.js";

export const AVISOS_DESACTIVADOS = "Avisos por WhatsApp desactivados";
const PAUSA_ENTRE_ENVIOS_MS = 250;
const ESPERA_MAX_RESPUESTA_MS = 15000;
const MOTIVO_OTRO_MAX = 80;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const verdadero = (valor) => String(valor ?? "").trim().toLowerCase() === "true";

// Lee la configuración en cada llamada (no al importar) para que los tests la vean siempre al día.
export function leerConfigAvisos(env = process.env) {
  const interruptor = verdadero(env.WHATSAPP_AVISOS_CLASES);
  const conectado = Boolean(String(env.WHATSAPP_TOKEN || "").trim() && String(env.WHATSAPP_PHONE_NUMBER_ID || "").trim());
  const soloA = new Set(
    String(env.WHATSAPP_AVISOS_SOLO_A || "")
      .split(",")
      .map((telefono) => normalizePhoneNumber(telefono))
      .filter(Boolean)
  );
  const listaDefinida = String(env.WHATSAPP_AVISOS_SOLO_A || "").trim() !== "";
  // Con la lista definida siempre hay restricción; con el modo prueba y lista vacía no se envía a nadie.
  const modoPrueba = verdadero(env.WHATSAPP_AVISOS_MODO_PRUEBA) || listaDefinida;
  let activo = true;
  let motivoInactivo = null;
  if (!interruptor) { activo = false; motivoInactivo = "interruptor_apagado"; }
  else if (!conectado) { activo = false; motivoInactivo = "sin_claves_meta"; }
  return { activo, motivoInactivo, modoPrueba, soloA, mensaje: activo ? null : AVISOS_DESACTIVADOS };
}

// +34622040926 -> +34•••••926: para logs sin datos personales completos.
export function enmascararTelefono(telefono) {
  const texto = String(telefono ?? "");
  if (texto.length <= 4) return "•••";
  return `${texto.slice(0, 3)}${"•".repeat(Math.max(texto.length - 6, 3))}${texto.slice(-3)}`;
}

export function nombresEnLista(nombres) {
  const lista = nombres.filter(Boolean);
  if (lista.length <= 1) return lista[0] || "";
  return `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}`;
}

const limpiarVariable = (texto) => String(texto ?? "").replace(/\s+/g, " ").trim();

export function motivoEnPalabras(cancelacion, recuperable = true) {
  const clave = cancelacion?.motivo;
  let base = "por motivos de organización de la escuela";
  if (clave === "lluvia") base = "por la lluvia";
  else if (clave === "profesor") base = "el profesor no puede dar la clase";
  else if (clave === "pista") base = "la pista no está disponible";
  else if (clave === "otro" && cancelacion?.texto) base = limpiarVariable(cancelacion.texto).slice(0, MOTIVO_OTRO_MAX);
  return recuperable ? `${base}. Se podrá recuperar y la escuela os dirá cuándo` : base;
}

export function fechaEnPalabras(fecha) {
  const date = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(fecha);
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date).replace(",", "");
}

const horaCorta = (hora) => String(hora || "").slice(0, 5);

// Variables de la plantilla `clase_cancelada` (4, en este orden; son las mismas que ya usa
// notificationService, así que una sola plantilla en Meta sirve para las dos rutas):
//   {{1}} alumno(s) y grupo      "Ana y Beto (grupo Adultos avanzado)"
//   {{2}} día                    "jueves 5 de noviembre"
//   {{3}} hora                   "19:30"
//   {{4}} motivo en palabras     "por la lluvia. Se podrá recuperar y la escuela os dirá cuándo"
export function variablesPlantilla({ nombres, grupo, fecha, cancelacion, recuperable }) {
  const grupoNombre = limpiarVariable(grupo?.nombre);
  return [
    `${nombresEnLista(nombres)}${grupoNombre ? ` (grupo ${grupoNombre})` : ""}`,
    fechaEnPalabras(fecha),
    horaCorta(grupo?.hora_inicio),
    motivoEnPalabras(cancelacion, recuperable),
  ].map(limpiarVariable);
}

async function columnaConsentimiento(query) {
  try {
    const [rows] = await query("SHOW COLUMNS FROM alumnos LIKE 'acepta_whatsapp'");
    return rows.length > 0;
  } catch {
    return false;
  }
}

// Agrupa por teléfono: tutor si existe, si no el del alumno. Sin duplicados; un tutor con dos
// hijos recibe un solo aviso con ambos nombres. Si existe la columna alumnos.acepta_whatsapp
// (migración opcional), solo se avisa a quien tenga 1. Solo lectura.
export async function calcularDestinatarios({ query, alumnos = [], config = leerConfigAvisos() }) {
  const resultado = { familias: [], sinTelefono: [], omitidos: 0, totalFamilias: 0 };
  const ids = alumnos.map((alumno) => alumno.id).filter((id) => id !== undefined && id !== null);
  if (!ids.length) return resultado;

  const consentimiento = await columnaConsentimiento(query);
  const [filas] = await query(
    `SELECT id, nombre, telefono, tutor_telefono${consentimiento ? ", acepta_whatsapp" : ""} FROM alumnos WHERE id IN (?)`,
    [ids]
  );
  const porTelefono = new Map();
  const telefonosAntesDeFiltrar = new Set();
  for (const fila of filas) {
    const tutor = String(fila.tutor_telefono ?? "").trim();
    const bruto = tutor || String(fila.telefono ?? "").trim();
    const telefono = bruto ? normalizePhoneNumber(bruto) : null;
    const nombre = String(fila.nombre ?? "").trim();
    if (!telefono) {
      resultado.sinTelefono.push({ id: fila.id, nombre, motivo: bruto ? "invalido" : "falta" });
      continue;
    }
    telefonosAntesDeFiltrar.add(telefono);
    if (consentimiento && Number(fila.acepta_whatsapp) !== 1) continue;
    if (!porTelefono.has(telefono)) porTelefono.set(telefono, []);
    porTelefono.get(telefono).push({ id: fila.id, nombre });
  }
  let familias = [...porTelefono].map(([telefono, hijos]) => ({ telefono, alumnos: hijos }));
  if (config.modoPrueba) familias = familias.filter((familia) => config.soloA.has(familia.telefono));
  resultado.familias = familias;
  resultado.omitidos = telefonosAntesDeFiltrar.size - familias.length;
  resultado.totalFamilias = familias.length;
  return resultado;
}

// Estado para la casilla del profe: si los avisos están activos y a cuántas familias llegarían.
// Con los avisos apagados no toca la base de datos.
export async function estadoAvisos({ query, alumnos = [], env = process.env }) {
  const config = leerConfigAvisos(env);
  if (!config.activo) {
    return { activo: false, motivo: config.motivoInactivo, mensaje: AVISOS_DESACTIVADOS, modo_prueba: config.modoPrueba, destinatarios: 0, sin_telefono: 0 };
  }
  const calculo = await calcularDestinatarios({ query, alumnos, config });
  return {
    activo: true,
    motivo: null,
    mensaje: null,
    modo_prueba: config.modoPrueba,
    destinatarios: calculo.totalFamilias,
    sin_telefono: calculo.sinTelefono.length,
  };
}

// Registro del envío en la bandeja (whatsapp_conversations / whatsapp_messages) solo si ya existen
// las tablas. El contenido no lleva nombres de alumnos. Nunca lanza: un fallo aquí no afecta al aviso.
async function registrarEnvio({ query, telefono, resultado, resumen, error }) {
  try {
    const [tablaConversaciones] = await query("SHOW TABLES LIKE 'whatsapp_conversations'");
    const [tablaMensajes] = await query("SHOW TABLES LIKE 'whatsapp_messages'");
    if (!tablaConversaciones.length || !tablaMensajes.length) return false;
    const waId = String(resultado?.to || telefono).replace(/^\+/, "");
    // 'cerrada' para no llenar la bandeja de pendientes; si la familia responde, el webhook la reabre.
    await query(
      `INSERT INTO whatsapp_conversations (wa_id, telefono, estado, ultimo_mensaje, ultimo_mensaje_en)
       VALUES (?, ?, 'cerrada', ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE ultimo_mensaje = VALUES(ultimo_mensaje), ultimo_mensaje_en = VALUES(ultimo_mensaje_en)`,
      [waId, telefono, resumen]
    );
    const [conversaciones] = await query("SELECT id FROM whatsapp_conversations WHERE wa_id = ? LIMIT 1", [waId]);
    if (!conversaciones[0]) return false;
    await query(
      `INSERT INTO whatsapp_messages (conversation_id, meta_message_id, direccion, tipo, contenido, estado, error_message, raw_payload)
       VALUES (?, ?, 'outbound', 'template', ?, ?, ?, ?)`,
      [conversaciones[0].id, resultado?.messageId || null, resumen, error ? "error" : "enviado", error ? String(error).slice(0, 300) : null,
        JSON.stringify({ plantilla: WHATSAPP_TEMPLATES.CLASE_CANCELADA, aviso_clases: true })]
    );
    return true;
  } catch (fallo) {
    console.warn("Aviso de clase: no se pudo guardar el registro en la bandeja:", fallo.message);
    return false;
  }
}

function mensajeResumen({ enviados, fallidos, sinTelefono, omitidos, estado }) {
  if (estado === "sin_destinatarios") {
    return sinTelefono ? `Ninguna familia con teléfono válido: avisa a ${sinTelefono} por otro medio.` : "No hay familias a las que avisar.";
  }
  const partes = [];
  if (enviados) partes.push(enviados === 1 ? "Avisada 1 familia" : `Avisadas ${enviados} familias`);
  if (fallidos) partes.push(`no se pudo avisar a ${fallidos}`);
  if (sinTelefono) partes.push(`${sinTelefono} sin teléfono válido`);
  if (omitidos) partes.push(`${omitidos} omitidas`);
  const texto = partes.join("; ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

async function enviarAFamilias({ query, familias, sinTelefono, omitidos, grupo, fecha, cancelacion, recuperable, enviar, pausaMs }) {
  const resultado = { enviados: 0, fallidos: 0, sinTelefono: sinTelefono.length, omitidos, nombresSinAvisar: sinTelefono.map((item) => item.nombre) };
  const resumen = `Aviso de clase cancelada: grupo ${limpiarVariable(grupo?.nombre)}, ${fechaEnPalabras(fecha)}`;
  for (let i = 0; i < familias.length; i += 1) {
    const familia = familias[i];
    if (i > 0 && pausaMs > 0) await esperar(pausaMs);
    try {
      const respuesta = await enviar({
        to: familia.telefono,
        templateName: WHATSAPP_TEMPLATES.CLASE_CANCELADA,
        languageCode: "es",
        variables: variablesPlantilla({ nombres: familia.alumnos.map((a) => a.nombre), grupo, fecha, cancelacion, recuperable }),
      });
      resultado.enviados += 1;
      await registrarEnvio({ query, telefono: familia.telefono, resultado: respuesta, resumen });
    } catch (error) {
      resultado.fallidos += 1;
      resultado.nombresSinAvisar.push(...familia.alumnos.map((a) => a.nombre));
      console.warn(`Aviso de clase: fallo al enviar a ${enmascararTelefono(familia.telefono)}: ${error.message}`);
      await registrarEnvio({ query, telefono: familia.telefono, resultado: null, resumen, error: error.message });
    }
  }
  return resultado;
}

function estadoFinal(resultado, totalFamilias) {
  if (!totalFamilias) return "sin_destinatarios";
  if (!resultado.fallidos) return "enviado";
  return resultado.enviados ? "parcial" : "error";
}

// Envía el aviso de una clase cancelada. NUNCA lanza: siempre devuelve un objeto con `estado`:
// desactivado | sin_destinatarios | enviado | parcial | error | en_curso.
// Si el envío tarda más de esperaMaxMs, devuelve `en_curso` y termina en segundo plano.
export async function avisarCancelacion({
  query, grupo, fecha, alumnos = [], cancelacion, recuperable = true,
  env = process.env, enviar = sendWhatsAppTemplate, pausaMs = PAUSA_ENTRE_ENVIOS_MS, esperaMaxMs = ESPERA_MAX_RESPUESTA_MS,
}) {
  const base = { enviados: 0, fallidos: 0, sinTelefono: 0, omitidos: 0, nombresSinAvisar: [] };
  try {
    const config = leerConfigAvisos(env);
    if (!config.activo) return { ...base, estado: "desactivado", mensaje: AVISOS_DESACTIVADOS };
    const calculo = await calcularDestinatarios({ query, alumnos, config });
    const total = calculo.familias.length;
    if (!total) {
      const parcial = { ...base, sinTelefono: calculo.sinTelefono.length, omitidos: calculo.omitidos, nombresSinAvisar: calculo.sinTelefono.map((i) => i.nombre) };
      return { ...parcial, estado: "sin_destinatarios", mensaje: mensajeResumen({ ...parcial, estado: "sin_destinatarios" }) };
    }
    const envio = enviarAFamilias({
      query, familias: calculo.familias, sinTelefono: calculo.sinTelefono, omitidos: calculo.omitidos,
      grupo, fecha, cancelacion, recuperable, enviar, pausaMs,
    }).then((resultado) => {
      const estado = estadoFinal(resultado, total);
      return { ...resultado, estado, mensaje: mensajeResumen({ ...resultado, estado }) };
    });
    let temporizador;
    const limite = new Promise((resolve) => {
      temporizador = setTimeout(() => resolve(null), esperaMaxMs);
      temporizador.unref?.();
    });
    const primero = await Promise.race([envio, limite]);
    clearTimeout(temporizador);
    if (primero) return primero;
    envio
      .then((final) => console.info(`Aviso de clase terminado: ${final.enviados} enviados, ${final.fallidos} fallidos`))
      .catch((fallo) => console.warn("Aviso de clase: fallo en segundo plano:", fallo.message));
    return { ...base, estado: "en_curso", total, mensaje: `Enviando el aviso a ${total} familias: puede tardar un poco.` };
  } catch (error) {
    console.warn("Aviso de clase: error inesperado:", error.message);
    return { ...base, estado: "error", mensaje: "No se pudo enviar el aviso a las familias: avísalas por otro medio." };
  }
}
