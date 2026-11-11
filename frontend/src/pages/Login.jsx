import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getUser, isLogged, login, logout, registro, safeReturnPath, saveSession } from "../services/auth";
import { buildClubPhoneUrl, buildClubWhatsappUrl, clubPhoneLabel } from "../services/whatsappLinks";
import "./login.css";

const STAFF_ROLES = ["profesor", "profe", "admin"];
const MIN_PASSWORD = 8;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MENSAJE_LOGIN = "Ese email o esa contraseña no son correctos. Revísalos con el botón «Ver» o pide ayuda si no recuerdas la contraseña.";

const LOGO = `${process.env.PUBLIC_URL}/fotosLogo/iconoweb.jpeg`;

// El foco automático solo se pone en ordenadores: en el móvil abriría el teclado sin que se pida.
const esPuntero = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

function Marca() {
  return (
    <div className="loginMarca">
      <img className="loginLogo" src={LOGO} alt="" width="56" height="56" />
      <div>
        <strong>NaniPadel</strong>
        <span>Escuela de pádel</span>
      </div>
    </div>
  );
}

function Ilustracion() {
  return (
    <svg className="loginPista" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="228" height="138" rx="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <line x1="120" y1="6" x2="120" y2="144" stroke="currentColor" strokeWidth="2.5" />
      <line x1="46" y1="6" x2="46" y2="144" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      <line x1="194" y1="6" x2="194" y2="144" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      <line x1="46" y1="75" x2="194" y2="75" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      <circle className="loginBola" cx="150" cy="40" r="9" fill="#b8ee58" />
    </svg>
  );
}

