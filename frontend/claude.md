# CLAUDE.md - Instrucciones para Claude Code
**Proyecto: escuela-nanipadel** | DAM Student | Versión 3.0 - React + Node + Advanced CSS

---

## 📚 Stack Tecnológico

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + CSS Modules + CSS personalizado
- **Animaciones:** CSS Animations + @keyframes + Transitions
- **Enrutamiento:** React Router v6
- **Estado:** React Hooks (useState, useContext, useReducer, useCallback, useMemo)
- **Iconos:** React Icons
- **Deploy:** Netlify

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Base de datos:** MySQL (miniPC Windows @ 192.168.x.x)
- **Validación:** Express validator
- **CORS:** Configurado para localhost:3000

---

## 🎨 DESIGN TOKENS - Sistema de diseño minimalista

### Colores (CSS Variables)
```css
:root {
  /* Primarios */
  --primary: #6366f1;
  --primary-light: #818cf8;
  --primary-dark: #4f46e5;
  
  /* Secundarios */
  --secondary: #ec4899;
  --secondary-light: #f472b6;
  --secondary-dark: #db2777;
  
  /* Neutrales */
  --bg: #ffffff;
  --bg-alt: #f8f9fa;
  --text: #1a1a1a;
  --text-muted: #6b7280;
  --border: #e5e7eb;
  
  /* Estados */
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;
  
  /* Sombras */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
}
```

### Espaciado
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
```

### Tipografía
```css
--font-heading: 'Inter', sans-serif;
--font-body: 'Inter', sans-serif;

--fs-h1: 3.5rem;
--fs-h2: 2.8rem;
--fs-h3: 2rem;
--fs-h4: 1.5rem;
--fs-h5: 1.25rem;
--fs-body: 1rem;
--fs-small: 0.875rem;

--fw-light: 300;
--fw-normal: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;
```

---

## 🎬 ANIMACIONES CSS AVANZADAS - Listas para usar

### Entradas y salidas
```css
/* Fade In / Out */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Slide Up */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide Down */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide Left */
@keyframes slideLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Slide Right */
@keyframes slideRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Zoom In */
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* Bounce */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Glow */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.5); }
  50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.8); }
}
```

### Transiciones interactivas
```css
/* Hover Scale */
.hover-scale {
  transition: transform 0.2s ease;
}
.hover-scale:hover {
  transform: scale(1.05);
}

/* Hover Lift */
.hover-lift {
  transition: all 0.3s ease;
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Hover Color */
.hover-color {
  transition: color 0.2s ease, background-color 0.2s ease;
}

/* Smooth Border */
.border-smooth {
  transition: border-color 0.2s ease;
}

/* Underline Animation */
.underline-animate {
  position: relative;
  display: inline-block;
}
.underline-animate::after {
  content: '';
  position: absolute;
  width: 0;
  height: 2px;
  bottom: -2px;
  left: 0;
  background-color: var(--primary);
  transition: width 0.3s ease;
}
.underline-animate:hover::after {
  width: 100%;
}
```

### Loader animations
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

---

## ⚡ CSS SNIPPETS MODERNOS - Copia y pega

### Gradientes dinámicos
```css
/* Gradient primario */
.bg-gradient-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
}

/* Gradient animado */
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.bg-gradient-animated {
  background: linear-gradient(-45deg, var(--primary), var(--secondary), var(--primary));
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* Neumorphism */
.neu {
  background: linear-gradient(145deg, #ffffff, #f0f0f0);
  box-shadow: 5px 5px 10px #d0d0d0, -5px -5px 10px #ffffff;
}
```

### Efectos de texto
```css
/* Gradient Text */
.text-gradient {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Text Shadow */
.text-shadow {
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
}

/* Text Glow */
.text-glow {
  text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
  animation: glow 2s ease-in-out infinite;
}

/* Outline Text */
.text-outline {
  -webkit-text-stroke: 1px var(--primary);
  color: transparent;
}
```

### Efectos de borde
```css
/* Animated Border */
.border-animated {
  position: relative;
  overflow: hidden;
}
.border-animated::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  animation: borderSlide 3s infinite;
}

@keyframes borderSlide {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* Gradient Border */
.border-gradient {
  border: 2px solid;
  border-image: linear-gradient(135deg, var(--primary), var(--secondary)) 1;
}

/* Double Border */
.border-double {
  border: 3px solid var(--primary);
  box-shadow: inset 0 0 0 1px var(--secondary);
}
```

### Efectos 3D
```css
/* Perspective */
.perspective {
  perspective: 1000px;
}

.card-3d {
  transform-style: preserve-3d;
  transform: rotateX(0deg);
  transition: transform 0.3s ease;
}
.card-3d:hover {
  transform: rotateY(10deg) rotateX(-5deg);
}

/* Flip Animation */
@keyframes flip {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(180deg); }
}
```

### Grid y Layout
```css
/* Masonry (sin JS) */
.masonry {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-4);
}

/* Responsive Columns */
.grid-responsive {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-6);
}

