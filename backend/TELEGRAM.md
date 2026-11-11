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

## Puesta en marcha en el miniPC (pasos del dueño)

1. **Crear el bot.** En Telegram abre `@BotFather`, escribe `/newbot`, elige un nombre
   y un usuario que acabe en `bot`. BotFather te da un token: no lo compartas.
2. **Guardar el token.** Añade al archivo privado `backend/.env` (no se versiona):

   ```dotenv
   TELEGRAM_BOT_TOKEN=token_entregado_por_BotFather
   TELEGRAM_BOT_USERNAME=nombre_del_bot_sin_arroba
   ```

   `TELEGRAM_BOT_USERNAME` hace que el panel muestre el enlace directo al bot.
3. **Instalar y arrancar el servicio del bot** (usa el token del `.env`):

   ```bash
   sudo cp /srv/nanipadel/deploy/nanipadel-telegram-bot.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now nanipadel-telegram-bot
   ```

   Comprobar: `systemctl status nanipadel-telegram-bot` y
   `journalctl -u nanipadel-telegram-bot -f` (debe decir "Bot interno de Telegram
   iniciado en modo polling").
4. **Reiniciar el backend** para que lea `TELEGRAM_BOT_USERNAME` y las rutas nuevas:
   `sudo systemctl restart nanipadel-backend`.
5. **Crear los accesos de los profesores.** En la web, Panel, «Profesores»,
   «Crear acceso» a Alicia y Juanjo (email y contraseña temporal; se les da una vez
   y cada uno la cambia en Perfil, «Cambiar contraseña»).
6. **Vincular cada Telegram.** Cada profesor entra en la web (Dani también, con su
   cuenta de administración), abre Panel, «Pasar lista por Telegram», pulsa
   «Generar código» y sigue los pasos: abrir el bot, pulsar Iniciar y enviar
   `/start CÓDIGO`. El código sirve una vez y caduca a los diez minutos.
7. **Usarlo.** En el chat con el bot: `/hoy` (clases de hoy y pasar lista),
   `/grupos`, `/recuperaciones` y `/ayuda`.

Importante: debe existir **una sola instancia** del polling. Si se ejecuta
`npm run telegram:bot` a mano mientras el servicio está activo, Telegram devolverá
errores de conflicto. Para pruebas, para antes el servicio
(`sudo systemctl stop nanipadel-telegram-bot`).

Reglas de acceso: un profesor solo ve y pasa lista de **sus** grupos (los que tienen
su ficha como profesor); la cuenta de administración vinculada ve todos. Las clases
canceladas salen marcadas y no ofrecen pasar lista. Un grupo sin profesor asignado
solo lo puede pasar el administrador.

El código de vinculación se genera desde el panel autenticado. Funciona para un
profesor con cuenta y para el administrador cuya cuenta esté enlazada a una ficha de
profesor activa.

La lista que se está pasando vive solo en memoria del proceso y caduca tras
60 minutos sin actividad. Si el bot se reinicia o la lista caduca, pulsar
"Guardar lista" no guarda nada: el bot recarga la lista en el mismo mensaje con
un aviso y el profesor debe repasarla antes de guardar.

Tests del backend: `npm test`.