function Campo({ id, label, opcional, error, ayuda, children }) {
  return (
    <div className={`field${error ? " fieldError" : ""}`}>
      <label htmlFor={id}>
        {label} {opcional && <span className="fieldOptional">(opcional)</span>}
      </label>
      {ayuda && <p id={`${id}-ayuda`} className="fieldAyuda">{ayuda}</p>}
      {children}
      {error && <p id={`${id}-error`} className="fieldMsg" role="alert">{error}</p>}
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = safeReturnPath(searchParams.get("volver"));
  const reason = returnPath ? searchParams.get("motivo") : "";
  const sessionExpired = searchParams.get("sesion") === "caducada";

  const [mode, setMode] = useState("login");
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", password: "" });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [visible, setVisible] = useState(false);
  const formRef = useRef(null);
  const errorRef = useRef(null);

  const esRegistro = mode === "registro";

  // Foco al primer campo: al abrir y al cambiar de pestaña/paso, solo con ratón o teclado.
  useEffect(() => {
    if (isLogged()) return;
    if (!esPuntero()) return;
    formRef.current?.querySelector("input")?.focus({ preventScroll: true });
  }, [mode, paso]);

  // El aviso puede quedar tapado por la barra inferior del móvil: se acerca a la vista.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: "" }));
    if (error) setError("");
  };

  const cambiarModo = (siguiente) => {
    if (siguiente === mode) return;
    setMode(siguiente);
    setPaso(1);
    setErrores({});
    setError("");
    setShowHelp(false);
  };

  const fallo = (nuevos) => {
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0];
    requestAnimationFrame(() => document.getElementById(`login-${primero}`)?.focus());
  };

  const validarDatos = () => {
    const e = {};
    if (esRegistro && !form.nombre.trim()) e.nombre = "Escribe tu nombre y apellidos.";
    if (!form.email.trim()) e.email = "Escribe tu email.";
    else if (!EMAIL_OK.test(form.email.trim())) e.email = "Revisa el email: parece que le falta algo, como la @ o el «.com».";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError("");

    const e = validarDatos();
    if (Object.keys(e).length) {
      if (esRegistro && paso === 2) setPaso(1);
      fallo(e);
      return;
    }
    if (esRegistro && paso === 1) {
      setErrores({});
      setPaso(2);
      return;
    }
    if (!form.password.trim()) {
      fallo({ password: "Escribe tu contraseña." });
      return;
    }
    if (esRegistro && form.password.length < MIN_PASSWORD) {
      fallo({ password: `Tiene que tener al menos ${MIN_PASSWORD} caracteres. Ahora tiene ${form.password.length}.` });
      return;
    }

    setErrores({});
    setLoading(true);

    try {
      const data = mode === "login"
        ? await login(form.email.trim(), form.password)
        : await registro(form.nombre.trim(), form.email.trim(), form.telefono.trim(), form.password);

      if (!data.ok) {
        // Al entrar nunca se distingue entre «no existe» y «contraseña mala».
        setError(mode === "login" ? MENSAJE_LOGIN : (data.message || "No hemos podido crear la cuenta. Inténtalo de nuevo."));
        return;
      }

      saveSession(data.token, data.user);

      if (returnPath) navigate(returnPath, { replace: true });
      else if (STAFF_ROLES.includes(String(data.user.rol || "").toLowerCase())) navigate("/panel", { replace: true });
      else navigate("/", { replace: true });
    } catch {
      setError("No hemos podido conectar con el club. Comprueba tu conexión e inténtalo de nuevo en unos segundos.");
    } finally {
      setLoading(false);
    }
  };

  if (isLogged()) {
    const user = getUser();
    return (
      <section className="loginPage loginYa">
        <div className="loginCard">
          <Marca />
          <h1>Ya has entrado</h1>
          <p className="loginInfo">Estás dentro como <strong>{user?.nombre || user?.email || "usuario"}</strong>.</p>
          <div className="loginStack">
            <Link className="loginBtn" to={returnPath || "/"}>{returnPath ? "Continuar" : "Ir al inicio"}</Link>
            <button
              type="button"
              className="loginSecondaryBtn"
              onClick={() => { logout(); navigate(`/login${window.location.search}`, { replace: true }); }}
            >
              Cerrar sesión y entrar con otra cuenta
            </button>
          </div>
        </div>
      </section>
    );
  }

  const describedPassword = [esRegistro ? "login-password-ayuda" : "", errores.password ? "login-password-error" : ""].filter(Boolean).join(" ") || undefined;
  const faltan = Math.max(0, MIN_PASSWORD - form.password.length);

  return (
    <section className="loginPage">
      <aside className="loginLado">
        <Marca />
        <h2>Tu escuela de pádel, en tu bolsillo</h2>
        <ul>
          <li>Reserva pista en un momento</li>
          <li>Consulta tus clases y recuperaciones</li>
          <li>Recibe los avisos del club</li>
        </ul>
        <Ilustracion />
      </aside>

      <div className="loginCard">
        <div className="loginTabs" role="tablist" aria-label="Entrar o crear cuenta" data-activa={mode}>
          <span className="loginTabsFondo" aria-hidden="true" />
          <button type="button" role="tab" id="tab-login" aria-selected={!esRegistro} aria-controls="loginPanel" onClick={() => cambiarModo("login")}>
            Entrar
          </button>
          <button type="button" role="tab" id="tab-registro" aria-selected={esRegistro} aria-controls="loginPanel" onClick={() => cambiarModo("registro")}>
            Crear cuenta
          </button>
        </div>

        <div id="loginPanel" role="tabpanel" aria-labelledby={`tab-${mode}`} key={`${mode}-${paso}`} className="loginPanel">
          <h1>
            {!esRegistro ? "Bienvenido de nuevo" : paso === 1 ? "Crea tu cuenta" : "Elige tu contraseña"}
          </h1>
          <p className="loginInfo">
            {!esRegistro
              ? "Entra para reservar pista y ver tus clases y avisos."
              : paso === 1
                ? "Son dos pasos cortos. Primero, tus datos."
                : "Es lo último. Con ella entrarás siempre."}
          </p>
          {esRegistro && (
            <div className="loginPasos" aria-label={`Paso ${paso} de 2`}>
              <span className="loginPasosBarra" aria-hidden="true"><i className={paso === 2 ? "full" : ""} /></span>
              <span>Paso {paso} de 2</span>
            </div>
          )}

          {reason && !esRegistro && !error && <div className="loginNotice" role="status">{reason}</div>}
          {sessionExpired && !esRegistro && !error && !reason && (
            <div className="loginNotice" role="status">Tu sesión ha caducado. Vuelve a entrar para continuar.</div>
          )}

          <form onSubmit={handleSubmit} className="loginForm" noValidate ref={formRef}>
            {(!esRegistro || paso === 1) && (
              <>
                {esRegistro && (
                  <Campo id="login-nombre" label="Nombre y apellidos" error={errores.nombre}>
                    <input
                      id="login-nombre" type="text" name="nombre" value={form.nombre} onChange={handleChange}
                      autoComplete="name" aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? "login-nombre-error" : undefined}
                    />
                  </Campo>
                )}

                <Campo id="login-email" label="Email" error={errores.email}>
                  <input
                    id="login-email" type="email" inputMode="email" name="email"
                    placeholder="Ej: nombre@email.com" value={form.email} onChange={handleChange}
                    autoComplete={esRegistro ? "email" : "username"} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    aria-invalid={!!errores.email} aria-describedby={errores.email ? "login-email-error" : undefined}
                  />
                </Campo>

                {esRegistro && (
                  <Campo id="login-telefono" label="Teléfono" opcional>
                    <input
                      id="login-telefono" type="tel" inputMode="tel" name="telefono"
                      placeholder="Ej: 600 123 456" value={form.telefono} onChange={handleChange} autoComplete="tel"
                    />
                  </Campo>
                )}
              </>
            )}

            {(!esRegistro || paso === 2) && (
              <Campo
                id="login-password"
                label="Contraseña"
                error={errores.password}
                ayuda={esRegistro ? `Elige una que recuerdes, de ${MIN_PASSWORD} letras o números como mínimo. Por ejemplo, una frase corta.` : null}
              >
                <div className="passwordWrap">
                  <input
                    id="login-password"
                    type={visible ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete={esRegistro ? "new-password" : "current-password"}
                    aria-invalid={!!errores.password}
                    aria-describedby={describedPassword}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  />
                  <button
                    type="button" className="passwordToggle" aria-pressed={visible} aria-controls="login-password"
                    onClick={() => setVisible((v) => !v)}
                  >
                    {visible ? "Ocultar" : "Ver"}
                  </button>
                </div>
                {esRegistro && (
                  <div className="loginMedidor" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (form.password.length / MIN_PASSWORD) * 100)}%` }} className={faltan === 0 ? "ok" : ""} />
                  </div>
                )}
                {esRegistro && (
                  <p className="loginHint" aria-live="polite">
                    {faltan === 0 ? "Perfecto, ya vale." : form.password ? `Te faltan ${faltan} caracteres.` : `Mínimo ${MIN_PASSWORD} caracteres.`}
                  </p>
                )}
              </Campo>
            )}

            {!esRegistro && (
              <div className="loginForgot">
                <button type="button" className="loginLinkBtn" aria-expanded={showHelp} aria-controls="loginAyuda" onClick={() => setShowHelp((v) => !v)}>
                  ¿Has olvidado la contraseña?
                </button>
                {showHelp && (
                  <div className="loginForgotBox" id="loginAyuda">
                    <p>Escríbenos o llámanos y te ayudamos a recuperar el acceso. Dinos el email con el que te registraste.</p>
                    <div className="loginStack">
                      <a
                        className="loginWhatsBtn"
                        href={buildClubWhatsappUrl(`Hola, he olvidado mi contraseña de NaniPadel. Mi email es: ${form.email.trim()}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Pedir ayuda por WhatsApp
                      </a>
                      <a className="loginSecondaryBtn" href={buildClubPhoneUrl()}>Llamar al club · {clubPhoneLabel()}</a>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div aria-live="assertive">
              {error && (
                <div className="loginError" role="alert" key={error} ref={errorRef}>
                  <span>{error}</span>
                  {!esRegistro && error === MENSAJE_LOGIN && !showHelp && (
                    <button type="button" className="loginLinkBtn" onClick={() => setShowHelp(true)}>He olvidado la contraseña</button>
                  )}
                </div>
              )}
            </div>

            <div className="loginAcciones">
              <button type="submit" className="loginBtn" disabled={loading} aria-busy={loading}>
                {loading && <span className="loginSpinner" aria-hidden="true" />}
                <span>
                  {loading
                    ? (esRegistro ? "Creando tu cuenta…" : "Entrando…")
                    : !esRegistro ? "Entrar" : paso === 1 ? "Siguiente" : "Crear mi cuenta"}
                </span>
              </button>
              {esRegistro && paso === 2 && (
                <button type="button" className="loginSecondaryBtn" onClick={() => { setPaso(1); setError(""); }} disabled={loading}>
                  Volver a mis datos
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default Login;
