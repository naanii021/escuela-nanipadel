import { useEffect, useState } from "react";

function App() {
  const [alumnos, setAlumnos] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/alumnos")
      .then((res) => res.json())
      .then((data) => setAlumnos(data))
      .catch((err) => console.error("Error:", err));
  }, []);

  return (
    <div>
      <h1>Listado de Alumnos</h1>
      <ul>
        {alumnos.map((alumno, index) => (
          <li key={index}>{alumno.nombre}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
