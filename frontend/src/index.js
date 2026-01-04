// Importamos React y ReactDOM para renderizar
import React from 'react';
import ReactDOM from 'react-dom/client';

// Importamos estilos globales
import './index.css';

// Importamos BrowserRouter para manejar rutas
import { BrowserRouter } from 'react-router-dom';

// Importamos el componente principal de la App
import App from './App';


// Creamos el punto de entrada de la app y lo renderizamos
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Envolvemos la App en el Router para poder usar rutas */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
