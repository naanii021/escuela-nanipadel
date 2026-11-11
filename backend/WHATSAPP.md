# Asistente de WhatsApp — puesta en marcha

El asistente responde a alumnos y familias consultas de **solo lectura** (horario, grupo y
recuperaciones) identificándolos por su teléfono. Está implementado en
`services/whatsappAssistantService.js` y `routes/whatsapp.js`, y los administradores ven la bandeja
en `/panel/whatsapp`. Sin las variables de abajo no está conectado a Meta y no responde a nadie.

## Variables de `backend/.env`

| Variable | Para qué |
|---|---|
| `WHATSAPP_TOKEN` | Token de acceso de la API Cloud de WhatsApp (Meta). |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp Business que envía los mensajes. |
| `WHATSAPP_VERIFY_TOKEN` | Texto que eliges tú; Meta lo envía al verificar el webhook. |
| `WHATSAPP_APP_SECRET` | Secreto de la app de Meta. **Obligatorio**: con él se comprueba la firma de cada POST. |
| `WHATSAPP_ASSISTANT_ENABLED` | `true` para que el asistente responda. Con `false` solo se guardan los mensajes. |

No subas estos valores al repositorio.

## Webhook en Meta

1. En la app de Meta (WhatsApp → Configuración → Webhook), URL de devolución de llamada:
   `https://nanipadel.duckdns.org/api/whatsapp/webhook`.
2. Token de verificación: el mismo que `WHATSAPP_VERIFY_TOKEN`.
3. Suscríbete al campo `messages`.
4. Reinicia el backend tras cambiar el `.env`: `sudo systemctl restart nanipadel-backend`.

El webhook rechaza con 401 las peticiones sin firma válida (`X-Hub-Signature-256`) y con 500 si falta
`WHATSAPP_APP_SECRET`, para que nadie pueda inyectar mensajes falsos ni hacer escribir al asistente
a una familia.

## Probarlo

- Tests sin BD ni Meta: `cd backend && npm test` (`tests/whatsapp-assistant.test.js`).
- Un teléfono que no está en `alumnos.telefono` ni en `alumnos.tutor_telefono` recibe un aviso para
  contactar con la escuela y no ve ningún dato.
- Si un mismo teléfono pertenece a varios alumnos, el asistente pregunta sobre quién consultar;
  "cambiar alumno" vuelve a preguntar.
- Aviso de clase cancelada: `tests/aviso-cancelacion.test.js` (BD y `fetch` simulados).

## Aviso de clase cancelada

Al cancelar una clase entera (`POST /api/gestion/control/grupos/:id/sesiones/cancelar`) el profe
puede marcar **"Avisar a las familias por WhatsApp"**. Está implementado en
`services/avisoCancelacionService.js`. **Todo viene apagado**: sin las variables de abajo no se envía
nada y la cancelación funciona igual.

### Variables de `backend/.env`

| Variable | Efecto |
|---|---|
| `WHATSAPP_AVISOS_CLASES` | `true` activa los avisos. Por defecto (vacía o `false`) están apagados. Además hacen falta `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`; sin ellos también se informa "Avisos por WhatsApp desactivados". |
| `WHATSAPP_AVISOS_SOLO_A` | Modo prueba: teléfonos separados por comas (`611222333,+34622333444`). Si está definida, **solo** se envía a esos números aunque el grupo tenga más familias. |
| `WHATSAPP_AVISOS_MODO_PRUEBA` | `true` fuerza el modo prueba. Con la lista vacía no se envía a nadie (seguro por defecto). |

Reinicia el backend tras cambiar el `.env`.

### Cómo funciona

- Destinatarios: alumnos con clase ese día en el grupo y matrícula activa. Teléfono del tutor
  (`tutor_telefono`) si existe; si no, el del alumno. Un mismo teléfono recibe **un solo** mensaje
  (un tutor con dos hijos: "Ana y Beto"). Los teléfonos vacíos o inválidos se cuentan como
  `sinTelefono` y la hoja pide al profe que llame a esas familias.
- Envío secuencial (pausa de 250 ms); un fallo no corta los demás. Si tarda más de 15 s, la
  respuesta de la cancelación devuelve `estado: "en_curso"` y el envío termina en segundo plano.
