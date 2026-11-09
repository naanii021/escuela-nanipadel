// Figuras SVG de la pista 3D. Todas comparten el mismo lienzo (64 × 104) y apoyan los pies
// en (PIE_X, PIE_Y): así la escena puede calcular dónde queda la mano o la pala.
// Las posturas se cambian con data-pose en el contenedor y el CSS gira el brazo.

export const FIGURA = { ancho: 64, alto: 104, pieX: 26, pieY: 102 };
// El profe necesita más lienzo a los lados y arriba/abajo: la pala sale de la figura al golpear y
// el navegador recorta lo que queda fuera de la caja. Su caja es más grande (ver MEDIDAS_FIGURA.profe)
// y los pies siguen en el mismo punto.
export const MARGEN_PROFE = 34;
export const MARGEN_PROFE_V = 8;
export const CARRO = { ancho: 48, alto: 64, pieX: 24, pieY: 62 };

const PIEL = "#e7b48b";
const PIEL_SOMBRA = "#c99069";
const BOLA = "#d7f230";

// Pala de pádel: cabeza redonda perforada, puente y mango con empuñadura.
function Pala({ x, y, cara = "#1d2a44", borde = "#b8ee58" }) {
  const agujeros = [
    [-3.4, -4.4], [0, -5.2], [3.4, -4.4],
    [-4.6, -0.9], [-1.5, -1.2], [1.5, -1.2], [4.6, -0.9],
    [-3.4, 2.6], [0, 2.2], [3.4, 2.6],
    [-1.6, 5.4], [1.6, 5.4],
  ];
  return (
    <g className="pala" transform={`translate(${x} ${y})`}>
      <path d="M-1.4 9.6 L-1.1 18.5 H1.1 L1.4 9.6Z" fill="#1b1f27" />
      <rect x="-1.5" y="15" width="3" height="5.4" rx="1.2" fill="#f4f7f3" />
      <ellipse cx="0" cy="0" rx="8.2" ry="10" fill={cara} stroke={borde} strokeWidth="1.6" />
      {agujeros.map(([ax, ay]) => (
        <circle key={`${ax}${ay}`} cx={ax} cy={ay} r=".75" fill="rgba(255,255,255,.62)" />
      ))}
    </g>
  );
}

function Piernas({ pantalon, calcetin = "#ffffff" }) {
  return (
    <g>
      <rect x="18.4" y="66" width="6.4" height="28" rx="2.6" fill={PIEL} />
      <rect x="27.4" y="66" width="6.4" height="28" rx="2.6" fill={PIEL_SOMBRA} />
      <rect x="18.4" y="88" width="6.4" height="5" fill={calcetin} />
      <rect x="27.4" y="88" width="6.4" height="5" fill={calcetin} />
      {/* Zapatillas con suela */}
      <rect x="15.6" y="92.5" width="10.6" height="7" rx="3" fill="#ffffff" />
      <rect x="26.2" y="92.5" width="10.6" height="7" rx="3" fill="#ffffff" />
      <rect x="15.6" y="98" width="10.6" height="2.6" rx="1.2" fill="#5b6472" />
      <rect x="26.2" y="98" width="10.6" height="2.6" rx="1.2" fill="#5b6472" />
      {/* Pantalón corto */}
      <path d="M15.6 56.5h21l1.8 15.5H28.3l-2.3-5.6-2.3 5.6H13.8z" fill={pantalon} />
    </g>
  );
}

