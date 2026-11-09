// Escenas de la pista 3D. Coordenadas de la pista: 300 × 600 px (10 × 20 m, 30 px/m),
// y = 0 en el fondo lejano, red en y = 300; z es la altura sobre el césped.
//
// Cada escena describe sus actores y crea un "animador": una función (ahora, geo) que
// devuelve dónde está cada figura, en qué postura y dónde están las bolas.
// geo = { rx, rz, k }: rx y rz son los grados con los que está inclinada la pista (las figuras los
// contragiran para mirar a la cámara; hace falta para saber dónde queda la pala en 3D) y
// k es el aumento extra de las figuras en esa pantalla.

import { CARRO, FIGURA, MARGEN_PROFE, MARGEN_PROFE_V } from "./Figuras";

// Escala de las figuras (px de pista por unidad del SVG). Exageradas para que se lean.
export const ESCALA_FIGURA = 1.12;
const RAD = Math.PI / 180;

// Punto de una figura (desplazado u px a la derecha y h px hacia arriba desde los pies)
// llevado a coordenadas de la pista, teniendo en cuenta que la figura está girada hacia la cámara.
export function puntoDeFigura(pie, u, h, { rx, rz }) {
  const yLocal = -h * Math.cos(rx * RAD);
  const z = h * Math.sin(rx * RAD);
  const a = -rz * RAD;
  return {
    x: pie.x + u * Math.cos(a) - yLocal * Math.sin(a),
    y: pie.y + u * Math.sin(a) + yLocal * Math.cos(a),
    z,
  };
}

// Pasa un punto del SVG de la figura a desplazamiento (u, h) desde sus pies.
function desdeSvg(svgX, svgY, medidas = FIGURA) {
  return { u: (svgX - medidas.pieX) * ESCALA_FIGURA, h: (medidas.pieY - svgY) * ESCALA_FIGURA };
}

const lerp = (a, b, p) => a + (b - a) * p;
const suave = (p) => p * p * (3 - 2 * p);
const limitar = (p) => Math.min(1, Math.max(0, p));

// Arco con altura extra en el centro (parábola) entre dos puntos 3D.
function arco(desde, hasta, p, altura) {
  return {
    x: lerp(desde.x, hasta.x, p),
    y: lerp(desde.y, hasta.y, p),
    z: lerp(desde.z, hasta.z, p) + 4 * altura * p * (1 - p),
  };
}

