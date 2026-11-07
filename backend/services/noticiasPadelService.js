// Titulares de pádel de medios deportivos, leídos de sus RSS públicos.
// Solo se guardan titular, enlace, fecha y fuente: ni imágenes ni texto de la noticia
// (son de los medios). Sin dependencias: el RSS se parsea con expresiones sencillas.

export const FUENTES_PADEL = [
  { nombre: "Marca", url: "https://e00-marca.uecdn.es/rss/padel.xml" },
  { nombre: "Mundo Deportivo", url: "https://www.mundodeportivo.com/rss/padel" },
];

export const MAX_NOTICIAS = 10;
export const CACHE_MS = 30 * 60 * 1000;
// Si todas las fuentes fallan no se insiste en cada visita: se reintenta a los 5 minutos.
const CACHE_FALLO_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 4000;
const MAX_BYTES = 2 * 1024 * 1024;

const ENTIDADES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  iexcl: "¡",
  iquest: "¿",
  ordf: "ª",
  ordm: "º",
  deg: "°",
  euro: "€",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  ccedil: "ç",
  Ccedil: "Ç",
  agrave: "à",
  egrave: "è",
  ograve: "ò",
};

export function decodificarEntidades(texto) {
  return String(texto).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera, codigo) => {
    if (codigo[0] === "#") {
      const numero = codigo[1].toLowerCase() === "x" ? parseInt(codigo.slice(2), 16) : parseInt(codigo.slice(1), 10);
      return Number.isFinite(numero) && numero > 0 && numero <= 0x10ffff ? String.fromCodePoint(numero) : "";
    }
    return ENTIDADES[codigo] ?? entera;
  });
}

// Texto plano de un campo: quita CDATA, decodifica entidades y elimina etiquetas HTML.
function textoPlano(valor) {
  let texto = String(valor).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  texto = decodificarEntidades(texto);
  // Algunos medios escapan el CDATA dos veces: &lt;![CDATA[ ... ]]&gt;
  texto = texto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function campo(bloque, etiqueta) {
  const coincidencia = bloque.match(new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)</${etiqueta}>`, "i"));
  return coincidencia ? textoPlano(coincidencia[1]) : "";
}

function enlaceValido(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function fechaISO(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

// Convierte un RSS 2.0 (o Atom, por si algún medio cambia) en [{ titulo, enlace, fecha, fuente }].
export function parsearRss(xml, fuente) {
  const texto = String(xml || "");
  const noticias = [];
  const bloques = [...texto.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const entradas = bloques.length ? [] : [...texto.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);

  for (const bloque of bloques) {
    const titulo = campo(bloque, "title");
    const enlace = enlaceValido(campo(bloque, "link") || campo(bloque, "guid"));
    if (!titulo || !enlace) continue;
    noticias.push({ titulo, enlace, fecha: fechaISO(campo(bloque, "pubDate") || campo(bloque, "dc:date")), fuente });
  }

  for (const bloque of entradas) {
    const titulo = campo(bloque, "title");
    const href = bloque.match(/<link\b[^>]*href=["']([^"']+)["']/i);
    const enlace = enlaceValido(href ? decodificarEntidades(href[1]) : "");
    if (!titulo || !enlace) continue;
    noticias.push({ titulo, enlace, fecha: fechaISO(campo(bloque, "updated") || campo(bloque, "published")), fuente });
  }

  return noticias;
}

// Une las fuentes, quita repetidas y deja las más recientes primero (sin fecha, al final).
export function unirNoticias(listas, max = MAX_NOTICIAS) {
  const vistas = new Set();
  return listas
    .flat()
    .filter((noticia) => {
      const clave = noticia.enlace.replace(/[?#].*$/, "");
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    })
    .sort((a, b) => (b.fecha ? Date.parse(b.fecha) : 0) - (a.fecha ? Date.parse(a.fecha) : 0))
    .slice(0, max);
}

async function leerFuente({ nombre, url }, fetchImpl) {
  const respuesta = await fetchImpl(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "NaniPadel/1.0 (+noticias)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!respuesta.ok) throw new Error(`${nombre}: HTTP ${respuesta.status}`);
  const xml = await respuesta.text();
  return parsearRss(xml.slice(0, MAX_BYTES), nombre);
}

let cache = { hasta: 0, noticias: [] };
let enCurso = null;

export function reiniciarCacheNoticias() {
  cache = { hasta: 0, noticias: [] };
  enCurso = null;
}

// Devuelve las noticias en caché o las vuelve a leer. Nunca lanza: si todo falla, lista vacía
// (o la última lista buena que hubiera).
export async function obtenerNoticiasPadel({ fetchImpl = globalThis.fetch, ahora = Date.now, fuentes = FUENTES_PADEL } = {}) {
  if (ahora() < cache.hasta) return cache.noticias;
  if (enCurso) return enCurso;

  enCurso = (async () => {
    const resultados = await Promise.allSettled(fuentes.map((fuente) => leerFuente(fuente, fetchImpl)));
    resultados
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.warn("Noticias de pádel: fuente no disponible:", r.reason?.message || r.reason));

    const listas = resultados.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const noticias = unirNoticias(listas);
    if (noticias.length) {
      cache = { hasta: ahora() + CACHE_MS, noticias };
    } else {
      cache = { hasta: ahora() + CACHE_FALLO_MS, noticias: cache.noticias };
    }
    return cache.noticias;
  })().finally(() => {
    enCurso = null;
  });

  return enCurso;
}