function Torso({ polo, detalle }) {
  return (
    <g>
      {/* Polo de manga corta */}
      <path d="M13.5 31.5c4-3.6 21-3.6 25 0l3.2 8.6-4.7 2v16.4H15V42.1l-4.7-2z" fill={polo} />
      <path d="M15 52.5h22v6H15z" fill="rgba(0,0,0,.12)" />
      <path d="M21.5 28.6c2.6 2.4 6.4 2.4 9 0" fill="none" stroke={detalle} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

// Alumno visto de espaldas (está en el lado cercano y mira hacia la red).
export function Alumno({ polo = "#b8ee58", detalle = "#2f7d54", gorra = "#ffffff", pelo = "#4a3426" }) {
  return (
    <svg viewBox={`0 0 ${FIGURA.ancho} ${FIGURA.alto}`} aria-hidden="true">
      <Piernas pantalon="#1d2a44" />
      <Torso polo={polo} detalle={detalle} />
      {/* Franja lateral del polo */}
      <path d="M15.2 43v14M36.8 43v14" stroke={detalle} strokeWidth="1.4" />
      {/* Brazo izquierdo, relajado */}
      <path d="M13 36.5l-3.8 17.5" stroke={PIEL_SOMBRA} strokeWidth="4.6" strokeLinecap="round" />
      <path d="M13.6 33.5l-3.4 8" stroke={polo} strokeWidth="6.4" strokeLinecap="round" />
      {/* Cuello y cabeza: nuca con pelo y gorra vista desde atrás */}
      <rect x="23" y="23" width="6" height="7" rx="2" fill={PIEL_SOMBRA} />
      <circle cx="26" cy="16.5" r="8.2" fill={pelo} />
      <path d="M17.6 15.5a8.4 8.4 0 0 1 16.8 0z" fill={gorra} />
      <path d="M23.6 15.5h4.8v2.2h-4.8z" fill={pelo} />
      <path d="M17.6 15.5h16.8" stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      {/* Brazo de la pala: gira desde el hombro según la postura */}
      <g className="brazo">
        <path d="M38.5 34l9 12" stroke={PIEL} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M38.4 33.6l3.6 4.8" stroke={polo} strokeWidth="6.4" strokeLinecap="round" />
        <Pala x={48.6} y={28} />
      </g>
    </svg>
  );
}

// Profe visto de frente, junto al carro: polo oscuro con "PROFE", silbato, pala en una mano
// (con ella golpea las bolas) y la otra mano libre para coger bolas del carro.
export function Profe() {
  const polo = "#17372a";
  return (
    <svg viewBox={`${-MARGEN_PROFE} ${-MARGEN_PROFE_V} ${FIGURA.ancho + MARGEN_PROFE * 2} ${FIGURA.alto + MARGEN_PROFE_V * 2}`} aria-hidden="true">
      <Piernas pantalon="#3b4250" calcetin="#b8ee58" />
      <Torso polo={polo} detalle="#b8ee58" />
      <text x="26" y="50.5" textAnchor="middle" fontSize="6" fontWeight="900" fontFamily="Inter, Arial, sans-serif" fill="#b8ee58" letterSpacing=".2">
        PROFE
      </text>
      {/* Cordón y silbato */}
      <path d="M22.2 30.2l3.8 9.4 3.8-9.4" fill="none" stroke="#b8ee58" strokeWidth=".9" />
      <rect x="23.9" y="39" width="4.4" height="3" rx="1.2" fill="#d6dbe3" stroke="#5b6472" strokeWidth=".5" />
      {/* Brazo de la pala: la misma pala que los alumnos, agarrada por el mango y con la cabeza
          hacia abajo en reposo. Gira desde el hombro (13.5, 34) en el saque. */}
      <g className="brazoPala">
        <g transform="rotate(180 9.4 52.5)">
          <Pala x={9.4} y={35.5} />
        </g>
        <path d="M13.2 36.5l-3.6 16" stroke={PIEL} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M13.6 33.5l-3.4 8" stroke={polo} strokeWidth="6.4" strokeLinecap="round" />
      </g>
      {/* Cara, gorra con visera hacia la cámara */}
      <rect x="23" y="23" width="6" height="7" rx="2" fill={PIEL_SOMBRA} />
      <circle cx="26" cy="16.5" r="8.2" fill={PIEL} />
      <circle cx="23.2" cy="17.4" r=".95" fill="#1b1f27" />
      <circle cx="28.8" cy="17.4" r=".95" fill="#1b1f27" />
      <path d="M23.6 21.2q2.4 1.4 4.8 0" fill="none" stroke="#8a4b33" strokeWidth=".8" strokeLinecap="round" />
      <path d="M17.6 14.2a8.4 8.4 0 0 1 16.8 0z" fill="#b8ee58" />
      <ellipse cx="26" cy="14.4" rx="10.6" ry="2.4" fill="#8fc73a" />
      {/* Brazo libre: baja al carro, coge una bola y la sostiene en alto hasta dejarla caer */}
      <g className="brazo">
        <path d="M38.6 34.5l2.4 17" stroke={PIEL} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M38.4 33.6l1.2 5.6" stroke={polo} strokeWidth="6.4" strokeLinecap="round" />
        <circle className="bolaMano" cx="41.4" cy="54.6" r="2.9" fill={BOLA} stroke="#8fae12" strokeWidth=".6" />
      </g>
    </svg>
  );
}

// Carro de bolas: cesta de rejilla llena, asa y ruedas.
export function Carro() {
  const bolas = [
    [12, 22], [19, 25], [27, 22], [35, 25], [15, 31], [23, 32], [31, 31], [19, 38], [28, 38],
    [11, 14], [18, 12], [25, 14], [32, 12], [38, 15], [22, 7.5], [29, 8],
  ];
  return (
    <svg viewBox={`0 0 ${CARRO.ancho} ${CARRO.alto}`} aria-hidden="true">
      <path d="M12 44l-2 14M36 44l2 14" stroke="#8a94a3" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 16l4-12" stroke="#8a94a3" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M43 4h5" stroke="#1b1f27" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 16h36l-3.5 28h-29z" fill="rgba(23,55,42,.55)" />
      {bolas.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.6" fill={BOLA} stroke="#8fae12" strokeWidth=".7" />
      ))}
      {/* Rejilla por delante de las bolas de dentro */}
      <path
        d="M6 16h36l-3.5 28h-29zM14.8 16l1.4 28M24 16v28M33.2 16l-1.4 28M7.2 25.3h33.6M8.4 34.6h31.2"
        fill="none"
        stroke="#d6dbe3"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="58" r="4" fill="#1b1f27" />
      <circle cx="38" cy="58" r="4" fill="#1b1f27" />
      <circle cx="10" cy="58" r="1.4" fill="#8a94a3" />
      <circle cx="38" cy="58" r="1.4" fill="#8a94a3" />
    </svg>
  );
}

