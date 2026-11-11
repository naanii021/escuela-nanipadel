import { useEffect, useRef, useState } from "react";
import "./lineaAgua.css";

const UMBRAL_MM = 1; // con más agua que esto no se juega (PARAMETROS.CHARCO_MM)
const ALTO = 190;
const M = { izq: 34, der: 10, arriba: 24, abajo: 26 };

const hh = (t) => String(t).slice(11, 16);
const dia = (t) => String(t).slice(0, 10);
const mm = (v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(".", ","));

function etiquetaHora(hora, primera) {
  const dias = (Date.parse(`${dia(hora.time)}T00:00:00Z`) - Date.parse(`${dia(primera.time)}T00:00:00Z`)) / 86400000;
  return `${dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : "Pasado mañana"} a las ${hh(hora.time)}`;
}

// Gráfica sencilla y propia (SVG): el agua que hay en la pista hora a hora, con el fondo verde
// cuando se puede jugar y rayado rojo cuando no, y una marca donde se seca. Se redibuja al ancho
// real para que los textos tengan siempre un tamaño legible.
function LineaAgua({ horas, secaA }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(340);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const medir = () => setAncho(Math.max(260, Math.round(el.clientWidth)));
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = horas.length;
  if (n < 2) return null;
  const maxAgua = Math.max(...horas.map((x) => x.aguaMm || 0));
  const tope = Math.max(3, Math.ceil(maxAgua));
  const w = ancho - M.izq - M.der;
  const alto = ALTO - M.arriba - M.abajo;
  const bw = w / n;
  const x = (i) => M.izq + (i + 0.5) * bw;
  // Escala de raíz: así 1 mm (el límite para jugar) se ve aunque haya 40 mm de tormenta.
  const y = (v) => M.arriba + alto - Math.sqrt(Math.min(Math.max(v, 0), tope) / tope) * alto;

  const puntos = horas.map((p, i) => [x(i), y(p.aguaMm || 0)]);
  const linea = puntos.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = `${linea} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;

  const iSeca = secaA ? horas.findIndex((p) => p.time === secaA) : -1;
  const ancha = ancho >= 520;
  const marcas = horas
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i > 0 && Number(hh(p.time).slice(0, 2)) % (ancha ? 6 : 12) === 0);

  const elegida = sel != null ? horas[sel] : null;

  function elegir(ev) {
    const r = ev.currentTarget.getBoundingClientRect();
    const i = Math.floor(((ev.clientX - r.left - M.izq) / w) * n);
    setSel(Math.max(0, Math.min(n - 1, i)));
  }

  const secaDerecha = iSeca > n * 0.7;

  return (
    <div className="lineaAgua" ref={caja}>
      <div className="lineaAguaLectura">
        {elegida ? (
          <>
            <strong>{etiquetaHora(elegida, horas[0])}</strong>
            <span className={elegida.playable ? "esOk" : "esNo"}>
              {elegida.playable ? "Se puede jugar" : `No se puede: ${elegida.motivoCorto.toLowerCase()}`}
            </span>
            <span>Agua en la pista: {elegida.aguaMm > 0.4 ? `${mm(elegida.aguaMm)} mm` : "ninguna"}</span>
          </>
        ) : (
          <span className="lineaAguaPista">Toca la gráfica para ver una hora concreta.</span>
        )}
      </div>

      <svg
        className="lineaAguaSvg"
        width={ancho}
        height={ALTO}
        viewBox={`0 0 ${ancho} ${ALTO}`}
        role="img"
        aria-label="Gráfica del agua en la pista durante las próximas 48 horas, con las horas en que se puede jugar en verde y las que no en rojo."
        onPointerDown={elegir}
        onPointerMove={(ev) => ev.pointerType === "mouse" && elegir(ev)}
        onPointerLeave={(ev) => ev.pointerType === "mouse" && setSel(null)}
      >
        <defs>
          <pattern id="lineaAguaRayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#fde8e6" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#e5483a" strokeWidth="1.6" opacity="0.45" />
          </pattern>
          <clipPath id="lineaAguaRevela">
            <rect className="lineaAguaCortina" x="0" y="0" width={ancho} height={ALTO} />
          </clipPath>
        </defs>

        {horas.map((p, i) => (
          <rect
            key={p.time}
            x={M.izq + i * bw}
            y={M.arriba}
            width={bw + 0.5}
            height={alto}
            fill={p.playable ? "var(--la-ok-fondo)" : "url(#lineaAguaRayas)"}
          />
        ))}
        {horas.map((p, i) => (
          <rect key={`b${p.time}`} x={M.izq + i * bw} y={M.arriba - 7} width={bw + 0.5} height="5" fill={p.playable ? "var(--la-ok)" : "var(--la-no)"} />
        ))}

        <line x1={M.izq} x2={M.izq + w} y1={y(0)} y2={y(0)} stroke="var(--la-eje)" />
        <text x={M.izq - 6} y={y(0) + 4} textAnchor="end" className="lineaAguaTxt">0</text>
        <text x={M.izq - 6} y={y(tope) + 4} textAnchor="end" className="lineaAguaTxt">{tope}</text>
        <text x={M.izq - 6} y={y(UMBRAL_MM) + 4} textAnchor="end" className="lineaAguaTxt">{UMBRAL_MM}</text>
        <text x={M.izq - 6} y={M.arriba - 8} textAnchor="end" className="lineaAguaTxt">mm</text>
        {marcas.map(({ p, i }) => (
          <g key={p.time}>
            <line
              x1={M.izq + i * bw}
              x2={M.izq + i * bw}
              y1={M.arriba}
              y2={y(0) + 4}
              stroke="var(--la-eje)"
              strokeDasharray={hh(p.time) === "00:00" ? "0" : "2 3"}
              opacity={hh(p.time) === "00:00" ? 0.9 : 0.5}
            />
            <text x={M.izq + i * bw} y={ALTO - 8} textAnchor="middle" className="lineaAguaTxt">
              {hh(p.time) === "00:00" ? "0 h" : `${Number(hh(p.time).slice(0, 2))} h`}
            </text>
          </g>
        ))}

        <line x1={M.izq} x2={M.izq + w} y1={y(UMBRAL_MM)} y2={y(UMBRAL_MM)} stroke="var(--la-agua-oscuro)" strokeDasharray="4 3" strokeWidth="1.2" />
        <text x={M.izq + w - 4} y={y(UMBRAL_MM) - 5} textAnchor="end" className="lineaAguaTxt lineaAguaHalo">
          Límite para jugar
        </text>

        <g clipPath="url(#lineaAguaRevela)">
          <path d={area} fill="var(--la-agua)" opacity="0.28" />
          <path d={linea} fill="none" stroke="var(--la-agua-oscuro)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </g>

        <line x1={x(0)} x2={x(0)} y1={M.arriba} y2={y(0)} stroke="var(--la-tinta)" strokeWidth="1.5" />
        <text x={x(0) + 4} y={M.arriba + 12} className="lineaAguaTxt lineaAguaFuerte lineaAguaHalo">Ahora</text>

        {iSeca > 0 && (
          <g>
            <line x1={x(iSeca)} x2={x(iSeca)} y1={M.arriba - 7} y2={y(0)} stroke="var(--la-ok-oscuro)" strokeWidth="2" strokeDasharray="5 3" />
            <circle cx={x(iSeca)} cy={y(horas[iSeca].aguaMm || 0)} r="5" fill="#fff" stroke="var(--la-ok-oscuro)" strokeWidth="2.5" />
            <text
              x={x(iSeca) + (secaDerecha ? -6 : 6)}
              y={M.arriba + 30}
              textAnchor={secaDerecha ? "end" : "start"}
              className="lineaAguaTxt lineaAguaFuerte lineaAguaHalo lineaAguaSeca"
            >
              {`Seca ${hh(horas[iSeca].time)}`}
            </text>
          </g>
        )}

        {elegida && (
          <g>
            <line x1={x(sel)} x2={x(sel)} y1={M.arriba} y2={y(0)} stroke="var(--la-tinta)" strokeWidth="1.5" />
            <circle cx={x(sel)} cy={y(elegida.aguaMm || 0)} r="5" fill="var(--la-tinta)" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      <ul className="lineaAguaLeyenda">
        <li><i className="esOk" aria-hidden="true" />Se puede jugar</li>
        <li><i className="esNo" aria-hidden="true" />No se puede</li>
        <li><i className="esAgua" aria-hidden="true" />Agua en la pista</li>
      </ul>
    </div>
  );
}

export default LineaAgua;
