# Tiempo y pista (/estado-pista): crítica previa y cambios

## Crítica honesta (antes)
- El veredicto estaba en una tarjeta verde oscuro igual con "se puede" que con "no se puede": el color no decía nada. Y la portada usa punto verde/rojo.
- Nada respondía a "¿cuánto falta?": el dato nuevo (agua en la pista, hora de secado) solo salía como un número (12,3 mm) y como texto largo repetido tres veces (hero, "Pista encharcada", resumen).
- Jerga: "RIESGO", "Estado: OK", "Presión hPa", "Batería", "Medido hace poco" con fecha completa y segundos, "Estado pista RIESGO" duplicando el veredicto.
- Contradicción: el consejo del sensor decía "Condiciones buenas para jugar" aunque la pista estuviera encharcada.
- Chips y etiquetas de 11-12 px; el badge RIESGO con contraste justo (4,5).
- Las horas (12 en la portada) no estaban en esta página; la previsión de 7 días era una fila de letra pequeña sin lluvia.
- Cabecera "Fotos del entorno" desalineada y sección vacía cuando no hay fotos.

## Cambios
- Veredicto arriba, tintado verde/rojo con icono (visto / aspa) y tipografía de la portada; un solo texto con el motivo; consejo de juego solo cuando se puede jugar.
- Línea de tiempo del agua (componente nuevo `LineaAgua`, SVG propio, 48 h): fondo verde / rayado rojo por hora (no solo color), línea del agua, límite de 1 mm, marca "Ahora" y "Seca hh:mm", escala de raíz para que el límite se vea con tormentas, lectura al tocar una hora. Titular "Se podrá jugar en unas N horas".
- Hora a hora: tarjetas de 24 h con "Se puede / Lluvia / Mojada / Agua / Viento / Tormenta".
- Datos ahora: 6 datos en lenguaje llano (sin presión ni "estado pista"); sensor sin jerga (temperatura, humedad, "Hace N min") y solo avisos coherentes (mucha humedad, poca batería).
- 7 días en tarjetas con día, descripción, % de lluvia y máxima/mínima.
- Animaciones: entrada escalonada, pop del icono, la gráfica se revela de izquierda a derecha, escala al pulsar; sin nada continuo; `prefers-reduced-motion` las quita.
- Fotos solo si las hay.

## Nota técnica
`weatherService` solo devuelve 12 h, así que `components/lineaAguaDatos.js` repite la consulta a Open-Meteo (48 h) y usa `evaluarPista` sin tocar el modelo.