/* Aspect Ratio Box */
.aspect-video {
  aspect-ratio: 16 / 9;
}
.aspect-square {
  aspect-ratio: 1;
}

/* Stacked (móvil) a lado a lado (desktop) */
.responsive-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .responsive-stack {
    flex-direction: row;
    justify-content: space-between;
  }
}
```

---

## ⚙️ COMPONENTES REACT PATTERN - Fragmentos listos

### Custom Hook - useFetch
```javascript
// hooks/useFetch.js
import { useState, useEffect } from 'react'

export const useFetch = (url) => {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Error: ${res.status}`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [url])

  return { data, error, loading }
}
```

### Custom Hook - useForm
```javascript
// hooks/useForm.js
import { useState, useCallback } from 'react'

export const useForm = (inicial = {}) => {
  const [valores, setValores] = useState(inicial)
  const [errores, setErrores] = useState({})

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setValores(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }, [])

  const reset = useCallback(() => setValores(inicial), [inicial])
  const setFieldValue = useCallback((field, value) => {
    setValores(prev => ({ ...prev, [field]: value }))
  }, [])

  return { valores, handleChange, reset, setFieldValue, errores, setErrores }
}
```

### Custom Hook - useLocalStorage
```javascript
// hooks/useLocalStorage.js
import { useState, useEffect } from 'react'

export const useLocalStorage = (key, valorInicial) => {
  const [valor, setValor] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : valorInicial
    } catch (error) {
      console.error(error)
      return valorInicial
    }
  })

  const setValorEnStorage = (nuevoValor) => {
    try {
      setValor(nuevoValor)
      window.localStorage.setItem(key, JSON.stringify(nuevoValor))
    } catch (error) {
      console.error(error)
    }
  }

  return [valor, setValorEnStorage]
}
```

### Componente - Botón reutilizable
```javascript
// components/Boton/Boton.jsx
import { useMemo } from 'react'
import styles from './Boton.module.css'

export default function Boton({
  variante = 'primary',
  tamaño = 'md',
  deshabilitado = false,
  cargando = false,
  icono,
  children,
  onClick,
  className = '',
  ...props
}) {
  const clases = useMemo(() => {
    return [
      styles.boton,
      styles[variante],
      styles[tamaño],
      cargando && styles.cargando,
      className
    ].filter(Boolean).join(' ')
  }, [variante, tamaño, cargando, className])

  return (
    <button
      className={clases}
      disabled={deshabilitado || cargando}
      onClick={onClick}
      {...props}
    >
      {icono && <span className={styles.icono}>{icono}</span>}
      {cargando ? 'Cargando...' : children}
    </button>
  )
}
```

```css
/* Boton.module.css */
.boton {
  font-family: var(--font-body);
  font-weight: var(--fw-semibold);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.primary {
  background: var(--primary);
  color: white;
  box-shadow: var(--shadow-sm);
}
.primary:hover:not(:disabled) {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.md {
  padding: var(--space-3) var(--space-4);
  font-size: 1rem;
}

.cargando {
  opacity: 0.7;
  pointer-events: none;
}
```

### Componente - Tarjeta animada
```javascript
// components/Tarjeta/Tarjeta.jsx
import styles from './Tarjeta.module.css'

export default function Tarjeta({ 
  titulo, 
  descripcion, 
  icono, 
  accion,
  children,
  efecto = 'hover-lift'
}) {
  return (
    <div className={`${styles.tarjeta} ${styles[efecto]}`}>
      {icono && <div className={styles.icono}>{icono}</div>}
      {titulo && <h3 className={styles.titulo}>{titulo}</h3>}
      {descripcion && <p className={styles.descripcion}>{descripcion}</p>}
      {children && <div className={styles.contenido}>{children}</div>}
      {accion && <div className={styles.accion}>{accion}</div>}
    </div>
  )
}
```

```css
/* Tarjeta.module.css */
.tarjeta {
  background: white;
  border-radius: 0.75rem;
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.hover-lift:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

.icono {
  font-size: 2.5rem;
  margin-bottom: var(--space-4);
  color: var(--primary);
}

.titulo {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--fs-h4);
  color: var(--text);
}

.descripcion {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.6;
}
```

---

## 🔌 BACKEND - Node.js + Express Patterns

### Estructura de rutas
```javascript
// server/routes/productos.js
const express = require('express')
const router = express.Router()
const { obtenerProductos, crearProducto } = require('../controllers/productosController')

router.get('/productos', obtenerProductos)
router.post('/productos', crearProducto)

module.exports = router
```

### Controlador básico
```javascript
// server/controllers/productosController.js
const conexion = require('../db')

const obtenerProductos = (req, res) => {
  conexion.query('SELECT * FROM productos', (error, resultado) => {
    if (error) return res.status(500).json({ error: error.message })
    res.json(resultado)
  })
}

const crearProducto = (req, res) => {
  const { nombre, precio, descripcion } = req.body
  const query = 'INSERT INTO productos (nombre, precio, descripcion) VALUES (?, ?, ?)'
  
  conexion.query(query, [nombre, precio, descripcion], (error, resultado) => {
    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json({ id: resultado.insertId, nombre, precio, descripcion })
  })
}

module.exports = { obtenerProductos, crearProducto }
```

### Middleware de error
```javascript
// server/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  })
}

module.exports = errorHandler
```

---

## 🔗 INTEGRACIÓN REACT ↔️ NODE

### Cliente fetch simplificado
```javascript
// src/api/client.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'

export const api = {
  get: (endpoint) => fetch(`${API_URL}${endpoint}`).then(r => r.json()),
  post: (endpoint, data) => 
    fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  put: (endpoint, data) =>
    fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  delete: (endpoint) =>
    fetch(`${API_URL}${endpoint}`, { method: 'DELETE' }).then(r => r.json())
}
```

### Uso en componentes
```javascript
// src/pages/Productos/Productos.jsx
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import Tarjeta from '../../components/Tarjeta/Tarjeta'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get('/productos')
      .then(setProductos)
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return <div>Cargando...</div>

  return (
    <div className="grid-responsive">
      {productos.map(p => (
        <Tarjeta key={p.id} titulo={p.nombre} descripcion={p.descripcion} />
      ))}
    </div>
  )
}
```

---

## 📁 ESTRUCTURA DE CARPETAS

```
escuela-nanipadel/
├── src/
│   ├── components/
│   │   ├── Boton/
│   │   │   ├── Boton.jsx
│   │   │   └── Boton.module.css
│   │   ├── Tarjeta/
│   │   ├── Header/
│   │   └── Footer/
│   ├── pages/
│   │   ├── Home/
│   │   ├── Productos/
│   │   └── Contacto/
│   ├── hooks/
│   │   ├── useFetch.js
│   │   ├── useForm.js
│   │   └── useLocalStorage.js
│   ├── context/
│   ├── styles/
│   │   ├── variables.css
│   │   ├── animations.css
│   │   └── global.css
│   ├── api/
│   │   └── client.js
│   ├── utils/
│   └── App.jsx
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── db.js
│   └── server.js
└── package.json
```

---

## ✅ CONVENCIONES FINALES

### Nombres
- ✅ Componentes React: PascalCase en español
- ✅ Funciones/variables: camelCase en español
- ✅ Archivos CSS: NombreComponente.module.css
- ✅ Hooks personalizados: useNombre

### Código limpio
- ✅ Máximo 100 líneas por componente (si no, dividir)
- ✅ Usar useCallback para funciones en props
- ✅ Usar useMemo para valores computados
- ✅ Destructurar props en la función

### Performance
- ✅ Lazy loading de rutas con React.lazy()
- ✅ Memoizar componentes con memo() si reciben muchos props
- ✅ Evitar objetos/arrays inline (crear fuera o memoizar)
- ✅ Imágenes optimizadas (WebP, lazy loading)

---

## 🚀 CUANDO PIDAS A CLAUDE CODE

**Usa instrucciones cortas:**
```
"Crea un componente Modal reutilizable con fade-in animation"
"Añade una sección Hero con gradient animado y parallax"
"Conecta la página de productos a la API /api/productos"
"Implementa validación de formulario con errores en tiempo real"
```

**Claude ya conocerá:**
- Tu paleta de colores
- Tus animaciones CSS
- Tus componentes existentes
- Tu estructura React
- Tu forma de conectar backend

**No gastas tokens explicando lo mismo dos veces** ✨

---

**Última actualización:** 2026-04-17
**Versión:** 3.0 - React + Node + Advanced CSS