import { PARAMETROS, cuandoTexto, estadoDeHora, evaluarPista, simularAgua } from "./estadoPista";

// Construye horas consecutivas desde `inicio` ("2026-11-09T00:00"); `lluvia[i]` son los mm de la hora i.
function horas(inicio, lluvia, extra = () => ({})) {
  const base = Date.parse(`${inicio}:00Z`);
  return lluvia.map((mm, i) => {
    const fecha = new Date(base + i * 3600e3);
    const hora = fecha.getUTCHours();
    return {
      time: fecha.toISOString().slice(0, 16),
      precipitationMm: mm,
      precipitationProbability: mm > 0 ? 80 : 0,
      temperature: 14,
      isDay: hora >= 8 && hora < 19 ? 1 : 0,
      windSpeed: 8,
      weatherCode: mm > 0 ? 61 : 0,
      ...extra(i, hora),
    };
  });
}

const seca = (n) => Array(n).fill(0);

test("sin lluvia la pista está seca y se puede jugar", () => {
  const lista = horas("2026-11-09T00:00", seca(72));
  const ev = evaluarPista(lista, 60);
  expect(ev.playable).toBe(true);
  expect(ev.estado).toBe("seca");
  expect(ev.aguaMm).toBe(0);
  expect(ev.reason).toMatch(/seca/);
});

test("un chispeo: no se juega mientras cae, pero a la hora o dos ya sí", () => {
  // 1,5 mm entre las 10:00 y las 11:00, sol después.
  const lluvia = seca(72);
  lluvia[34] = 1.5; // 10:00 del día 2
  const lista = horas("2026-11-08T00:00", lluvia);
  const durante = evaluarPista(lista, 34);
  expect(durante.playable).toBe(false);
  expect(durante.estado).toBe("lloviendo");
  const unaHora = evaluarPista(lista, 35);
  expect(unaHora.playable).toBe(false); // todavía hay 1,05 mm
  const dosHoras = evaluarPista(lista, 36);
  expect(dosHoras.playable).toBe(true);
  expect(dosHoras.aguaMm).toBeLessThanOrEqual(PARAMETROS.CHARCO_MM);
});

test("lluvia fuerte de madrugada: con sol y sin una gota, la pista sigue sin poder usarse todo el día", () => {
  // 14 mm entre la 1:00 y las 4:00 del día 2 (3 h), después sol.
  const lluvia = seca(96);
  [25, 26, 27].forEach((i, k) => { lluvia[i] = [6, 5, 3][k]; });
  const lista = horas("2026-11-08T00:00", lluvia, () => ({ weatherCode: 0 }));
  // Mediodía soleado del mismo día.
  const mediodia = evaluarPista(lista, 36);
  expect(mediodia.playable).toBe(false);
  expect(mediodia.estado).toBe("encharcada");
  expect(mediodia.reason).toMatch(/encharcada/);
  expect(mediodia.reason).toMatch(/aunque ahora no llueva/);
  expect(mediodia.aguaMm).toBeGreaterThan(PARAMETROS.ENCHARCADA_MM);
  // A las 20:00 sigue igual y la previsión dice cuándo se seca (más de 12 h después, ya al día siguiente).
  const noche = evaluarPista(lista, 44);
  expect(noche.playable).toBe(false);
  expect(noche.secaA).not.toBeNull();
  expect(noche.secaTexto).toMatch(/de mañana|del /);
  // Un día después de pasar la lluvia ya se puede jugar.
  const alDiaSiguiente = evaluarPista(lista, 95);
  expect(alDiaSiguiente.playable).toBe(true);
});

test("una lluvia moderada (4 mm) pide unas horas: mojada, no encharcada", () => {
  const lluvia = seca(72);
  lluvia[30] = 4;
  const lista = horas("2026-11-08T00:00", lluvia);
  const tras = evaluarPista(lista, 31);
  expect(tras.playable).toBe(false);
  expect(tras.estado).toBe("mojada");
  expect(tras.reason).toMatch(/Se secará hacia/);
});

test("lo que llovió hace 3 días ya no cuenta", () => {
  const lluvia = seca(96);
  lluvia[2] = 20;
  const lista = horas("2026-11-06T00:00", lluvia);
  expect(evaluarPista(lista, 90).playable).toBe(true);
});

test("la lluvia prevista más tarde corta las horas siguientes pero no las anteriores", () => {
  const lluvia = seca(96);
  lluvia[76] = 3; // dentro de unas horas
  const lista = horas("2026-11-08T00:00", lluvia);
  const ev = evaluarPista(lista, 72);
  expect(ev.playable).toBe(true);
  const porHora = Object.fromEntries(ev.horas.map((h) => [h.time.slice(11, 13), h]));
  expect(porHora["03"].playable).toBe(true); // 72 = día 4 00:00; 76 = 04:00 del día 4
  expect(ev.horas[76].playable).toBe(false);
  expect(ev.horas[76].motivoCorto).toBe("Lluvia");
  expect(ev.horas[80].playable).toBe(false);
});

test("viento fuerte y tormenta", () => {
  const lista = horas("2026-11-09T00:00", seca(48), (i) => (i === 30 ? { windSpeed: 40 } : i === 40 ? { weatherCode: 95 } : {}));
  expect(evaluarPista(lista, 30).estado).toBe("viento");
  expect(evaluarPista(lista, 40).estado).toBe("tormenta");
});

test("de noche y con frío se seca más despacio", () => {
  const lluvia = seca(24);
  lluvia[0] = 3;
  const dia = simularAgua(horas("2026-11-09T09:00", lluvia, () => ({ isDay: 1, temperature: 15 })));
  const noche = simularAgua(horas("2026-11-09T22:00", lluvia, () => ({ isDay: 0, temperature: 2 })));
  expect(noche[6].aguaMm).toBeGreaterThan(dia[6].aguaMm);
});

test("datos que faltan no rompen nada", () => {
  const lista = [{ time: "2026-11-09T12:00" }, { time: "2026-11-09T13:00", precipitationMm: null, windSpeed: undefined }];
  expect(evaluarPista(lista, 1).playable).toBe(true);
});

test("cuándo se seca, dicho en cristiano", () => {
  expect(cuandoTexto("2026-11-09T16:00", "2026-11-09T10:00")).toBe("las 16:00 de hoy");
  expect(cuandoTexto("2026-11-10T14:00", "2026-11-09T22:00")).toBe("las 14:00 de mañana");
  expect(cuandoTexto("2026-11-12T10:00", "2026-11-09T22:00")).toBe("las 10:00 del jueves");
});

test("estadoDeHora: probabilidad alta con algo de lluvia cuenta como lluvia", () => {
  expect(estadoDeHora({ precipitationMm: 0.15, precipitationProbability: 90, aguaMm: 0 }).motivo).toBe("lloviendo");
  expect(estadoDeHora({ precipitationMm: 0, precipitationProbability: 90, aguaMm: 0 }).playable).toBe(true);
});

test("si vuelve a llover antes de secarse, lo dice", () => {
  const lluvia = seca(96);
  lluvia[70] = 8; // esta noche
  lluvia[90] = 5; // en unas horas, antes de que se seque
  const lista = horas("2026-11-08T00:00", lluvia, () => ({ weatherCode: 0 }));
  const ev = evaluarPista(lista, 78);
  expect(ev.playable).toBe(false);
  expect(ev.secaA).toBeNull();
  expect(ev.secaTexto).toMatch(/Se espera más lluvia hacia/);
});
