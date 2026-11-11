import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../services/api";
import { iniciales, nombreCompleto } from "./panelUtils";

const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789"; // sin letras que se confunden (l, i, o, 0, 1)
const MIN_PASSWORD = 8;

function contrasenaTemporal() {
  const valores = new Uint32Array(12);
  window.crypto.getRandomValues(valores);
  const letras = Array.from(valores, (n) => ALFABETO[n % ALFABETO.length]);
  return [letras.slice(0, 4), letras.slice(4, 8), letras.slice(8, 12)].map((trozo) => trozo.join("")).join("-");
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function estadoAcceso(profesor) {
  if (!profesor.activo) return { texto: "Ficha desactivada", activo: false };
  if (profesor.tiene_acceso) return { texto: profesor.rol_acceso === "admin" ? "Cuenta de administración" : "Con acceso", activo: true };
  return { texto: "Sin acceso", activo: false };
}

export default function ProfesoresAcceso({ onAviso }) {
  const [profesores, setProfesores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [destino, setDestino] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [creado, setCreado] = useState(null);
  const [copiado, setCopiado] = useState("");
  const emailRef = useRef(null);
  const copiadoTimer = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setError("");
      const data = await apiGet("/api/gestion/profesores");
      setProfesores(data.profesores || []);
    } catch (e) {
      setError(e.message || "No se han podido cargar los profesores.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => () => clearTimeout(copiadoTimer.current), []);

  const abierto = Boolean(destino);
  const cerrar = useCallback(() => {
    setDestino(null);
    setCreado(null);
    setErrorForm("");
  }, []);

  // Esc cierra y el fondo no se desplaza mientras la ventana está abierta.
  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (event) => { if (event.key === "Escape" && !guardando) cerrar(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [abierto, guardando, cerrar]);

  useEffect(() => {
    if (abierto && !creado) emailRef.current?.focus({ preventScroll: true });
  }, [abierto, creado]);

  const abrirCrear = (profesor) => {
    setDestino(profesor);
    setForm({ email: profesor.email || "", password: contrasenaTemporal() });
    setErrorForm("");
    setCreado(null);
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!destino) return;
    const email = form.email.trim();
    if (form.password.length < MIN_PASSWORD) {
      setErrorForm(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    try {
      setGuardando(true);
      setErrorForm("");
      await apiPost(`/api/gestion/profesores/${destino.id}/crear-acceso`, { email, password: form.password });
      // La contraseña solo se conserva aquí, en pantalla, para dársela al profesor una vez.
      setCreado({ email: email.toLowerCase(), password: form.password });
      setForm({ email: "", password: "" });
      onAviso?.(`${nombreCompleto(destino)} ya puede entrar en la web.`);
      cargar();
    } catch (e) {
      setErrorForm(e.message || "No se ha podido crear el acceso. Vuelve a intentarlo.");
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async (clave, texto) => {
    const ok = await copiarTexto(texto);
    setCopiado(ok ? clave : "");
    clearTimeout(copiadoTimer.current);
    copiadoTimer.current = setTimeout(() => setCopiado(""), 2500);
  };

  return (
    <section className="ppSection" aria-labelledby="pp-profesores-title">
      <div className="ppSectionHead">
        <h2 id="pp-profesores-title">Profesores</h2>
        <p>Cada profesor necesita su acceso a la web para pasar lista. Después vincula su Telegram desde su propio panel.</p>
      </div>

      {error && (
        <p className="ppInlineError ppLoadError" role="alert">
          <span>{error}</span>
          <button type="button" className="ppBtn ppBtnSmall" onClick={cargar}>Reintentar</button>
        </p>
      )}

      {cargando && !error && <p className="ppMuted" role="status">Cargando profesores...</p>}

      {!cargando && !error && profesores.length === 0 && <p className="ppEmpty">Todavía no hay profesores dados de alta.</p>}

      {profesores.length > 0 && (
        <ul className="ppPeople">
          {profesores.map((profesor) => {
            const acceso = estadoAcceso(profesor);
            return (
              <li className="ppPeopleRow ppProfeRow" key={profesor.id}>
                <div className="ppPerson">
                  <span className="ppAvatar" aria-hidden="true">{iniciales(profesor)}</span>
                  <span className="ppPersonText">
                    <strong>{nombreCompleto(profesor)}</strong>
                    <small>{profesor.email || "Sin email"}</small>
                  </span>
                </div>
                <div className="ppProfeEstado">
                  <span className={`ppTag ${acceso.activo ? "isOn" : ""}`}>{acceso.texto}</span>
                  {profesor.activo && profesor.tiene_acceso && (
                    <span className={`ppTag ${profesor.telegram_vinculado ? "isOn" : ""}`}>
                      {profesor.telegram_vinculado
                        ? (profesor.telegram_username ? `Telegram vinculado @${profesor.telegram_username}` : "Telegram vinculado")
                        : "Telegram sin vincular"}
                    </span>
                  )}
                </div>
                {profesor.activo && !profesor.tiene_acceso && (
                  <div className="ppRowActions">
                    <button type="button" className="ppBtn ppBtnPrimary" onClick={() => abrirCrear(profesor)}>Crear acceso</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {abierto && (
        <div className="ppBackdrop">
          {creado ? (
            <div className="ppModal ppModalNarrow" role="dialog" aria-modal="true" aria-labelledby="pp-pacceso-title">
              <div className="ppSheetHead">
                <h2 id="pp-pacceso-title">Acceso creado</h2>
              </div>
              <p>Dale a <strong>{nombreCompleto(destino)}</strong> estos datos. Podrá cambiar la contraseña en Perfil, «Cambiar contraseña».</p>
              <dl className="ppCredenciales">
                <div>
                  <dt>Email</dt>
                  <dd><code>{creado.email}</code></dd>
                  <button type="button" className="ppBtn ppBtnSmall" onClick={() => copiar("email", creado.email)}>{copiado === "email" ? "¡Copiado!" : "Copiar"}</button>
                </div>
                <div>
                  <dt>Contraseña temporal</dt>
                  <dd><code>{creado.password}</code></dd>
                  <button type="button" className="ppBtn ppBtnSmall" onClick={() => copiar("password", creado.password)}>{copiado === "password" ? "¡Copiado!" : "Copiar"}</button>
                </div>
              </dl>
              <p className="ppNotice ppNoticeWarn" role="note">Esta contraseña solo se muestra ahora. Apúntala o cópiala antes de cerrar.</p>
              <div className="ppModalActions">
                <button type="button" className="ppBtn ppBtnPrimary" onClick={cerrar}>Hecho</button>
              </div>
            </div>
          ) : (
            <form className="ppModal ppModalNarrow" role="dialog" aria-modal="true" aria-labelledby="pp-pacceso-title" onSubmit={guardar}>
              <div className="ppSheetHead">
                <h2 id="pp-pacceso-title">Crear acceso para {nombreCompleto(destino)}</h2>
                <button type="button" className="ppBtn ppBtnSmall" onClick={cerrar} disabled={guardando}>Cerrar</button>
              </div>
              <p className="ppFieldNote">Escribe su email. La contraseña es temporal: la proponemos nosotros y se la das tú.</p>
              <div className="ppFormGrid ppFormOne">
                <label className="ppField">
                  <span>Email</span>
                  <input ref={emailRef} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </label>
                <label className="ppField">
                  <span>Contraseña temporal (mínimo {MIN_PASSWORD} caracteres)</span>
                  <input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={MIN_PASSWORD} required />
                </label>
                <div>
                  <button type="button" className="ppBtn ppBtnSmall" onClick={() => setForm({ ...form, password: contrasenaTemporal() })} disabled={guardando}>Proponer otra contraseña</button>
                </div>
              </div>
              {errorForm && <p className="ppInlineError" role="alert">{errorForm}</p>}
              <div className="ppModalActions">
                <button type="button" className="ppBtn" onClick={cerrar} disabled={guardando}>Cancelar</button>
                <button type="submit" className="ppBtn ppBtnPrimary" disabled={guardando}>{guardando ? "Creando..." : "Crear acceso"}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
