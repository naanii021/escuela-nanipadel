// Utilidades del panel de profesor: niveles, fechas, nombres y teléfonos.
// Todo es de solo lectura: normaliza lo que viene de la BD sin reescribirlo.

export const DIAS_SEMANA = [
  { key: "L", label: "Lunes", corto: "Lun" },
  { key: "M", label: "Martes", corto: "Mar" },
  { key: "X", label: "Miércoles", corto: "Mié" },
  { key: "J", label: "Jueves", corto: "Jue" },
  { key: "V", label: "Viernes", corto: "Vie" },
  { key: "S", label: "Sábado", corto: "Sáb" },
  { key: "D", label: "Domingo", corto: "Dom" },
];
const DIA_POR_INDICE = ["D", "L", "M", "X", "J", "V", "S"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ---------- Niveles ----------
// La BD guarda niveles escritos a mano ("Competición", "IniciaciónPlus", "No lo se.")
// y el código antiguo esperaba claves ("competicion"). Se comparan siempre por su clave.
export const NIVELES = [
  { key: "ninos", label: "Niños" },
  { key: "iniciacion", label: "Iniciación" },
  { key: "iniciacion_plus", label: "Iniciación plus" },
  { key: "avanzado", label: "Avanzado" },
  { key: "avanzado_plus", label: "Avanzado plus" },
  { key: "competicion", label: "Competición" },
];
const NIVEL_LABEL = Object.fromEntries(NIVELES.map((item) => [item.key, item.label]));

export function sinAcentos(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function nivelKey(raw) {
  const plano = sinAcentos(raw).replace(/\+/g, "plus").replace(/[^a-z]/g, "");
  if (!plano) return "";
  if (/^nin(o|a)s?$/.test(plano)) return "ninos";
  if (plano === "iniciacion") return "iniciacion";
  if (plano === "iniciacionplus") return "iniciacion_plus";
  if (plano === "avanzado") return "avanzado";
  if (plano === "avanzadoplus") return "avanzado_plus";
  if (plano === "competicion") return "competicion";
  return "otro";
}

export function nivelLabel(raw) {
  const key = nivelKey(raw);
  if (!key) return "Sin nivel";
  if (key === "otro") {
    const texto = String(raw).trim().replace(/\.$/, "");
    return sinAcentos(texto) === "no lo se" ? "No lo sabe" : texto;
  }
  return NIVEL_LABEL[key];
}

export function nivelClass(raw) {
  return `ppLevel ppLevel-${nivelKey(raw) || "none"}`;
}

// Opciones de nivel para formularios. El valor es la forma en que la BD ya lo escribe,
// para no mezclar "Competición" y "competicion". Si el valor actual no encaja, se añade.
export function opcionesNivel(items = [], actual = "") {
  const usados = new Map();
  items.forEach((item) => {
    const key = nivelKey(item?.nivel);
    if (!key || key === "otro" || !item.nivel) return;
    const cuenta = usados.get(key) || new Map();
    cuenta.set(item.nivel, (cuenta.get(item.nivel) || 0) + 1);
    usados.set(key, cuenta);
  });
  const opciones = NIVELES.map(({ key, label }) => {
    const cuenta = usados.get(key);
    const valor = cuenta ? [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0] : label;
    return { value: valor, label };
  });
  if (actual && !opciones.some((item) => item.value === actual)) {
    opciones.unshift({ value: actual, label: `${nivelLabel(actual)} (el que tiene ahora)` });
  }
  return [{ value: "", label: "Sin nivel" }, ...opciones];
}

// ---------- Nombres y contacto ----------
// Muchos grupos llevan la hora en el nombre ("Adultos avanzado · 19:30"); donde ya se muestra la hora, se quita.
export function nombreGrupo(grupo) {
  return String(grupo?.nombre || "").replace(/\s*·\s*\d{1,2}:\d{2}\s*$/, "");
}

export function nombreCompleto(persona) {
  return [persona?.nombre, persona?.apellidos].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ") || "Sin nombre";
}

export function iniciales(persona) {
  const partes = nombreCompleto(persona).split(/\s+/);
  return `${partes[0]?.charAt(0) || "A"}${partes[1]?.charAt(0) || ""}`.toUpperCase();
}

function digitos(telefono) {
  return String(telefono || "").replace(/[^\d+]/g, "");
}

export function telHref(telefono) {
  const limpio = digitos(telefono);
  return limpio.replace(/\D/g, "").length >= 6 ? `tel:${limpio}` : "";
}

export function whatsappHref(telefono) {
  let numero = digitos(telefono).replace(/^\+/, "").replace(/^00/, "");
  if (numero.replace(/\D/g, "").length < 9) return "";
  if (/^[67]\d{8}$/.test(numero)) numero = `34${numero}`;
  return `https://wa.me/${numero}`;
}

// ---------- Fechas y horas ----------
export function fechaISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function hoyISO() {
  return fechaISO(new Date());
}

export function diaDeFecha(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
  return DIA_POR_INDICE[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export function diaHoy() {
  return DIA_POR_INDICE[new Date().getDay()];
}

export function nombreDia(code) {
  return DIAS_SEMANA.find((item) => item.key === code)?.label || code || "";
}

export function formatDias(d1, d2) {
  const nombres = [d1, d2].filter(Boolean).map(nombreDia);
  if (!nombres.length) return "Sin días";
  return nombres.map((nombre, index) => (index ? nombre.toLowerCase() : nombre)).join(" y ");
}

// "2026-11-03" -> "martes 3 nov"
export function formatFecha(iso, { conDia = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ""))) return iso || "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dia = nombreDia(DIA_POR_INDICE[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]).toLowerCase();
  const texto = `${d} ${MESES[m - 1]}`;
  const anio = y !== new Date().getFullYear() ? ` ${y}` : "";
  return conDia ? `${dia} ${texto}${anio}` : `${texto}${anio}`;
}

export function hora(value) {
  const texto = String(value || "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(texto) ? texto : "";
}

export function minutosDe(value) {
  const [h, m] = String(value || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
}

export function formatHorario(horaInicio, duracion) {
  const inicio = minutosDe(horaInicio);
  if (inicio === null) return "Sin hora";
  const fin = inicio + Number(duracion || 60);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(inicio / 60) % 24)}:${pad(inicio % 60)} a ${pad(Math.floor(fin / 60) % 24)}:${pad(fin % 60)}`;
}

// El resumen de alumnos trae "M J 19:30:00" (o varios separados por coma).
export function formatHorariosTexto(texto) {
  const bloques = String(texto || "").split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  if (!bloques.length) return "";
  return bloques.map((bloque) => {
    const partes = bloque.split(/\s+/);
    const horaTexto = hora(partes.find((parte) => /^\d{1,2}:\d{2}/.test(parte)));
    const dias = partes.filter((parte) => /^[LMXJVSD]$/.test(parte));
    const diasTexto = dias.length ? formatDias(dias[0], dias[1]) : "";
    return [diasTexto, horaTexto].filter(Boolean).join(", ") || bloque;
  }).join(" · ");
}

export function nombrePista(value) {
  const raw = String(value || "").trim();
  const plano = raw.toLowerCase();
  if (plano === "1" || /^pista\s*1$/.test(plano)) return "Pista 1";
  if (plano === "2" || /^pista\s*2$/.test(plano)) return "Pista 2";
  return raw || "Sin pista";
}

// Fecha más reciente (hoy o antes) que cae en ese día de la semana.
export function ultimaFechaDelDia(code, base = new Date()) {
  const objetivo = DIA_POR_INDICE.indexOf(code);
  if (objetivo < 0) return fechaISO(base);
  const fecha = new Date(base);
  const diff = (fecha.getDay() - objetivo + 7) % 7;
  fecha.setDate(fecha.getDate() - diff);
  return fechaISO(fecha);
}

export function diasDelGrupo(grupo) {
  return [grupo?.dia1, grupo?.dia2].filter(Boolean);
}

export function grupoActivo(grupo) {
  return Number(grupo?.activo ?? 1) === 1;
}

// Momento de la clase respecto a ahora: "ahora", "despues" o "pasada".
export function momentoClase(grupo, ahora = new Date()) {
  const inicio = minutosDe(grupo?.hora_inicio);
  if (inicio === null) return "despues";
  const fin = inicio + Number(grupo?.duracion_min || 60);
  const actual = ahora.getHours() * 60 + ahora.getMinutes();
  if (actual >= inicio - 10 && actual < fin) return "ahora";
  return actual < inicio ? "despues" : "pasada";
}

// Elige la clase de hoy más próxima a la hora actual (la que está en marcha, si la hay).
// Si se indica el profesor, sus clases van primero.
export function claseMasProxima(grupos, { profesorId = null, ahora = new Date(), hechas = {} } = {}) {
  const dia = DIA_POR_INDICE[ahora.getDay()];
  const actual = ahora.getHours() * 60 + ahora.getMinutes();
  const deHoy = grupos.filter((grupo) => diasDelGrupo(grupo).includes(dia) && minutosDe(grupo.hora_inicio) !== null);
  const propios = profesorId ? deHoy.filter((grupo) => String(grupo.profesor_id) === String(profesorId)) : [];
  const candidatos = propios.length ? propios : deHoy;
  if (!candidatos.length) return null;
  const distancia = (grupo) => {
    const inicio = minutosDe(grupo.hora_inicio);
    const fin = inicio + Number(grupo.duracion_min || 60);
    if (actual >= inicio - 10 && actual < fin) return 0;
    return actual < inicio ? inicio - actual : (actual - fin) + 1;
  };
  // A igual distancia, primero la que aún no tiene la lista pasada.
  const hecha = (grupo) => (hechas[grupo.id] === "guardada" ? 1 : 0);
  return [...candidatos].sort((a, b) => distancia(a) - distancia(b) || hecha(a) - hecha(b) || minutosDe(a.hora_inicio) - minutosDe(b.hora_inicio))[0];
}

// ---------- Cupo ----------
export function estadoCupo(grupo) {
  const cupo = Number(grupo?.cupo || 0);
  const alumnos = grupo?.alumnos || [];
  const cuenta = (campo) => alumnos.filter((alumno) => Number(alumno[campo] ?? 1) === 1).length;
  const dias = [];
  if (grupo?.dia1) dias.push({ dia: grupo.dia1, alumnos: cuenta("asiste_dia1") });
  if (grupo?.dia2) dias.push({ dia: grupo.dia2, alumnos: cuenta("asiste_dia2") });
  return {
    cupo,
    dias,
    hayPlazas: !cupo || dias.some((item) => item.alumnos < cupo),
    completo: cupo > 0 && dias.length > 0 && dias.every((item) => item.alumnos >= cupo),
    algunDiaCompleto: cupo > 0 && dias.some((item) => item.alumnos >= cupo),
    sobrecupo: cupo > 0 && dias.some((item) => item.alumnos > cupo),
  };
}

export function textoCupo(grupo) {
  const { cupo, dias } = estadoCupo(grupo);
  if (!cupo) return `${grupo?.alumnos?.length || 0} alumnos`;
  if (dias.length < 2) return `${dias[0]?.alumnos ?? grupo?.alumnos?.length ?? 0} de ${cupo}`;
  if (dias[0].alumnos === dias[1].alumnos) return `${dias[0].alumnos} de ${cupo}`;
  return dias.map((item) => `${nombreDia(item.dia).slice(0, 3)} ${item.alumnos} de ${cupo}`).join(" · ");
}

export function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}
