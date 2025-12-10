import express from "express";
import { getTemporalClient } from "../temporalClient.js";
/**
 * POST /api/guessCount
 *
 * Signal the judge with how many guesses were used (or remaining).
 *
 * Body: { workflowId: string, guessCount: number }
 */
const router = express.Router();

router.post("/", async (req, res) => {
  const { gameId, count } = req.body;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(gameId);

    await handle.signal("guessTruthCount", count);

    res.json({ ok: true });
  } catch (err) {
    console.error("/api/guessCount error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;