import express from "express";
import { getTemporalClient } from "../temporalClient.js";
/**
 * GET /api/state
 *
 * Query a workflow's current state via Temporal `getState` query.
 *
 * Query params: workflowId
 */
const router = express.Router();

router.get("/:gameId", async (req, res) => {
  const { gameId } = req.params;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(gameId);

    const state = await handle.query("getState");

    res.json(state);
  } catch (err) {
    console.error("/api/state error:", err);
    if (err.message?.includes("Workflow not found")) {
      res.status(404).json({ error: "Game not found" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;