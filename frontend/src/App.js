import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar'; // ⬅️ Importamos la barra de navegación

function App() {
  return (
    <div className="App">
      {/* Mostramos el Navbar en todas las páginas */}
      <Navbar />

      {/* Definimos las rutas */}
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Aquí puedes añadir más páginas luego */}
      </Routes>
    </div>
  );
}

export default App;
