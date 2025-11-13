import React from 'react';
import { Link } from 'react-router-dom';

// Barra de navegación superior de la app
const Navbar = () => {
  return (
    <nav style={styles.navbar}>
      {/* Título o logo de la app */}
      <h2 style={styles.logo}>NaniPadel</h2>

      {/* Enlaces de navegación */}
      <ul style={styles.navLinks}>
        <li><Link style={styles.link} to="/">Inicio</Link></li>
        <li><Link style={styles.link} to="/clases">Clases</Link></li>
        <li><Link style={styles.link} to="/reservas">Reservas</Link></li>
        <li><Link style={styles.link} to="/login">Login</Link></li>
      </ul>
    </nav>
  );
};

// Estilos básicos en línea
const styles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#282c34',
    padding: '10px 20px',
    color: 'white',
  },
  logo: {
    margin: 0,
  },
  navLinks: {
    listStyle: 'none',
    display: 'flex',
    gap: '20px',
    margin: 0,
    padding: 0,
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontWeight: 'bold',
  }
};

export default Navbar;
