import express from "express";
import { getTemporalClient } from "../temporalClient.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const gameId = `game-${Date.now()}`;
    const client = await getTemporalClient();

    await client.workflow.start("hallucinatedTruthWorkflow", {
      workflowId: gameId,
      taskQueue: "truth-game",
    });

    console.log("Started new Unbelievable Truth game:", gameId);
    res.json({ gameId });
  } catch (err) {
    console.error("/api/start error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;