// Jugador de partido visto de frente (para la escena "partido").
export function JugadorFrente({ polo = "#2f8f5b", detalle = "#b8ee58" }) {
  return (
    <svg viewBox={`0 0 ${FIGURA.ancho} ${FIGURA.alto}`} aria-hidden="true">
      <Piernas pantalon="#1d2a44" />
      <Torso polo={polo} detalle={detalle} />
      <path d="M13 36.5l-3.8 17.5" stroke={PIEL} strokeWidth="4.6" strokeLinecap="round" />
      <path d="M13.6 33.5l-3.4 8" stroke={polo} strokeWidth="6.4" strokeLinecap="round" />
      <rect x="23" y="23" width="6" height="7" rx="2" fill={PIEL_SOMBRA} />
      <circle cx="26" cy="16.5" r="8.2" fill={PIEL} />
      <circle cx="23.2" cy="17.4" r=".95" fill="#1b1f27" />
      <circle cx="28.8" cy="17.4" r=".95" fill="#1b1f27" />
      <path d="M17.6 14.2a8.4 8.4 0 0 1 16.8 0z" fill="#ffffff" />
      <ellipse cx="26" cy="14.4" rx="10.6" ry="2.4" fill="#d6dbe3" />
      <g className="brazo">
        <path d="M38.5 34l9 12" stroke={PIEL} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M38.4 33.6l3.6 4.8" stroke={polo} strokeWidth="6.4" strokeLinecap="round" />
        <Pala x={48.6} y={28} />
      </g>
    </svg>
  );
}
