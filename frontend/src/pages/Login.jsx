// Página de Login (Acceso)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

function Login() {
  const navigate = useNavigate();

  // Guardamos los valores del formulario en estado
  const [form, setForm] = useState({
    usuario: "",
    password: "",
  });

  // Mensaje de error (si falla el login)
  const [error, setError] = useState("");

  // Maneja cambios en los inputs
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Actualizamos el estado del formulario sin perder el resto de campos
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Maneja el envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();

    // Limpiamos cualquier error anterior
    setError("");

    // ✅ LOGIN SIMULADO (por ahora)
    // Más adelante: aquí haremos fetch al backend para validar usuario/contraseña.
    // Ejemplo futuro: POST http://localhost:4000/auth/login
    if (form.usuario.trim() === "" || form.password.trim() === "") {
      setError("Rellena usuario y contraseña.");
      return;
    }

    // Simulación simple: si el usuario escribe "profesor" o "admin"
    // le dejamos entrar al panel.
    const user = form.usuario.toLowerCase();

    if ((user === "profesor" && form.password === "1234") || (user === "admin" && form.password === "1234")) {
      // Guardamos una "sesión" muy básica en localStorage (temporal)
      localStorage.setItem("isLogged", "true");
      localStorage.setItem("role", user);

      // Redirigimos al panel
      navigate("/panel");
      return;
    }

    // Si no coincide, mostramos error
    setError("Usuario o contraseña incorrectos (prueba profesor/admin y 1234).");
  };

  return (
    <section className="loginPage">
      <div className="loginCard">
        <h2>Acceso</h2>
        <p className="loginInfo">
          Entra como profesor o administrador para gestionar torneos, clases y alumnos.
        </p>

        {/* Mensaje de error */}
        {error && <div className="loginError">{error}</div>}

        {/* Formulario de login */}
        <form onSubmit={handleSubmit} className="loginForm">
          <label className="field">
            <span>Usuario</span>
            <input
              type="text"
              name="usuario"
              placeholder="Ej: profesor o admin"
              value={form.usuario}
              onChange={handleChange}
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              placeholder="Introduce tu contraseña"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="loginBtn">
            Entrar
          </button>

          <p className="loginHint">
            Demo rápida: usuario <strong>profesor</strong> o <strong>admin</strong> y contraseña <strong>1234</strong>.
          </p>
        </form>
      </div>
    </section>
  );
}

export default Login;
