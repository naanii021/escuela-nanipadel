import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { getWeatherForClub } from "../services/weatherService";
import { cuandoTexto } from "../services/estadoPista";
import LineaAgua from "../components/LineaAgua";
import { getSerieAgua } from "../components/lineaAguaDatos";
import "./estadoPista.css";

const CLUB_LAT = 39.483017;
const CLUB_LON = -6.364445;
const COURT_PHOTOS_MANIFEST = `${process.env.PUBLIC_URL}/court-photos-manifest.json`;

const MOTIVOS_LARGOS = {
  Lluvia: "lluvia",
  Mojada: "pista mojada",
  Agua: "agua en la pista",
  Viento: "viento",
  Tormenta: "tormenta",
};

function formatUpdatedAt(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function minutesAgo(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function isRecentReading(value) {
  const m = minutesAgo(value);
  return m !== null && m < 15;
}

function num(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value}${suffix}`;
  return `${String(Math.round(n * 10) / 10).replace(".", ",")}${suffix}`;
}

function mmTexto(v) {
  return v >= 10 ? `${Math.round(v)} mm` : `${v.toFixed(1).replace(".", ",")} mm`;
}

function horasTexto(h) {
  return h <= 1 ? "1 hora" : `${h} horas`;
}

// Frase corta sobre cuánto falta para poder jugar, a partir de la serie de 48 h.
function resumenAgua(serie, playability) {
  if (!serie?.horas?.length || !playability) return null;
  const { horas, secaA } = serie;
  if (playability.playable) {
    const mala = horas.findIndex((h) => !h.playable);
    if (mala < 0) return { titulo: "Se puede jugar en las próximas 48 horas", detalle: "No se espera lluvia ni agua en la pista." };
    const h = horas[mala];
    return {
      titulo: "Ahora se puede jugar",
      detalle: `Ojo: ${cuandoTexto(h.time, horas[0].time)} dejará de poder (${MOTIVOS_LARGOS[h.motivoCorto] || "mal tiempo"}).`,
    };
  }
  const iSeca = secaA ? horas.findIndex((h) => h.time === secaA) : -1;
  if (iSeca > 0) {
    return {
      titulo: `Se podrá jugar en unas ${horasTexto(iSeca)}`,
      detalle: `La pista se secará hacia ${cuandoTexto(secaA, horas[0].time)}.`,
    };
  }
  return { titulo: "Hoy no se podrá jugar", detalle: playability.secaTexto || "La pista no se secará en las próximas 48 horas." };
}

function EstadoPista() {
  const [weather, setWeather] = useState(null);
  const [serie, setSerie] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPageData() {
      try {
        setLoading(true);
        setError("");

        const [weatherResult, serieResult, sensorResult, photosResponse] = await Promise.all([
          getWeatherForClub(CLUB_LAT, CLUB_LON).then((data) => ({ ok: true, data })).catch((err) => ({ ok: false, err })),
          getSerieAgua(CLUB_LAT, CLUB_LON).catch(() => null),
          apiGet("/api/meteo-xiao/latest").then((data) => ({ ok: true, data })).catch(() => ({ ok: false })),
          fetch(COURT_PHOTOS_MANIFEST, { cache: "no-store" }).catch(() => null),
        ]);

        if (!mounted) return;

        if (weatherResult.ok) setWeather(weatherResult.data);
        else setError(weatherResult.err?.message || "No hemos podido cargar el tiempo.");

        setSerie(serieResult);
        setSensor(sensorResult.ok ? sensorResult.data?.meteo || null : null);

        if (photosResponse?.ok) {
          const manifest = await photosResponse.json();
          setPhotos(Array.isArray(manifest.photos) ? manifest.photos : []);
        } else {
          setPhotos([]);
        }
      } catch (err) {
        if (mounted) setError(err.message || "No hemos podido cargar el estado de la pista.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const playability = weather?.playability || null;
  const playable = playability ? playability.playable : null;
  const stateClass = playable === null ? "isPending" : playable ? "isOk" : "isNo";
  let verdict = "Consultando el tiempo…";
  if (error) verdict = "No hemos podido ver el tiempo";
  else if (playable === true) verdict = "Hoy se puede jugar";
  else if (playable === false) verdict = "Hoy mejor no jugar";

  const agua = playability?.aguaMm ?? 0;
  const aguaTexto = playability ? (agua > 1 ? mmTexto(agua) : "Seca") : "-";
  const resumen = resumenAgua(serie, playability);
  const horasTarjetas = serie?.horas?.length ? serie.horas.slice(0, 24) : weather?.hourly || [];

  const sensorReciente = sensor && isRecentReading(sensor.creado_en);
  const sensorMinutos = sensorReciente ? minutesAgo(sensor.creado_en) : null;
  const sensorAviso = sensorReciente
    ? Number(sensor.humedad) > 80
      ? "El sensor marca mucha humedad: puede haber agua o rocío en la pista."
      : Number(sensor.bateria_porcentaje) < 20
        ? "Al sensor le queda poca batería."
        : ""
    : "";

  const datos = [
    { label: "Temperatura", value: weather ? `${Math.round(weather.temperature)}°` : "-", nota: weather ? `Sensación ${Math.round(weather.apparentTemperature)}°` : "" },
    { label: "Viento", value: weather?.windSpeed != null ? `${Math.round(weather.windSpeed)} km/h` : "-", nota: Number(weather?.windSpeed) >= 30 ? "Fuerte" : Number(weather?.windSpeed) >= 20 ? "Moderado" : "Flojo" },
    { label: "Lluvia", value: weather?.precipitationProbability != null ? `${weather.precipitationProbability}%` : "-", nota: "Probabilidad" },
    { label: "Agua en la pista", value: aguaTexto, nota: agua > 1 ? "Hay que esperar" : "Sin charcos" },
    { label: "Humedad", value: weather ? `${weather.humidity}%` : "-", nota: "Del aire" },
    { label: "Sol (UV)", value: weather?.uvIndex != null ? num(weather.uvIndex) : "-", nota: Number(weather?.uvIndex) >= 6 ? "Alto: crema" : "Bajo" },
  ];

  const rec = weather?.recomendacion;
  const showRec = rec && playable === true;
  const vistaTarde = (day) => new Date(`${day.date}T12:00:00`);

  return (
    <section className="estadoPistaPage">
      <section className={`epVeredicto ${stateClass}`} aria-labelledby="ep-titulo">
        <span className="epEyebrow">Tiempo y pista</span>
        <h1 id="ep-titulo" className="epTitulo">
          <span className="epIcono" aria-hidden="true">
            {playable === false ? (
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : playable === true ? (
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.6" /></svg>
            )}
          </span>
          {verdict}
        </h1>
        <p className="epMotivo" aria-live="polite">
          {loading
            ? "Un momento, estamos mirando el tiempo y la pista."
            : error
              ? "Prueba de nuevo en unos minutos o llama al club."
              : playability?.reason
                ? `${playability.reason.replace(/\.$/, "")}.`
                : "Mira la lluvia y el viento antes de salir hacia el club."}
        </p>

        {showRec && (
          <p className={`epConsejo rec-${rec.nivel}`}>
            <strong>{rec.titulo}.</strong> {rec.mensaje}
          </p>
        )}

        <div className="epAcciones">
          <Link className="btn btn-primary" to="/reservas">
            {playable === false ? "Reservar otro día" : "Reservar pista"}
          </Link>
          <Link className="epEnlace" to="/">
            Volver al inicio
          </Link>
        </div>
      </section>

      {resumen && (
        <section className="epTarjeta epAgua" aria-labelledby="ep-agua">
          <span className="epSeccion">Agua en la pista</span>
          <h2 id="ep-agua">{resumen.titulo}</h2>
          <p className="epSub">{resumen.detalle}</p>
          <LineaAgua horas={serie.horas} secaA={serie.secaA} />
        </section>
      )}

      {horasTarjetas.length > 0 && (
        <section className="epHoras" aria-labelledby="ep-horas">
          <h2 id="ep-horas" className="epH2">Hora a hora</h2>
          <ol className="epHorasLista">
            {horasTarjetas.map((h) => (
              <li key={h.time} className={h.playable ? "isOk" : "isNo"}>
                <span className="epHoraH">{String(h.time).slice(11, 16)}</span>
                <i aria-hidden="true">{h.playable ? "✓" : "✕"}</i>
                <strong>{h.playable ? "Se puede" : h.motivoCorto || "No"}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="epTarjeta epAhora" aria-labelledby="ep-ahora">
        <div className="epAhoraCab">
          <div>
            <span className="epSeccion">Ahora mismo</span>
            <h2 id="ep-ahora">{weather ? weather.description : "Cargando…"}</h2>
          </div>
          {weather && (
            <span className="epEmoji" aria-hidden="true">{weather.emoji}</span>
          )}
        </div>
        <div className="epDatos">
          {datos.map((d) => (
            <article key={d.label} className="epDato">
              <span>{d.label}</span>
              <strong>{d.value}</strong>
              {d.nota && <small>{d.nota}</small>}
            </article>
          ))}
        </div>
        {weather && <p className="epActualizado">Actualizado a las {formatUpdatedAt(weather.updatedAt)}</p>}
      </section>

      {sensorReciente && (
        <section className="epTarjeta epSensor" aria-labelledby="ep-sensor">
          <div className="epAhoraCab">
            <div>
              <span className="epSeccion">Medido en la pista</span>
              <h2 id="ep-sensor">Sensor del club</h2>
            </div>
            <span className="epPildora">{sensorMinutos < 2 ? "Ahora mismo" : `Hace ${sensorMinutos} min`}</span>
          </div>
          <div className="epDatos epDatosDos">
            <article className="epDato">
              <span>Temperatura</span>
              <strong>{num(sensor.temperatura, "°")}</strong>
            </article>
            <article className="epDato">
              <span>Humedad</span>
              <strong>{num(sensor.humedad, "%")}</strong>
            </article>
          </div>
          {sensorAviso && <p className="epAviso">{sensorAviso}</p>}
        </section>
      )}

      <section className="epSemana" aria-labelledby="ep-semana">
        <h2 id="ep-semana" className="epH2">Próximos 7 días</h2>
        {weather?.forecast?.length ? (
          <ol className="epDias">
            {weather.forecast.map((day, i) => (
              <li key={day.date} className="epDia">
                <span className="epDiaNombre">
                  {i === 0 ? "Hoy" : vistaTarde(day).toLocaleDateString("es-ES", { weekday: "long" })}
                  <small>{vistaTarde(day).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small>
                </span>
                <span className="epDiaIcono" aria-hidden="true">{day.emoji}</span>
                <span className="epDiaTexto">{day.description}</span>
                <span className="epDiaLluvia">
                  {day.precipitationProbability != null ? `Lluvia ${day.precipitationProbability}%` : ""}
                </span>
                <span className="epDiaTemp">
                  <strong>{Math.round(day.tempMax)}°</strong> / {Math.round(day.tempMin)}°
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="epVacio">La previsión aparecerá aquí cuando haya datos.</p>
        )}
      </section>

      <section className="epTarjeta epConsejos" aria-labelledby="ep-consejos">
        <h2 id="ep-consejos" className="epH2">Antes de salir de casa</h2>
        <ul>
          <li>Mira la lluvia y el viento un rato antes de salir.</li>
          <li>Con calor, bebe agua y evita las horas centrales.</li>
          <li>Con frío, calienta unos minutos más.</li>
          <li>Si dudas, llama al club antes de reservar.</li>
        </ul>
      </section>

      {photos.length > 0 && (
        <section className="epFotos" aria-labelledby="ep-fotos">
          <h2 id="ep-fotos" className="epH2">Las pistas</h2>
          <div className="epFotosGrid">
            {photos.map((photo) => (
              <article className="epFoto" key={photo.id}>
                <img src={photo.src} alt={photo.title} loading="lazy" />
                <div>
                  <strong>{photo.title}</strong>
                  <p>{photo.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default EstadoPista;