- No se avisa si la clase ya estaba cancelada, si la fecha ya pasó ni al reabrir una clase.
- La cancelación se guarda siempre antes y no depende de WhatsApp.
- Respuesta de la cancelación (solo si el body lleva `avisar_familias: true`):
  `aviso: { estado, enviados, fallidos, sinTelefono, omitidos, nombresSinAvisar, mensaje }`.
  `estado`: `desactivado`, `sin_destinatarios`, `enviado`, `parcial`, `error`, `en_curso`, `omitido`.
- `GET /api/gestion/control/avisos-whatsapp?grupo_id=8&fecha=2026-11-05` →
  `{ activo, motivo, mensaje, modo_prueba, destinatarios, sin_telefono }`. La hoja de cancelar lo
  usa para mostrar la casilla solo si los avisos están activos y decir "Llegará a N familias".
  Apagado, responde sin consultar alumnos.
- Registro: si ya existen `whatsapp_conversations` y `whatsapp_messages`, cada envío queda como
  mensaje saliente `template` (conversación `cerrada`, sin nombres de alumnos en el contenido). Si no
  existen, solo hay logs del servidor con el teléfono enmascarado (`+34••••••926`).

### Cómo probar solo con tu móvil

1. En `backend/.env`: `WHATSAPP_AVISOS_CLASES=true` y `WHATSAPP_AVISOS_SOLO_A=+34TUMOVIL`.
2. Tu móvil debe figurar como `tutor_telefono` (o `telefono`) de algún alumno del grupo que cancelas;
   si no, no recibirás nada (`omitidos` cuenta lo que se ha dejado fuera). La hoja mostrará
   "Llegará a 1 familia".
3. Cancela una clase **futura** del grupo con la casilla marcada. Recibirás un solo mensaje.
4. Para volver a probar, reabre la clase y cancélala de nuevo.
5. Quita `WHATSAPP_AVISOS_SOLO_A` solo cuando la plantilla esté aprobada y quieras avisar de verdad.

### Plantilla `clase_cancelada` que hay que crear en Meta

Administrador de WhatsApp → Plantillas de mensajes → Crear. Nombre `clase_cancelada`, idioma
**Español (es)**, categoría **Utilidad**. Cuerpo (4 variables; es la misma plantilla que usa
`notificationService`, con el mismo orden):

```
Escuela NaniPadel: se cancela la clase de {{1}} del {{2}} a las {{3}}. Motivo: {{4}}. Si tienes alguna duda, responde a este mensaje.
```

| Variable | Contenido | Ejemplo |
|---|---|---|
| `{{1}}` | alumno(s) y grupo | `Ana y Beto (grupo Adultos avanzado)` |
| `{{2}}` | día | `jueves 5 de noviembre` |
| `{{3}}` | hora | `19:30` |
| `{{4}}` | motivo en palabras, con "recuperación" si aplica | `por la lluvia. Se podrá recuperar y la escuela os dirá cuándo` |

Meta pide ejemplos de cada variable al enviarla a revisión (usa los de la tabla). Mientras no esté
aprobada, los envíos fallan con error de Meta y la hoja avisa "No se pudo avisar a N: llámalas".

### Coste

WhatsApp cobra por mensaje de plantilla entregado, según categoría y país. Las de **Utilidad**
cuestan unos céntimos de euro por mensaje (consulta la tarifa vigente en Meta; orden de magnitud
0,02-0,05 €, no verificado). Un grupo de 8 familias son pocos céntimos por cancelación. Se cobra una
vez por teléfono, no por alumno.

### Privacidad y consentimiento

- Los alumnos son menores y **no hay registro de consentimiento**. Por eso el aviso es una acción
  explícita del profe en cada cancelación (casilla desmarcada por defecto) y el mensaje solo lleva
  nombre de pila, grupo, día, hora y motivo.
- Los números se usan solo para este aviso; los logs enmascaran el teléfono.
- Cuando la escuela recoja el consentimiento, `sql/2026-11-11_consentimiento_whatsapp.sql` (borrador,
  no ejecutado) añade `alumnos.acepta_whatsapp`. Si la columna existe, el servicio **solo** avisa
  a quien tenga `1`; sin la columna se comporta como se ha descrito arriba.
- Informa a las familias de que reciben avisos por WhatsApp y cómo dejar de recibirlos.
