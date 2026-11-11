import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../services/api";

const SONDEO_MS = 4000;

function cuentaAtras(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(campo);
    return ok;
  }
}

/**
 * Bloque "Pasar lista por Telegram": genera el código de vinculación, lo explica paso a paso
 * y detecta solo cuándo el profesor ya ha enlazado su chat.
 */
export default function TelegramPasarLista({ onAviso, esAdmin = false }) {
  const [estado, setEstado] = useState(null);
  const [errorEstado, setErrorEstado] = useState("");
  const [codigo, setCodigo] = useState(null);
  const [caduca, setCaduca] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const copiadoTimer = useRef(null);

  const cargarEstado = useCallback(async () => {
    try {
      const data = await apiGet("/api/gestion/telegram/estado");
      setEstado(data);
      setErrorEstado("");
      return data;
    } catch (e) {
      setErrorEstado(e.message || "No se ha podido comprobar Telegram.");
      return null;
    }
  }, []);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);
  useEffect(() => () => clearTimeout(copiadoTimer.current), []);

  const activo = Boolean(codigo) && ahora < caduca;
  const caducado = Boolean(codigo) && !activo;

  // Cuenta atrás y comprobación periódica mientras el código está vigente.
  useEffect(() => {
    if (!codigo) return undefined;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [codigo]);

  useEffect(() => {
    if (!activo) return undefined;
    const sondeo = setInterval(async () => {
      const data = await cargarEstado();
      if (data?.vinculado) {
        setCodigo(null);
        onAviso?.(data.telegram_username ? `Telegram vinculado como @${data.telegram_username}.` : "Telegram vinculado.");
      }
    }, SONDEO_MS);
    return () => clearInterval(sondeo);
  }, [activo, cargarEstado, onAviso]);

  const generar = async () => {
    try {
      setOcupado(true);
      setError("");
      const data = await apiPost("/api/gestion/control/telegram/link-code", {});
      setCodigo(data);
      setCaduca(Date.now() + Number(data.expires_in_minutes || 10) * 60 * 1000);
      setAhora(Date.now());
      setCopiado(false);
      setEstado((actual) => ({ ...(actual || {}), bot_username: data.bot_username || actual?.bot_username || null }));
    } catch (e) {
      setError(e.message || "No se ha podido generar el código. Vuelve a intentarlo.");
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async () => {
    if (!codigo) return;
    const ok = await copiarTexto(codigo.command);
    setCopiado(ok);
    if (!ok) setError("No se ha podido copiar. Selecciona el código y cópialo a mano.");
    clearTimeout(copiadoTimer.current);
    copiadoTimer.current = setTimeout(() => setCopiado(false), 2500);
  };

  const bot = codigo?.bot_username || estado?.bot_username;
  const vinculado = Boolean(estado?.vinculado);
  const sinFicha = estado && estado.tiene_ficha === false;

  return (
    <section className="ppSection ppTelegramCard" aria-labelledby="pp-telegram-title">
      <div className="ppSectionHead">
        <h2 id="pp-telegram-title">Pasar lista por Telegram</h2>
        <p>Pasa lista desde el móvil, sin abrir la web: el bot te muestra tus clases y tú tocas quién ha venido.</p>
      </div>

      {errorEstado && !estado && (
        <p className="ppInlineError" role="alert">
          <span>{errorEstado}</span>
          <button type="button" className="ppBtn ppBtnSmall" onClick={cargarEstado}>Reintentar</button>
        </p>
      )}

      {!estado && !errorEstado && <p className="ppMuted" role="status">Comprobando Telegram...</p>}

      {sinFicha && (
        <div className="ppNotice ppNoticeWarn" role="note">
          <strong>{esAdmin ? "Tu cuenta de administración no está enlazada a una ficha de profesor." : "Tu usuario aún no está unido a tu ficha de profesor."}</strong>
          <span>{esAdmin
            ? "Para pasar lista tú también, tu cuenta tiene que estar enlazada a una ficha de profesor activa."
            : "Pide a la administración que lo una y vuelve a entrar."}</span>
        </div>
      )}

      {estado && !sinFicha && (
        <div className="ppTelegramStatus" aria-live="polite">
          {vinculado ? (
            <span className="ppTag isOn">
              {estado.telegram_username ? `Vinculado como @${estado.telegram_username}` : "Telegram vinculado"}
            </span>
          ) : (
            <span className="ppTag">Telegram sin vincular</span>
          )}
        </div>
      )}

      {estado && !sinFicha && vinculado && !codigo && (
        <p className="ppTelegramHow">
          Abre el chat con el bot y escribe <strong>/hoy</strong>. Si te pierdes, escribe <strong>/ayuda</strong>.
        </p>
      )}

      {error && <p className="ppInlineError" role="alert">{error}</p>}

      {estado && !sinFicha && !codigo && (
        <div>
          <button type="button" className={`ppBtn ${vinculado ? "" : "ppBtnPrimary"}`} onClick={generar} disabled={ocupado}>
            {ocupado ? "Generando..." : vinculado ? "Vincular otro Telegram" : "Generar código"}
          </button>
        </div>
      )}

      {codigo && (
        <div className="ppTelegramSteps">
          <ol className="ppSteps">
            <li>
              <span>
                Abre Telegram y busca <strong>{bot ? `@${bot}` : "el bot de la escuela"}</strong>.
                {codigo.link && <> O toca el botón de abajo.</>}
              </span>
            </li>
            <li>
              <span>Pulsa <strong>Iniciar</strong> y envía el mensaje con el código que ves debajo (cópialo con el botón).</span>
            </li>
            <li>
              <span>Cuando se una, aquí aparecerá <strong>Vinculado</strong>. Después escribe <strong>/hoy</strong> en el chat.</span>
            </li>
          </ol>

          {activo ? (
            <div className="ppTelegramCode">
              <code aria-label="Código para enviar al bot">{codigo.command}</code>
              <div className="ppTelegramActions">
                <button type="button" className="ppBtn ppBtnPrimary" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar mensaje"}</button>
                {codigo.link && (
                  <a className="ppBtn" href={codigo.link} target="_blank" rel="noreferrer">Abrir Telegram</a>
                )}
              </div>
              <p className="ppMuted" role="timer" aria-live="off">
                Vale una sola vez. Caduca en <strong>{cuentaAtras(caduca - ahora)}</strong>.
              </p>
            </div>
          ) : (
            caducado && (
              <div className="ppNotice ppNoticeWarn" role="status">
                <strong>El código ha caducado.</strong>
                <span>Genera uno nuevo y envíalo antes de que pasen 10 minutos.</span>
              </div>
            )
          )}

          <div>
            <button type="button" className="ppBtn" onClick={generar} disabled={ocupado}>
              {ocupado ? "Generando..." : activo ? "Generar otro código" : "Generar código nuevo"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
