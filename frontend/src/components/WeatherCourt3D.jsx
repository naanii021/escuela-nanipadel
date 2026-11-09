import { Fragment, useEffect, useRef, useState } from "react";
import { isRainy } from "../services/weatherService";
import { Alumno, Carro, JugadorFrente, Profe } from "./pista3d/Figuras";
import { ESCENAS, MEDIDAS_FIGURA } from "./pista3d/escenas";
import "./weatherCourt3d.css";

const STARS = Array.from({ length: 18 }, (_, index) => ({
  left: (index * 53) % 100,
  top: (index * 29) % 46,
  delay: (index % 6) * 0.45,
}));

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function FiguraSvg({ figura }) {
  if (figura.tipo === "profe") return <Profe />;
  if (figura.tipo === "jugadorFrente") return <JugadorFrente polo={figura.polo} />;
  return <Alumno polo={figura.polo} detalle={figura.detalle} gorra={figura.gorra} pelo={figura.pelo} />;
}

// Estilo de una figura de pie: los pies quedan en (--px, --py) y gira sobre ellos.
// El CSS multiplica las medidas por --fig-escala (más grandes en el móvil).
function estiloFigura({ x, y }, medidas) {
  return {
    "--px": `${x}px`,
    "--py": `${y}px`,
    "--fw": `${medidas.ancho}px`,
    "--fh": `${medidas.alto}px`,
    "--fx": `${medidas.pieX}px`,
    "--fy": `${medidas.pieY}px`,
  };
}

const posicion = ({ x, y }) => ({ "--px": `${x}px`, "--py": `${y}px` });

