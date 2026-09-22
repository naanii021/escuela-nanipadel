# Bot interno de Telegram

## Preparación de la base de datos

Revisa y ejecuta manualmente `sql/2026-09-23_telegram_profesores.sql`. Antes de crear
`telegram_profesor_codigos`, comprueba el tipo de `profesores.id` y usa exactamente
el mismo tipo en `telegram_profesor_codigos.profesor_id`. La clave foránea incluida
como comentario se puede activar después de esa comprobación.

La migración añade a `profesores`:

- `telegram_chat_id BIGINT NULL UNIQUE`
- `telegram_username VARCHAR(255) NULL`

También crea la tabla de códigos temporales, que guarda únicamente el hash del
código, su caducidad y la fecha de uso.

## Arranque en el miniPC

Añade al archivo privado `backend/.env`:

```dotenv
TELEGRAM_BOT_TOKEN=token_entregado_por_BotFather
TELEGRAM_BOT_USERNAME=nombre_del_bot_sin_arroba
```

`TELEGRAM_BOT_USERNAME` es opcional. Sirve para generar el enlace directo desde el
panel; el comando `/start CODIGO` funciona aunque no se configure.

Arranca la API web y, en otro proceso, el polling del bot:

```powershell
cd backend
npm start
```

```powershell
cd backend
npm run telegram:bot
```

Debe existir una sola instancia del proceso de polling. El profesor genera el
código de un solo uso desde su panel autenticado y lo envía al bot en un chat
privado. El código caduca a los diez minutos.
