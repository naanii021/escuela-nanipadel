import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout"; // Importamos el Layout

import Home from "./pages/Home";
import Reservas from "./pages/Reservas";
import Clases from "./pages/Clases";
import Torneos from "./pages/Torneos";
import Galeria from "./pages/Galeria";
import Login from "./pages/Login";
import PanelProfesor from "./pages/PanelProfesor";


function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Reservas" element={<Reservas />} />
        <Route path="/Clases" element={<Clases />} />
        <Route path="/Torneos" element={<Torneos />} />
        <Route path="/Galeria" element={<Galeria />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Panel" element={<PanelProfesor />} />
       
        {/* Aquí puedes añadir más páginas luego */}
      </Routes>
    </Layout>
  );
}

export default App;
