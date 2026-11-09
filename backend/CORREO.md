# Correo del formulario "Encuentra tu grupo"

La web envía las consultas de la página Clases a `POST /api/contacto/grupo`, y el backend
las manda por correo al club con nodemailer. Si el correo no está configurado, la ruta
responde 503 y la web destaca el botón de WhatsApp (sigue funcionando).

## Variables de entorno (`backend/.env`, no se versiona)

| Variable | Para qué | Ejemplo |
|---|---|---|
| `SMTP_HOST` | Servidor SMTP (sin él, el correo queda desactivado) | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto (por defecto 587) | `587` |
| `SMTP_SECURE` | `true` solo con TLS directo (puerto 465) | `false` |
| `SMTP_USER` | Usuario de la cuenta | `cuenta@gmail.com` |
| `SMTP_PASS` | Contraseña (de aplicación en Gmail) | `<contraseña de aplicación>` |
| `SMTP_FROM` | Remitente; por defecto `SMTP_USER` | `Escuela NaniPadel <cuenta@gmail.com>` |
| `CONTACTO_EMAIL_DESTINO` | Dónde llegan las consultas; por defecto `nanipadelcc@gmail.com` | `nanipadelcc@gmail.com` |

## Con Gmail (contraseña de aplicación)

1. En la cuenta de Google que enviará los correos, activa la verificación en dos pasos.
2. Entra en <https://myaccount.google.com/apppasswords>, crea una contraseña de aplicación
   (nombre: "NaniPadel web") y cópiala (16 letras, sin espacios).
3. En `backend/.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`,
   `SMTP_USER=<la cuenta>`, `SMTP_PASS=<la contraseña de aplicación>`.
   Con otro proveedor, usa los datos SMTP que te dé.

## Despliegue

```bash
cd backend && npm install     # instala nodemailer
# reinicia el servicio del backend para que lea el .env nuevo
```

Hasta que se haga `npm install` el backend arranca igual, pero el formulario responde 503.

## Protecciones

Campo trampa (honeypot) oculto, máximo 5 envíos por hora y por IP (y 40 en total), listas
cerradas para las respuestas, y se eliminan saltos de línea de los datos que van a las
cabeceras del correo. Las respuestas llegan en el asunto y cuerpo del correo; al responder,
va al correo del interesado si lo dio.
