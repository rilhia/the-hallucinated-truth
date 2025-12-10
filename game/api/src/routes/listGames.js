import express from "express";
import { getTemporalClient } from "../temporalClient.js";
/**
 * GET /api/games
 *
 * List running/known game workflows using the Temporal client listing API.
 */
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const client = await getTemporalClient();

    const iterator = client.workflow.list();
    const active = [];
    const completed = [];

    for await (const w of iterator) {
      if (w.status.name === "RUNNING") active.push(w.workflowId);
      else completed.push(w.workflowId);
    }

    res.json({ active, completed });
  } catch (err) {
    console.error("/api/games error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;