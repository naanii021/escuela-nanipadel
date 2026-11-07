import assert from "node:assert/strict";
import test from "node:test";

import {
  CACHE_MS,
  FUENTES_PADEL,
  decodificarEntidades,
  obtenerNoticiasPadel,
  parsearRss,
  reiniciarCacheNoticias,
  unirNoticias,
} from "../services/noticiasPadelService.js";

// Recortes con la forma real de cada RSS.
const RSS_MARCA = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[Pádel // marca]]></title>
    <link>https://www.marca.com</link>
    <atom:link href="https://objetos.estaticos-marca.com/rss/padel.xml" rel="self" type="application/rss+xml" />
    <item>
    <title><![CDATA[El partido más emotivo del Mundial: una leyenda contra su hijo]]></title><description><![CDATA[Texto&nbsp;<a href="https://www.marca.com/padel/x.html"> Leer </a>]]></description><link>https://www.marca.com/padel/2026/11/05/partido-emotivo.html</link><media:title type="html"><![CDATA[PÁDEL]]></media:title><media:content url="https://objetos.estaticos-marca.com/a.jpg" medium="image" /><pubDate>Thu, 05 Nov 2026 14:38:27 +0100</pubDate>
    </item>
    <item>
    <title><![CDATA[Galán &amp; Chingotto: &#039;Vamos a por todas&#039;]]></title><link>https://www.marca.com/padel/2026/11/06/galan.html</link><pubDate>Fri, 06 Nov 2026 09:00:00 +0100</pubDate>
    </item>
  </channel>
</rss>`;

const RSS_MD = `<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
    <channel>
        <title>Pádel</title>
        <link>https://www.mundodeportivo.com/padel</link>
<item>
    <guid isPermaLink="true">https://www.mundodeportivo.com/padel/20261107/1/bombazo.html</guid>
    <title>
        Bombazo en la alineación de España    </title>
    <description>Salta la sorpresa en la &lt;a href=&quot;https://www.mundodeportivo.com/x&quot;&gt;final&lt;/a&gt;.</description>
    <pubDate>07 Nov 2026 17:56:11 +0100</pubDate>
    <link>https://www.mundodeportivo.com/padel/20261107/1/bombazo.html</link>
    <enclosure type="image/jpeg" length="1" url="https://imagenes2.mundodeportivo.com/a.jpeg"/>
    <content:encoded>&lt;![CDATA[&lt;p&gt;Texto completo&lt;/p&gt;]]&gt;</content:encoded>
</item>
<item>
    <guid isPermaLink="true">https://www.mundodeportivo.com/padel/20261104/2/antigua.html</guid>
    <title>Una noticia &quot;antigua&quot;</title>
    <pubDate>04 Nov 2026 10:00:00 +0100</pubDate>
</item>
<item>
    <title>Sin enlace: se descarta</title>
    <pubDate>07 Nov 2026 18:00:00 +0100</pubDate>
</item>
    </channel>
</rss>`;

function respuesta(xml, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => xml };
}

function fetchSimulado(porUrl) {
  const llamadas = [];
  const impl = async (url) => {
    llamadas.push(url);
    const salida = porUrl[url];
    if (salida instanceof Error) throw salida;
    if (typeof salida === "function") return salida();
    return salida ?? respuesta("", 404);
  };
  impl.llamadas = llamadas;
  return impl;
}

const [MARCA, MD] = FUENTES_PADEL;

test("decodifica entidades con nombre y numéricas", () => {
  assert.equal(decodificarEntidades("Pádel &amp; más &#039;hoy&#039; &#x2014; &quot;ya&quot; &ntilde;"), "Pádel & más 'hoy' — \"ya\" ñ");
  assert.equal(decodificarEntidades("&desconocida;"), "&desconocida;");
});

test("parsea el RSS de Marca: CDATA, entidades y sin confundir media:title", () => {
  const noticias = parsearRss(RSS_MARCA, "Marca");
  assert.equal(noticias.length, 2);
  assert.deepEqual(noticias[0], {
    titulo: "El partido más emotivo del Mundial: una leyenda contra su hijo",
    enlace: "https://www.marca.com/padel/2026/11/05/partido-emotivo.html",
    fecha: "2026-11-05T13:38:27.000Z",
    fuente: "Marca",
  });
  assert.equal(noticias[1].titulo, "Galán & Chingotto: 'Vamos a por todas'");
  // Solo titular: nada de imágenes ni del texto de la noticia.
  assert.deepEqual(Object.keys(noticias[0]).sort(), ["enlace", "fecha", "fuente", "titulo"]);
});

test("parsea el RSS de Mundo Deportivo: espacios, fecha sin día de la semana y guid", () => {
  const noticias = parsearRss(RSS_MD, "Mundo Deportivo");
  assert.equal(noticias.length, 2, "la noticia sin enlace se descarta");
  assert.equal(noticias[0].titulo, "Bombazo en la alineación de España");
  assert.equal(noticias[0].fecha, "2026-11-07T16:56:11.000Z");
  assert.equal(noticias[1].titulo, 'Una noticia "antigua"');
  assert.equal(noticias[1].enlace, "https://www.mundodeportivo.com/padel/20261104/2/antigua.html");
});

test("parsearRss tolera XML vacío o roto", () => {
  assert.deepEqual(parsearRss("", "X"), []);
  assert.deepEqual(parsearRss("<html>error</html>", "X"), []);
  assert.deepEqual(parsearRss("<item><title>Malo</title><link>javascript:alert(1)</link></item>", "X"), []);
});

test("une las fuentes ordenadas por fecha, sin repetidas y con máximo", () => {
  const unidas = unirNoticias([parsearRss(RSS_MARCA, "Marca"), parsearRss(RSS_MD, "Mundo Deportivo")]);
  assert.deepEqual(unidas.map((n) => n.fuente), ["Mundo Deportivo", "Marca", "Marca", "Mundo Deportivo"]);
  assert.deepEqual(unidas.map((n) => n.fecha), [...unidas.map((n) => n.fecha)].sort().reverse());

  const repetida = { titulo: "A", enlace: "https://a.es/n.html?utm=1", fecha: null, fuente: "X" };
  const otra = { titulo: "A", enlace: "https://a.es/n.html", fecha: null, fuente: "Y" };
  assert.equal(unirNoticias([[repetida], [otra]]).length, 1);

  const muchas = Array.from({ length: 30 }, (_, i) => ({ titulo: `N${i}`, enlace: `https://a.es/${i}`, fecha: new Date(Date.UTC(2026, 0, i + 1)).toISOString(), fuente: "X" }));
  const diez = unirNoticias([muchas]);
  assert.equal(diez.length, 10);
  assert.equal(diez[0].titulo, "N29");
});

test("un medio que publica mucho no tapa a los demás", () => {
  const dia = (d) => new Date(Date.UTC(2026, 10, d)).toISOString();
  const md = Array.from({ length: 12 }, (_, i) => ({ titulo: `MD${i}`, enlace: `https://md.es/${i}`, fecha: dia(20 - i), fuente: "Mundo Deportivo" }));
  const marca = Array.from({ length: 5 }, (_, i) => ({ titulo: `M${i}`, enlace: `https://marca.com/${i}`, fecha: dia(5 - i), fuente: "Marca" }));
  const unidas = unirNoticias([md, marca]);
  assert.equal(unidas.length, 10);
  assert.deepEqual(unidas.filter((n) => n.fuente === "Marca").map((n) => n.titulo), ["M0", "M1", "M2"]);
  assert.deepEqual(unidas.slice(0, 7).map((n) => n.titulo), ["MD0", "MD1", "MD2", "MD3", "MD4", "MD5", "MD6"]);
  // Sigue ordenado por fecha.
  assert.deepEqual(unidas.map((n) => n.fecha), [...unidas.map((n) => n.fecha)].sort().reverse());
  // Si una fuente solo tiene uno, se queda con ese.
  assert.equal(unirNoticias([md, marca.slice(0, 1)]).filter((n) => n.fuente === "Marca").length, 1);
});

test("lee ambas fuentes y guarda la caché 30 minutos", async () => {
  reiniciarCacheNoticias();
  let ahora = 1_000_000;
  const fetchImpl = fetchSimulado({ [MARCA.url]: respuesta(RSS_MARCA), [MD.url]: respuesta(RSS_MD) });

  const primera = await obtenerNoticiasPadel({ fetchImpl, ahora: () => ahora });
  assert.equal(primera.length, 4);
  assert.equal(primera[0].titulo, "Bombazo en la alineación de España");
  assert.equal(fetchImpl.llamadas.length, 2);

  ahora += CACHE_MS - 1;
  await obtenerNoticiasPadel({ fetchImpl, ahora: () => ahora });
  assert.equal(fetchImpl.llamadas.length, 2, "dentro de los 30 minutos no se vuelve a pedir");

  ahora += 2;
  await obtenerNoticiasPadel({ fetchImpl, ahora: () => ahora });
  assert.equal(fetchImpl.llamadas.length, 4, "caducada la caché se piden otra vez");
});

test("las peticiones simultáneas comparten una sola lectura", async () => {
  reiniciarCacheNoticias();
  const fetchImpl = fetchSimulado({ [MARCA.url]: respuesta(RSS_MARCA), [MD.url]: respuesta(RSS_MD) });
  const [a, b] = await Promise.all([obtenerNoticiasPadel({ fetchImpl }), obtenerNoticiasPadel({ fetchImpl })]);
  assert.equal(fetchImpl.llamadas.length, 2);
  assert.equal(a, b);
});

test("si una fuente falla se usan las demás", async () => {
  reiniciarCacheNoticias();
  const fetchImpl = fetchSimulado({ [MARCA.url]: new Error("timeout"), [MD.url]: respuesta(RSS_MD) });
  const noticias = await obtenerNoticiasPadel({ fetchImpl });
  assert.deepEqual([...new Set(noticias.map((n) => n.fuente))], ["Mundo Deportivo"]);

  reiniciarCacheNoticias();
  const conError = fetchSimulado({ [MARCA.url]: respuesta(RSS_MARCA), [MD.url]: respuesta("caído", 503) });
  assert.deepEqual([...new Set((await obtenerNoticiasPadel({ fetchImpl: conError })).map((n) => n.fuente))], ["Marca"]);
});

test("si fallan todas devuelve lista vacía sin lanzar", async () => {
  reiniciarCacheNoticias();
  const fetchImpl = fetchSimulado({ [MARCA.url]: new Error("sin red"), [MD.url]: respuesta("", 500) });
  assert.deepEqual(await obtenerNoticiasPadel({ fetchImpl }), []);
});

test("si fallan todas tras una lectura buena se mantiene la última lista", async () => {
  reiniciarCacheNoticias();
  let ahora = 0;
  const buena = fetchSimulado({ [MARCA.url]: respuesta(RSS_MARCA), [MD.url]: respuesta(RSS_MD) });
  await obtenerNoticiasPadel({ fetchImpl: buena, ahora: () => ahora });
  ahora += CACHE_MS + 1;
  const caida = fetchSimulado({ [MARCA.url]: new Error("x"), [MD.url]: new Error("y") });
  assert.equal((await obtenerNoticiasPadel({ fetchImpl: caida, ahora: () => ahora })).length, 4);
});

test("la ruta GET /api/noticias/padel responde con la lista", async () => {
  reiniciarCacheNoticias();
  const original = globalThis.fetch;
  globalThis.fetch = fetchSimulado({ [MARCA.url]: respuesta(RSS_MARCA), [MD.url]: new Error("caído") });
  try {
    const { default: router } = await import("../routes/noticias.js");
    const layer = router.stack.find((l) => l.route?.path === "/padel" && l.route.methods.get);
    const res = {
      headers: {},
      set(k, v) { this.headers[k] = v; return this; },
      json(body) { this.body = body; return this; },
    };
    await layer.route.stack.at(-1).handle({}, res);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.noticias.length, 2);
    assert.match(res.headers["Cache-Control"], /max-age/);
  } finally {
    globalThis.fetch = original;
  }
});