// `night` y `rain` fuerzan la escena (vista previa); sin ellos se usa el tiempo real.
// `escena`: "clase" (profe con carro y dos alumnos) o "partido" (2 contra 2).
export default function WeatherCourt3D({ weather, night, rain, mojada = false, escena = "clase" }) {
  const stageRef = useRef(null);
  const areaRef = useRef(null);
  const courtRef = useRef(null);
  const rainRef = useRef(null);
  const figureRefs = useRef([]);
  const shadeRefs = useRef([]);
  const ballRefs = useRef([]);
  const ballShadowRefs = useRef([]);
  const geoRef = useRef({ rx: 58, rz: -28, k: 1 });
  const clockRef = useRef(null);
  const [inView, setInView] = useState(true);

  const datos = ESCENAS[escena] || ESCENAS.clase;
  const isNight = night ?? Number(weather?.isDay) === 0;
  const isRaining = rain ?? isRainy(weather || {});
  // Sin clase cuando llueve o la pista está mojada: no hay jugadores ni bolas y el bucle no hace falta.
  const sinClase = isRaining || mojada;

  // Fuera de pantalla no hay nada que animar: se pausan los bucles y las animaciones CSS.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Encaje: se mide la pista proyectada (losa, cristales y focos) y se escala y centra para
  // que quepa entera en su zona, sea cual sea la inclinación de cada pantalla. Va antes que
  // el bucle porque fija la inclinación y el tamaño de figuras que usa la escena.
  useEffect(() => {
    const area = areaRef.current;
    const court = courtRef.current;
    if (!area || !court) return undefined;

    const medir = (conLosa) => {
      const caja = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      const piezas = conLosa ? ".weatherCourt3dGround, .weatherCourtWall, .weatherCourtLight" : ".weatherCourtWall, .weatherCourtLight";
      court.querySelectorAll(piezas).forEach((pieza) => {
        const r = pieza.getBoundingClientRect();
        caja.left = Math.min(caja.left, r.left);
        caja.top = Math.min(caja.top, r.top);
        caja.right = Math.max(caja.right, r.right);
        caja.bottom = Math.max(caja.bottom, r.bottom);
      });
      return caja;
    };

    const fit = () => {
      const styles = getComputedStyle(court);
      geoRef.current = {
        rx: parseFloat(styles.getPropertyValue("--rx-base")) || 58,
        rz: parseFloat(styles.getPropertyValue("--rz-base")) || -28,
        k: parseFloat(styles.getPropertyValue("--fig-escala")) || 1,
      };
      const margen = parseFloat(styles.getPropertyValue("--court-margin")) || 12;
      // La losa cuenta siempre: la pista se ve entera, con su base, dentro del escenario.
      const conLosa = true;
      const zona = area.getBoundingClientRect();
      if (!zona.width || !zona.height) return;

      court.style.transition = "none";
      let scale = 1;
      let dx = 0;
      let dy = 0;
      // Dos pasadas: la perspectiva hace que el tamaño no sea del todo proporcional a la escala.
      for (let pasada = 0; pasada < 2; pasada += 1) {
        court.style.setProperty("--court-scale", scale.toFixed(4));
        court.style.setProperty("--court-dx", `${dx.toFixed(1)}px`);
        court.style.setProperty("--court-dy", `${dy.toFixed(1)}px`);
        const caja = medir(conLosa);
        const ancho = caja.right - caja.left;
        const alto = caja.bottom - caja.top;
        if (!ancho || !alto) break;
        const factor = Math.min((zona.width - margen * 2) / ancho, (zona.height - margen * 2) / alto);
        scale *= factor;
        dx += (zona.left + zona.width / 2 - (caja.left + caja.right) / 2) * factor;
        dy += (zona.top + zona.height / 2 - (caja.top + caja.bottom) / 2) * factor;
      }
      court.style.setProperty("--court-scale", scale.toFixed(4));
      court.style.setProperty("--court-dx", `${dx.toFixed(1)}px`);
      court.style.setProperty("--court-dy", `${dy.toFixed(1)}px`);
      court.getBoundingClientRect();
      court.style.transition = "";
    };

    const observer = new ResizeObserver(fit);
    observer.observe(area);
    fit();
    return () => observer.disconnect();
  }, []);

  // Bucle de la escena: el animador dice dónde está cada figura y cada bola en el instante t.
  useEffect(() => {
    if (sinClase) return undefined;
    const animar = datos.crearAnimador();
    const ultimas = [];

    const aplicar = (frame) => {
      frame.figuras.forEach((figura, index) => {
        const element = figureRefs.current[index];
        const shade = shadeRefs.current[index];
        if (!element || !shade) return;
        const x = figura.x.toFixed(1);
        const y = figura.y.toFixed(1);
        const antes = ultimas[index] || {};
        if (antes.x !== x || antes.y !== y) {
          [element, shade].forEach((el) => {
            el.style.setProperty("--px", `${x}px`);
            el.style.setProperty("--py", `${y}px`);
          });
        }
        if (antes.pose !== figura.pose) element.dataset.pose = figura.pose;
        ultimas[index] = { x, y, pose: figura.pose };
      });

      for (let index = 0; index < datos.pelotas; index += 1) {
        const ball = ballRefs.current[index];
        const shadow = ballShadowRefs.current[index];
        if (!ball || !shadow) continue;
        const bola = frame.pelotas[index];
        if (!bola) {
          ball.style.opacity = "0";
          shadow.style.opacity = "0";
          continue;
        }
        const { x, y, z, opacidad } = bola;
        const scale = Math.max(0.45, 1 - z / 260);
        ball.style.opacity = String(opacidad);
        ball.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${(z + 6).toFixed(1)}px) rotateZ(calc(var(--court-rz) * -1)) rotateX(calc(var(--court-rx) * -1))`;
        shadow.style.transform = `translate3d(${(x + z * 0.18).toFixed(1)}px, ${(y + z * 0.1).toFixed(1)}px, 2px) scale(${scale.toFixed(3)})`;
        shadow.style.opacity = String(scale * 0.62 * opacidad);
      }
    };

    // Movimiento reducido: una imagen fija bonita, con bolas en el aire.
    if (prefersReducedMotion()) {
      aplicar(animar(datos.instanteFijo, geoRef.current));
      return undefined;
    }
    if (!inView) return undefined;

    // El reloj de la escena se para fuera de pantalla y sigue donde lo dejó.
    if (clockRef.current === null) clockRef.current = datos.instanteFijo;
    const offset = performance.now() - clockRef.current;
    let frameId;
    const tick = (now) => {
      clockRef.current = now - offset;
      aplicar(animar(clockRef.current, geoRef.current));
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [inView, datos, sinClase]);

  useEffect(() => {
    const canvas = rainRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || !isRaining || !inView || prefersReducedMotion()) return undefined;

    const context = canvas.getContext("2d");
    let frameId;
    let drops = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drops = Array.from({ length: Math.max(26, Math.round(width / 8)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 7 + Math.random() * 12,
        speed: 6 + Math.random() * 7,
      }));
    };

    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const draw = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = isNight ? "rgba(195, 215, 255, 0.42)" : "rgba(210, 235, 225, 0.38)";
      context.lineWidth = 1;
      context.beginPath();
      drops.forEach((drop) => {
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - drop.length * 0.22, drop.y + drop.length);
        drop.x -= drop.speed * 0.2;
        drop.y += drop.speed;
        if (drop.y > height + 20) {
          drop.y = -20;
          drop.x = Math.random() * width;
        }
      });
      context.stroke();
      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isNight, isRaining, inView]);

  // El ratón inclina un poco la pista aunque el texto de la portada quede por encima.
  useEffect(() => {
    const court = courtRef.current;
    if (!court || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

    const handleMove = (event) => {
      const horizontal = event.clientX / window.innerWidth - 0.5;
      const vertical = event.clientY / window.innerHeight - 0.5;
      court.style.setProperty("--tilt-x", `${(-vertical * 8).toFixed(2)}deg`);
      court.style.setProperty("--tilt-z", `${(horizontal * 14).toFixed(2)}deg`);
    };
    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);

  return (
    <div
      className={`weatherCourt3d escena-${datos.id}${isNight ? " isNight" : ""}${isRaining ? " isRaining" : ""}${mojada && !isRaining ? " isWet" : ""}${inView ? "" : " isOffscreen"}`}
      ref={stageRef}
      aria-hidden="true"
    >
      <div className="weatherCourt3dSky" />
      <div className="weatherSun" />
      <div className="weatherMoon" />
      <div className="weatherStars">
        {STARS.map((star, index) => (
          <i key={index} style={{ left: `${star.left}%`, top: `${star.top}%`, animationDelay: `${star.delay}s` }} />
        ))}
      </div>
      <div className="weatherCloud cloudOne" />
      <div className="weatherCloud cloudTwo" />
      <div className="weatherCloud cloudThree" />
      <div className="weatherCourt3dArea" ref={areaRef}>
        <div className="weatherCourt3dCourt" ref={courtRef}>
          <div className="weatherCourt3dGround" />
          <div className="weatherCourt3dTurf">
            <svg viewBox="0 0 10 20" preserveAspectRatio="none" fill="none" stroke="#fff" strokeWidth=".07">
              <rect x=".035" y=".035" width="9.93" height="19.93" />
              <line x1="0" y1="3.05" x2="10" y2="3.05" />
              <line x1="0" y1="16.95" x2="10" y2="16.95" />
              <line x1="5" y1="3.05" x2="5" y2="16.95" />
            </svg>
            <span className="weatherCourtDark" />
            <span className="weatherCourtWet" />
          </div>
          <div className="weatherCourtWall weatherCourtWallTop" />
          <div className="weatherCourtWall weatherCourtWallBottom" />
          <div className="weatherCourtWall weatherCourtWallSide weatherCourtWallLeft" />
          <div className="weatherCourtWall weatherCourtWallSide weatherCourtWallRight" />
          <div className="weatherCourtNet" />
          {["lightOne", "lightTwo", "lightThree", "lightFour"].map((name) => (
            <div className={`weatherCourtLight ${name}`} key={name}>
              <i />
            </div>
          ))}
          {["lightOne", "lightTwo", "lightThree", "lightFour"].map((name) => (
            <span className={`weatherCourtBeam beam-${name}`} key={name} />
          ))}
          {datos.carro && (
            <>
              <i className="weatherCourtPlayerShade isCarro" style={posicion(datos.carro)} />
              <i className="weatherCourtPlayer weatherCourtCarro" style={estiloFigura(datos.carro, MEDIDAS_FIGURA.carro)}>
                <Carro />
              </i>
            </>
          )}
          {datos.figuras.map((figura, index) => (
            <Fragment key={figura.id}>
              <i
                className="weatherCourtPlayerShade"
                style={posicion(figura)}
                ref={(element) => {
                  shadeRefs.current[index] = element;
                }}
              />
              <i
                className={`weatherCourtPlayer is-${figura.tipo}`}
                data-pose="espera"
                style={estiloFigura(figura, figura.tipo === "profe" ? MEDIDAS_FIGURA.profe : MEDIDAS_FIGURA.figura)}
                ref={(element) => {
                  figureRefs.current[index] = element;
                }}
              >
                <FiguraSvg figura={figura} />
              </i>
            </Fragment>
          ))}
          {Array.from({ length: datos.pelotas }, (_, index) => (
            <Fragment key={index}>
              <span
                className="weatherCourtBallShadow"
                ref={(element) => {
                  ballShadowRefs.current[index] = element;
                }}
              />
              <span
                className="weatherCourtBall"
                ref={(element) => {
                  ballRefs.current[index] = element;
                }}
              />
            </Fragment>
          ))}
        </div>
      </div>
      <canvas className="weatherCourtRain" ref={rainRef} />
    </div>
  );
}
