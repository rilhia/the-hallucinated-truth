import express from "express";
import { getTemporalClient } from "../temporalClient.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { gameId, promptSubject } = req.body;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(gameId);

    await handle.signal("startGame", promptSubject);

    res.json({ ok: true });
  } catch (err) {
    console.error("/api/init error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;