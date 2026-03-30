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
        <Route path="/reservas" element={<Reservas />} />
        <Route path="/clases" element={<Clases />} />
        <Route path="/torneos" element={<Torneos />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/login" element={<Login />} />
        <Route path="/panel" element={<PanelProfesor />} />
      </Routes>
    </Layout>
  );
}

export default App;
