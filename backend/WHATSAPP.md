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
