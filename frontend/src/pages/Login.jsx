import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getUser, isLogged, login, logout, registro, safeReturnPath, saveSession } from "../services/auth";
import { buildClubPhoneUrl, buildClubWhatsappUrl, clubPhoneLabel } from "../services/whatsappLinks";
import "./login.css";

const STAFF_ROLES = ["profesor", "profe", "admin"];
const MIN_PASSWORD = 8;

function PasswordField({ value, onChange, mode, describedBy }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor="login-password">Contraseña</label>
      <div className="passwordWrap">
        <input
          id="login-password"
          type={visible ? "text" : "password"}
          name="password"
          value={value}
          onChange={onChange}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="passwordToggle"
          aria-pressed={visible}
          aria-controls="login-password"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
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
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "registro" && !form.nombre.trim()) {
      setError("Escribe tu nombre para crear la cuenta.");
      return;
    }
    if (!form.email.trim() || !form.password.trim()) {
      setError("Escribe tu email y tu contraseña.");
      return;
    }
    if (mode === "registro" && form.password.length < MIN_PASSWORD) {
      setError(`La contraseña tiene que tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    setLoading(true);

    try {
      const data = mode === "login"
        ? await login(form.email.trim(), form.password)
        : await registro(form.nombre.trim(), form.email.trim(), form.telefono.trim(), form.password);

      if (!data.ok) {
        setError(data.message || (mode === "login"
          ? "El email o la contraseña no son correctos."
          : "No hemos podido crear la cuenta."));
        return;
      }

      saveSession(data.token, data.user);

      if (returnPath) navigate(returnPath, { replace: true });
      else if (STAFF_ROLES.includes(String(data.user.rol || "").toLowerCase())) navigate("/panel", { replace: true });
      else navigate("/", { replace: true });
    } catch {
      setError("No hemos podido conectar con el club. Inténtalo de nuevo en unos segundos.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "registro" : "login");
    setError("");
  };

  if (isLogged()) {
    const user = getUser();
    return (
      <section className="loginPage">
        <div className="loginCard">
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

  return (
    <section className="loginPage">
      <div className="loginCard">
        <h1>{mode === "login" ? "Entrar" : "Crear cuenta"}</h1>
        <p className="loginInfo">
          {mode === "login"
            ? "Entra para reservar pista y ver tus clases y avisos."
            : "Crea tu cuenta para reservar pista y seguir la actividad del club."}
        </p>

        {reason && mode === "login" && !error && <div className="loginNotice" role="status">{reason}</div>}

        {sessionExpired && !error && !reason && (
          <div className="loginNotice" role="status">Tu sesión ha caducado. Vuelve a entrar para continuar.</div>
        )}

        {error && <div className="loginError" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="loginForm" noValidate>
          {mode === "registro" && (
            <>
              <div className="field">
                <label htmlFor="login-nombre">Nombre y apellidos</label>
                <input id="login-nombre" type="text" name="nombre" value={form.nombre} onChange={handleChange} autoComplete="name" />
              </div>

              <div className="field">
                <label htmlFor="login-telefono">Teléfono <span className="fieldOptional">(opcional)</span></label>
                <input
                  id="login-telefono"
                  type="tel"
                  inputMode="tel"
                  name="telefono"
                  placeholder="Ej: 600 123 456"
                  value={form.telefono}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              name="email"
              placeholder="Ej: nombre@email.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <PasswordField
            value={form.password}
            onChange={handleChange}
            mode={mode}
            describedBy={mode === "registro" ? "login-password-ayuda" : undefined}
          />
          {mode === "registro" && (
            <p id="login-password-ayuda" className="loginHint">Mínimo {MIN_PASSWORD} caracteres.</p>
          )}

          <button type="submit" className="loginBtn" disabled={loading}>
            {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        {mode === "login" && (
          <div className="loginForgot">
            <button type="button" className="loginLinkBtn" aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>
              ¿Has olvidado la contraseña?
            </button>
            {showHelp && (
              <div className="loginForgotBox">
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

        <div className="loginSwitch">
          <span>{mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}</span>
          <button type="button" className="loginSecondaryBtn" onClick={switchMode}>
            {mode === "login" ? "Crear una cuenta nueva" : "Entrar con mi cuenta"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default Login;
