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
        setError(data.message || "Error desconocido");
        return;
      }

      saveSession(data.token, data.user);
      console.log("LOGIN OK:", data.user);

      if (data.user.rol === "profesor" || data.user.rol === "admin") {
        navigate("/panel");
      } else {
        navigate("/reservas");
      }
    } catch (e) {
      setError("Error de conexión con el servidor");
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
            ? "Accede a tu cuenta para reservar pistas y gestionar tus reservas."
            : "Crea tu cuenta para empezar a reservar pistas."}
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
            {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
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