// Pseudoaleatorio estable por número de bola: la misma bola hace siempre el mismo recorrido.
function azar(n, semilla) {
  const v = Math.sin(n * 127.1 + semilla * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// ---------------------------------------------------------------------------
// Escena "clase": el profe coge bolas del carro, las deja caer y las alimenta con la pala;
// dos alumnos las devuelven.
// ---------------------------------------------------------------------------

const PROFE = { x: 118, y: 178 };
const CARRITO = { x: 166, y: 170 };
const ALUMNOS = [
  { x: 92, y: 452 },
  { x: 206, y: 452 },
];

const CADENCIA = 1550; // ms entre bola y bola
// Fases de cada bola (ms desde que la pala del profe la golpea)
const VUELO = 820; // pala → bote en el lado de los alumnos
const SUBIDA = 380; // bote → pala
const VUELTA = 980; // pala → bote en el lado del profe
const RODAR = 520; // bote final y desaparece
const VIDA = VUELO + SUBIDA + VUELTA + RODAR;

// Gira un punto del SVG alrededor de un pivote (grados, positivo = sentido horario, como CSS).
function girar([x, y], [px, py], grados) {
  const a = grados * RAD;
  const dx = x - px;
  const dy = y - py;
  return [px + dx * Math.cos(a) - dy * Math.sin(a), py + dx * Math.sin(a) + dy * Math.cos(a)];
}

// Profe: ángulos de los brazos en las posturas (deben coincidir con weatherCourt3d.css).
// La bola nace en el centro de la cabeza de la pala en el golpe y cae desde la mano libre.
const ANG_PALA_GOLPE = -74;
const ANG_MANO_SACA = -100;
const PALA_PROFE = desdeSvg(...girar([9.4, 69.5], [13.5, 34], ANG_PALA_GOLPE));
const MANO_LIBRE = desdeSvg(...girar([41.4, 54.6], [38.5, 34], ANG_MANO_SACA));
// Momentos del saque respecto al golpe (ms; 0 = la pala toca la bola)
const CAIDA = 300; // la bola se suelta y cae
const T_COGE = 1150; // el brazo libre baja al carro
const T_SACA = 850; // sube con la bola
const T_PREPARA = 300; // pala atrás (coincide con la suelta)
const T_GOLPE = 70; // empieza el swing corto
const T_SIGUE = 230; // recuperación

// Pala del alumno en el golpe.
const PALA_ALUMNO = desdeSvg(48.6, 30);

function posAlumno(indice, t) {
  const base = ALUMNOS[indice];
  // Cada alumno se desplaza un poco hacia su bola y vuelve a su sitio.
  const k = Math.floor(t / CADENCIA);
  let dx = 0;
  for (const n of [k, k - 1]) {
    if (n < 0 || n % 2 !== indice) continue;
    const local = t - n * CADENCIA;
    const ida = suave(limitar(local / (VUELO + SUBIDA * 0.6)));
    const vuelta = suave(limitar((local - (VUELO + SUBIDA + 250)) / 700));
    dx += (azar(n, 1) - 0.5) * 34 * (ida - vuelta);
  }
  return { x: base.x + dx, y: base.y };
}

function bolaDeClase(n, local, geo) {
  const caida = puntoDeFigura(PROFE, MANO_LIBRE.u * geo.k, MANO_LIBRE.h * geo.k, geo);
  const alumno = n % 2;
  const pie = posAlumno(alumno, n * CADENCIA + VUELO + SUBIDA);
  const mano = puntoDeFigura(PROFE, PALA_PROFE.u * geo.k, PALA_PROFE.h * geo.k, geo);
  const golpe = puntoDeFigura(pie, PALA_ALUMNO.u * geo.k, PALA_ALUMNO.h * geo.k, geo);
  const bote = { x: lerp(mano.x, golpe.x, 0.9) + (azar(n, 2) - 0.5) * 10, y: golpe.y - 24 - azar(n, 3) * 18, z: 0 };
  const destino = { x: 40 + azar(n, 4) * 220, y: 60 + azar(n, 5) * 150, z: 0 };
  // Si la devolución va hacia el carro o el profe, que bote algo antes.
  if (Math.abs(destino.x - CARRITO.x) < 40 && Math.abs(destino.y - CARRITO.y) < 40) destino.y += 70;
  const final = { x: destino.x + (destino.x - golpe.x) * 0.12, y: destino.y - 40, z: 0 };

  // Antes del golpe: la bola cae de la mano libre a la pala (aceleración de la gravedad).
  if (local < 0) return { ...arco(caida, mano, (local + CAIDA) ** 2 / CAIDA ** 2, 0), opacidad: 1 };
  if (local < VUELO) return { ...arco(mano, bote, local / VUELO, 34), opacidad: 1 };
  local -= VUELO;
  if (local < SUBIDA) return { ...arco(bote, golpe, local / SUBIDA, 14), opacidad: 1 };
  local -= SUBIDA;
  if (local < VUELTA) return { ...arco(golpe, destino, local / VUELTA, 34 + azar(n, 6) * 26), opacidad: 1 };
  local -= VUELTA;
  const p = local / RODAR;
  return { ...arco(destino, final, p, 16), opacidad: 1 - suave(p) };
}

// Postura del profe. d = ms desde el último golpe (de -T_GOLPE a CADENCIA - T_GOLPE: el swing
// empieza un poco antes del golpe).
function posturaProfe(t) {
  const d = ((t + T_GOLPE) % CADENCIA) - T_GOLPE;
  if (d < T_SIGUE - T_GOLPE) return "golpe";
  if (d < CADENCIA - T_COGE) return "espera";
  if (d < CADENCIA - T_SACA) return "coge";
  if (d < CADENCIA - T_PREPARA) return "saca";
  if (d < CADENCIA - T_GOLPE) return "suelta";
  return "golpe";
}

function posturaAlumno(indice, t) {
  const k = Math.floor(t / CADENCIA);
  for (const n of [k, k - 1]) {
    if (n < 0 || n % 2 !== indice) continue;
    const local = t - n * CADENCIA;
    if (local >= 260 && local < VUELO + SUBIDA - 40) return "prepara";
    if (local >= VUELO + SUBIDA - 40 && local < VUELO + SUBIDA + 300) return "golpe";
  }
  return "espera";
}

const clase = {
  id: "clase",
  figuras: [
    { id: "profe", tipo: "profe", ...PROFE },
    { id: "alumnoA", tipo: "alumno", polo: "#b8ee58", detalle: "#2f7d54", gorra: "#ffffff", pelo: "#4a3426", ...ALUMNOS[0] },
    { id: "alumnoB", tipo: "alumno", polo: "#2f8f5b", detalle: "#b8ee58", gorra: "#17372a", pelo: "#c08a4a", ...ALUMNOS[1] },
  ],
  carro: CARRITO,
  pelotas: 3,
  // Momento elegido para la imagen fija (movimiento reducido): el profe en postura de golpe,
  // la bola recién salida de la pala y otra volviendo al lado del profe.
  instanteFijo: CADENCIA * 5 + 140,
  crearAnimador() {
    return (t, geo) => {
      const pelotas = Array.from({ length: this.pelotas }, () => null);
      const k = Math.floor(t / CADENCIA);
      for (let n = Math.max(0, k - 2); n <= k + 1; n += 1) {
        const local = t - n * CADENCIA;
        if (local < -CAIDA || local >= VIDA) continue;
        pelotas[n % this.pelotas] = bolaDeClase(n, local, geo);
      }
      return {
        figuras: [
          { ...PROFE, pose: posturaProfe(t) },
          { ...posAlumno(0, t), pose: posturaAlumno(0, t) },
          { ...posAlumno(1, t), pose: posturaAlumno(1, t) },
        ],
        pelotas,
      };
    };
  },
};

// ---------------------------------------------------------------------------
// Escena "partido" (2 contra 2). De momento es el peloteo de siempre; queda aparte
// para poder darle golpes y posturas propias más adelante.
// ---------------------------------------------------------------------------

const JUGADORES = [
  { x: 90, y: 190 },
  { x: 210, y: 190 },
  { x: 90, y: 430 },
  { x: 210, y: 430 },
];

const partido = {
  id: "partido",
  figuras: [
    { id: "j1", tipo: "jugadorFrente", polo: "#2f8f5b", ...JUGADORES[0] },
    { id: "j2", tipo: "jugadorFrente", polo: "#2f8f5b", ...JUGADORES[1] },
    { id: "j3", tipo: "alumno", polo: "#b8ee58", detalle: "#2f7d54", ...JUGADORES[2] },
    { id: "j4", tipo: "alumno", polo: "#b8ee58", detalle: "#2f7d54", gorra: "#17372a", pelo: "#c08a4a", ...JUGADORES[3] },
  ],
  carro: null,
  pelotas: 1,
  instanteFijo: 0,
  crearAnimador() {
    let direccion = 1;
    let golpe = null;
    const posiciones = JUGADORES.map(({ x, y }) => ({ x, y }));

    return (t) => {
      if (!golpe) golpe = { desde: { x: 150, y: 520 }, hasta: { x: 190, y: 130 }, inicio: t, duracion: 1150, altura: 80 };
      let p = (t - golpe.inicio) / golpe.duracion;
      if (p >= 1) {
        direccion *= -1;
        golpe = {
          desde: golpe.hasta,
          hasta: { x: 40 + Math.random() * 220, y: direccion > 0 ? 60 + Math.random() * 200 : 340 + Math.random() * 200 },
          inicio: t,
          duracion: 950 + Math.random() * 360,
          altura: 60 + Math.random() * 50,
        };
        p = 0;
      }
      const x = lerp(golpe.desde.x, golpe.hasta.x, p);
      const y = lerp(golpe.desde.y, golpe.hasta.y, p);
      const z = 4 * golpe.altura * p * (1 - p) + 6;

      // Cada jugador se acerca despacio hacia la bola sin salirse de su zona.
      const figuras = JUGADORES.map((base, i) => {
        const punto = posiciones[i];
        punto.x += (base.x + (x - base.x) * 0.3 - punto.x) * 0.06;
        punto.y += (base.y + (y - 300) * 0.12 - punto.y) * 0.06;
        return { x: punto.x, y: punto.y, pose: "espera" };
      });
      return { figuras, pelotas: [{ x, y, z, opacidad: 1 }] };
    };
  },
};

export const ESCENAS = { clase, partido };

export const MEDIDAS_FIGURA = {
  figura: { ancho: FIGURA.ancho * ESCALA_FIGURA, alto: FIGURA.alto * ESCALA_FIGURA, pieX: FIGURA.pieX * ESCALA_FIGURA, pieY: FIGURA.pieY * ESCALA_FIGURA },
  // El profe lleva margen alrededor para que la pala no se recorte al girar el brazo.
  profe: {
    ancho: (FIGURA.ancho + MARGEN_PROFE * 2) * ESCALA_FIGURA,
    alto: (FIGURA.alto + MARGEN_PROFE_V * 2) * ESCALA_FIGURA,
    pieX: (FIGURA.pieX + MARGEN_PROFE) * ESCALA_FIGURA,
    pieY: (FIGURA.pieY + MARGEN_PROFE_V) * ESCALA_FIGURA,
  },
  carro: { ancho: CARRO.ancho * ESCALA_FIGURA, alto: CARRO.alto * ESCALA_FIGURA, pieX: CARRO.pieX * ESCALA_FIGURA, pieY: CARRO.pieY * ESCALA_FIGURA },
};
