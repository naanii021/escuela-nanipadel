# Página Avisos: crítica y cambios

## Crítica previa
- Visitante: tarjeta oscura con un solo botón "Entrar", sin explicar qué se gana.
- Con sesión (equipo): el formulario "Nuevo aviso" ocupaba la pantalla antes de la lista.
- Cabecera oscura con contadores "sin leer / totales" poco útiles; jerga ("activos", "Centro de avisos").
- Filtro de estado como `<select>` aparte de los botones; "Importantes" mezclado con categorías.
- Tarjetas: categoría y prioridad en 11 px, "Normal" sin valor, sin icono, fecha absoluta, contraste bajo (fechas 2.6:1, "Sin leer" 4.3:1).
- Importantes no iban arriba; marcar como leído recargaba la lista sin transición.
- Estado vacío pobre, CSS con capas duplicadas.

## Cambios
- Visitante: tarjeta clara con un único botón "Entrar con mi cuenta".
- Cabecera "Avisos" + "3 avisos sin leer" + "Marcar todo como leído".
- Filtros grandes (48 px): Todos, Sin leer, Leídos, Clases, Reservas, Club, Torneos, Importantes.
- Tarjetas con icono SVG por categoría, "Nuevo", insignia "! Urgente/! Importante" (texto + color + barra), resumen de 2 líneas + "Leer completo", "Hace 2 h". Importantes sin leer arriba.
- Marcar como leído inmediato con transición; se revierte si falla.
- Estados vacíos por filtro, esqueleto en la primera carga.
- Formulario del equipo plegado ("Escribir un aviso nuevo"), misma funcionalidad.
- Animación de entrada escalonada; `prefers-reduced-motion` la anula.
