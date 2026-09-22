import "../config/env.js";
import { createTelegramBot, runTelegramPolling, TelegramApi } from "../services/telegramBotService.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN en backend/.env");
  process.exit(1);
}

const api = new TelegramApi(token);
const bot = createTelegramBot({ api });
const polling = await runTelegramPolling({ api, bot });

const stop = () => {
  polling.stop();
  console.log("Polling de Telegram detenido");
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log("Bot interno de Telegram iniciado en modo polling");
await polling.start();
