import express from "express";
import { obtenerNoticiasPadel } from "../services/noticiasPadelService.js";

const router = express.Router();

// GET /api/noticias/padel
// Público: últimos titulares de pádel (Marca y Mundo Deportivo), con caché de 30 minutos.
router.get("/padel", async (_req, res) => {
  try {
    const noticias = await obtenerNoticiasPadel();
    res.set("Cache-Control", "public, max-age=300");
    res.json({ ok: true, noticias });
  } catch (e) {
    console.error("Error GET /api/noticias/padel:", e);
    res.json({ ok: true, noticias: [] });
  }
});

export default router;
