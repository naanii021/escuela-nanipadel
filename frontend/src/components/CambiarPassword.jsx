import { useId, useState } from "react";
import { apiPut } from "../services/api";

const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72;

function bytes(text) {
  return new TextEncoder().encode(text).length;
}

function PasswordInput({ id, label, value, onChange, autoComplete, describedBy, invalid, inputRef }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pwdField">
      <label htmlFor={id}>{label}</label>
      <div className="pwdWrap">
        <input
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="pwdToggle"
          aria-pressed={visible}
          aria-controls={id}
          aria-label={`${visible ? "Ocultar" : "Ver"} ${label.toLowerCase()}`}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
    </div>
  );
}

export default function CambiarPassword() {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repite, setRepite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [fieldError, setFieldError] = useState({ actual: false, nueva: false, repite: false });

  const ids = { actual: `${uid}-actual`, nueva: `${uid}-nueva`, repite: `${uid}-repite`, hint: `${uid}-hint` };

  const clear = () => {
    setActual("");
    setNueva("");
    setRepite("");
  };

  const validate = () => {
    if (!actual) return ["Escribe tu contraseña actual.", { actual: true }];
    if (nueva.length < MIN_PASSWORD) return [`La nueva contraseña necesita al menos ${MIN_PASSWORD} caracteres. Ahora tiene ${nueva.length}.`, { nueva: true }];
    if (bytes(nueva) > MAX_PASSWORD_BYTES) return ["La nueva contraseña es demasiado larga. Usa como máximo 72 caracteres.", { nueva: true }];
    if (nueva === actual) return ["La nueva contraseña tiene que ser distinta de la actual.", { nueva: true }];
    if (nueva !== repite) return ["Las dos contraseñas nuevas no coinciden. Vuelve a escribirlas.", { repite: true }];
    return null;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setDone(false);
    const problem = validate();
    if (problem) {
      setError(problem[0]);
      setFieldError({ actual: false, nueva: false, repite: false, ...problem[1] });
      return;
    }
    setError("");
    setFieldError({ actual: false, nueva: false, repite: false });
    try {
      setSending(true);
      await apiPut("/api/perfil/password", { actual, nueva });
      clear();
      setDone(true);
    } catch (e) {
      setError(e.message || "No hemos podido cambiar la contraseña. Inténtalo de nuevo.");
      setFieldError({ actual: /actual/i.test(e.message || ""), nueva: false, repite: false });
    } finally {
      setSending(false);
    }
  };

  const toggle = () => {
    setOpen((v) => !v);
    setError("");
    setDone(false);
    clear();
  };

  return (
    <section className="profileCard pwdCard" aria-labelledby={`${uid}-title`}>
      <div className="pwdHead">
        <div>
          <h2 id={`${uid}-title`}>Cambiar contraseña</h2>
          <p>Hazlo si tienes una contraseña temporal o quieres una nueva.</p>
        </div>
        <button
          type="button"
          className="pwdOpenBtn"
          aria-expanded={open}
          aria-controls={`${uid}-form`}
          onClick={toggle}
        >
          {open ? "Cerrar" : "Cambiar"}
        </button>
      </div>

      {open && (
        <form id={`${uid}-form`} className="pwdForm" onSubmit={submit} noValidate>
          <p id={ids.hint} className="pwdHint">La nueva contraseña debe tener al menos {MIN_PASSWORD} caracteres.</p>

          {done ? (
            <div className="pwdOk" role="status">
              <strong>Contraseña cambiada</strong>
              <span>La próxima vez que entres, usa la nueva.</span>
            </div>
          ) : null}

          <PasswordInput id={ids.actual} label="Contraseña actual" value={actual} onChange={setActual}
            autoComplete="current-password" invalid={fieldError.actual} />
          <PasswordInput id={ids.nueva} label="Nueva contraseña" value={nueva} onChange={setNueva}
            autoComplete="new-password" describedBy={ids.hint} invalid={fieldError.nueva} />
          <PasswordInput id={ids.repite} label="Repite la nueva" value={repite} onChange={setRepite}
            autoComplete="new-password" invalid={fieldError.repite} />

          {error && <div className="pwdError" role="alert">{error}</div>}

          <button type="submit" className="pwdSubmit" disabled={sending}>
            {sending ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </form>
      )}
    </section>
  );
}
