import { useEffect, useRef } from "react";
import { isRainy } from "../services/weatherService";
import "./weatherCourt3d.css";

const STARS = Array.from({ length: 18 }, (_, index) => ({
  left: (index * 53) % 100,
  top: (index * 29) % 46,
  delay: (index % 6) * 0.45,
}));

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// `night` y `rain` fuerzan la escena (vista previa); sin ellos se usa el tiempo real.
export default function WeatherCourt3D({ weather, night, rain }) {
  const stageRef = useRef(null);
  const areaRef = useRef(null);
  const courtRef = useRef(null);
  const ballRef = useRef(null);
  const shadowRef = useRef(null);
  const rainRef = useRef(null);

  const isNight = night ?? Number(weather?.isDay) === 0;
  const isRaining = rain ?? isRainy(weather || {});

  useEffect(() => {
    const ball = ballRef.current;
    const shadow = shadowRef.current;
    if (!ball || !shadow || prefersReducedMotion()) return undefined;

    let frameId;
    let direction = 1;
    let shot = {
      from: { x: 150, y: 520 },
      to: { x: 190, y: 130 },
      startedAt: performance.now(),
      duration: 1150,
      height: 80,
    };

    const nextShot = (from, now) => {
      direction *= -1;
      shot = {
        from,
        to: {
          x: 40 + Math.random() * 220,
          y: direction > 0 ? 60 + Math.random() * 200 : 340 + Math.random() * 200,
        },
        startedAt: now,
        duration: 950 + Math.random() * 360,
        height: 60 + Math.random() * 50,
      };
    };

    const animate = (now) => {
      let progress = (now - shot.startedAt) / shot.duration;
      if (progress >= 1) {
        nextShot(shot.to, now);
        progress = 0;
      }

      const x = shot.from.x + (shot.to.x - shot.from.x) * progress;
      const y = shot.from.y + (shot.to.y - shot.from.y) * progress;
      const z = 4 * shot.height * progress * (1 - progress) + 6;
      const scale = Math.max(0.45, 1 - z / 260);

      ball.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
      shadow.style.transform = `translate3d(${x + z * 0.18}px, ${y + z * 0.1}px, 2px) scale(${scale})`;
      shadow.style.opacity = String(scale * 0.62);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const area = areaRef.current;
    const court = courtRef.current;
    if (!area || !court) return undefined;

    const fit = () => {
      const scale = Math.min(area.clientHeight / 830, area.clientWidth / 600);
      court.style.setProperty("--court-scale", scale.toFixed(3));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    fit();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = rainRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || !isRaining || prefersReducedMotion()) return undefined;

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
  }, [isNight, isRaining]);

  // El ratón inclina la pista aunque el texto de la portada quede por encima.
  useEffect(() => {
    const court = courtRef.current;
    if (!court || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return undefined;

    const handleMove = (event) => {
      const horizontal = event.clientX / window.innerWidth - 0.5;
      const vertical = event.clientY / window.innerHeight - 0.5;
      court.style.setProperty("--court-rx", `${58 - vertical * 8}deg`);
      court.style.setProperty("--court-rz", `${-28 + horizontal * 14}deg`);
    };
    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);

  return (
    <div
      className={`weatherCourt3d${isNight ? " isNight" : ""}${isRaining ? " isRaining" : ""}`}
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
          <span className="weatherCourtBall" ref={ballRef} />
          <span className="weatherCourtBallShadow" ref={shadowRef} />
        </div>
      </div>
      <canvas className="weatherCourtRain" ref={rainRef} />
    </div>
  );
}
