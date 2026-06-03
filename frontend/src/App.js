import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout"; // Importamos el Layout

import Home from "./pages/Home";
import Reservas from "./pages/Reservas";
import Clases from "./pages/Clases";
import Torneos from "./pages/Torneos";
import Tienda from "./pages/Tienda";
import Galeria from "./pages/Galeria";
import EstadoPista from "./pages/EstadoPista";
import Login from "./pages/Login";
import PanelProfesor from "./pages/PanelProfesor";
import Perfil from "./pages/Perfil";
import Avisos from "./pages/Avisos";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import "./styles/premium.css";


function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reservas" element={<Reservas />} />
        <Route path="/clases" element={<Clases />} />
        <Route path="/torneos" element={<Torneos />} />
        <Route path="/tienda" element={<Tienda />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/estado-pista" element={<EstadoPista />} />
        <Route path="/avisos" element={<Avisos />} />
        <Route path="/login" element={<Login />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/panel/whatsapp" element={<WhatsAppInbox />} />
        <Route path="/panel/*" element={<PanelProfesor />} />
      </Routes>
    </Layout>
  );
}

export default App;
