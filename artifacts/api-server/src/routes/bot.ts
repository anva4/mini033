import { Router } from "express";
import { handleBotUpdate } from "../lib/bot";

const router = Router();

// Telegram шлёт сюда все апдейты
router.post("/webhook", async (req, res) => {
  res.sendStatus(200); // ответить быстро, чтобы TG не повторял
  await handleBotUpdate(req.body);
});

export default router;
