import "../config/env.js";
import { BOT_COMMANDS, createTelegramBot, runTelegramPolling, TelegramApi } from "../services/telegramBotService.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN en backend/.env");
  process.exit(1);
}

const api = new TelegramApi(token);
const bot = createTelegramBot({ api });
// El menú de comandos del chat es opcional: si falla, el bot sigue funcionando.
await api.setCommands(BOT_COMMANDS).catch((error) => console.error("No se pudo publicar el menú de comandos:", error.message));
const polling = await runTelegramPolling({ api, bot });

const stop = () => {
  polling.stop();
  console.log("Polling de Telegram detenido");
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log("Bot interno de Telegram iniciado en modo polling");
await polling.start();
