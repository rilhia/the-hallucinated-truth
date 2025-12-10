import express from "express";
import { getTemporalClient } from "../temporalClient.js";
/**
 * POST /api/explainTruth
 *
 * Relay a player's explanation choice into the workflow for judging.
 *
 * Body: { workflowId: string, explanation: object }
 */
const router = express.Router();

router.post("/", async (req, res) => {
  const { gameId, explanation } = req.body;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(gameId);

    await handle.signal("explainTruth", explanation);

    res.json({ ok: true });
  } catch (err) {
    console.error("/api/explainTruth error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;