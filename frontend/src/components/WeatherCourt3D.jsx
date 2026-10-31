import { useEffect, useRef } from "react";
import "./weatherCourt3d.css";

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function WeatherCourt3D({ weather }) {
  const stageRef = useRef(null);
  const courtRef = useRef(null);
  const ballRef = useRef(null);
  const shadowRef = useRef(null);
  const rainRef = useRef(null);

  const isNight = Number(weather?.isDay) === 0;
  const isRaining =
    RAIN_CODES.has(Number(weather?.weatherCode)) ||
    Number(weather?.precipitationProbability || 0) >= 50;

  useEffect(() => {
    const ball = ballRef.current;
    const shadow = shadowRef.current;
    if (!ball || !shadow || prefersReducedMotion()) return undefined;

    let frameId;
    let direction = 1;
    let shot = {
      from: { x: 76, y: 286 },
      to: { x: 108, y: 62 },
      startedAt: performance.now(),
      duration: 1150,
      height: 76,
    };

    const nextShot = (from, now) => {
      direction *= -1;
      shot = {
        from,
        to: {
          x: 28 + Math.random() * 104,
          y: direction > 0 ? 48 + Math.random() * 86 : 188 + Math.random() * 94,
        },
        startedAt: now,
        duration: 950 + Math.random() * 360,
        height: 58 + Math.random() * 42,
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
      const z = 4 * shot.height * progress * (1 - progress) + 5;
      const scale = Math.max(0.48, 1 - z / 210);

      ball.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
      shadow.style.transform = `translate3d(${x + z * 0.18}px, ${y + z * 0.1}px, 2px) scale(${scale})`;
      shadow.style.opacity = String(scale * 0.62);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
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
    };
  }, [isNight, isRaining]);

  const handlePointerMove = (event) => {
    if (!courtRef.current || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = event.clientX / rect.width - rect.left / rect.width - 0.5;
    const vertical = event.clientY / rect.height - rect.top / rect.height - 0.5;
    courtRef.current.style.setProperty("--court-rx", `${58 - vertical * 7}deg`);
    courtRef.current.style.setProperty("--court-rz", `${-27 + horizontal * 10}deg`);
  };

  const resetPointer = () => {
    courtRef.current?.style.removeProperty("--court-rx");
    courtRef.current?.style.removeProperty("--court-rz");
  };

  return (
    <div
      className={`weatherCourt3d${isNight ? " isNight" : ""}${isRaining ? " isRaining" : ""}`}
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-hidden="true"
    >
      <div className="weatherCourt3dSky" />
      <div className="weatherCourt3dCourt" ref={courtRef}>
        <div className="weatherCourt3dSlab" />
        <div className="weatherCourt3dTurf">
          <span className="weatherCourtLine weatherCourtLineCenter" />
          <span className="weatherCourtLine weatherCourtLineTop" />
          <span className="weatherCourtLine weatherCourtLineBottom" />
          <span className="weatherCourtWet" />
        </div>
        <div className="weatherCourtWall weatherCourtWallTop" />
        <div className="weatherCourtWall weatherCourtWallBottom" />
        <div className="weatherCourtWall weatherCourtWallLeft" />
        <div className="weatherCourtWall weatherCourtWallRight" />
        <div className="weatherCourtNet" />
        <div className="weatherCourtLight lightOne"><i /></div>
        <div className="weatherCourtLight lightTwo"><i /></div>
        <div className="weatherCourtLight lightThree"><i /></div>
        <div className="weatherCourtLight lightFour"><i /></div>
        <span className="weatherCourtBall" ref={ballRef} />
        <span className="weatherCourtBallShadow" ref={shadowRef} />
      </div>
      <canvas className="weatherCourtRain" ref={rainRef} />
    </div>
  );
}
