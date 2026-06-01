import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, registro, saveSession } from "../services/auth";
import "./login.css";

function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password.trim()) {
      setError("Rellena email y contraseña.");
      return;
    }

    if (mode === "registro" && !form.nombre.trim()) {
      setError("Escribe tu nombre para registrarte.");
      return;
    }

    setLoading(true);

    try {
      let data;

      if (mode === "login") {
        data = await login(form.email, form.password);
      } else {
        data = await registro(form.nombre, form.email, form.telefono, form.password);
      }

      if (!data.ok) {
        setError(data.message || "No hemos podido completar la accion.");
        return;
      }

      saveSession(data.token, data.user);
      console.log("LOGIN OK:", data.user);

      if (data.user.rol === "profesor" || data.user.rol === "profe" || data.user.rol === "admin") {
        navigate("/panel");
      } else {
        navigate("/reservas");
      }
    } catch (e) {
      setError("No hemos podido conectar con el club. Inténtalo de nuevo en unos segundos.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "registro" : "login");
    setError("");
  };

  return (
    <section className="loginPage">
      <div className="loginCard">
        <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
        <p className="loginInfo">
          {mode === "login"
            ? "Entra para ver tus reservas, clases y avisos del club."
            : "Crea tu cuenta para reservar pista y participar en la actividad del club."}
        </p>

        {error && <div className="loginError">{error}</div>}

        <form onSubmit={handleSubmit} className="loginForm">
          {mode === "registro" && (
            <>
              <label className="field">
                <span>Nombre</span>
                <input
                  type="text"
                  name="nombre"
                  placeholder="Ej: Dani"
                  value={form.nombre}
                  onChange={handleChange}
                />
              </label>

              <label className="field">
                <span>Teléfono (opcional)</span>
                <input
                  type="text"
                  name="telefono"
                  placeholder="Ej: 600 123 456"
                  value={form.telefono}
                  onChange={handleChange}
                />
              </label>
            </>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              placeholder="Ej: dani@email.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              placeholder="Tu contraseña"
              value={form.password}
              onChange={handleChange}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          <button type="submit" className="loginBtn" disabled={loading}>
            {loading ? "Un momento..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <p className="loginSwitch">
          {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button className="switchBtn" onClick={switchMode}>
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </section>
  );
}

export default Login;
