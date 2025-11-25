// server.js
import express from "express";
import cors from "cors";
import { Connection, Client } from "@temporalio/client";

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

let client;

// 
// Lazy Temporal Client (reuse connection)
// 
async function getTemporalClient() {
  if (!client) {
    const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
    console.log(`Connecting to Temporal at ${address}...`);
    const connection = await Connection.connect({ address });
    client = new Client({ connection });
    console.log("Connected to Temporal");
  }
  return client;
}

// 
// Start a new game
// 
app.post("/api/start", async (req, res) => {
  try {
    const gameId = `game-${Date.now()}`;
    const client = await getTemporalClient();

    await client.workflow.start("unbelievableTruthWorkflow", {
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



// 
// Send START-GAME signal
// (fires initial huge prompt to Ollama)
// 
app.post("/api/init", async (req, res) => {
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


// 
// Send END-GAME signal
// (fires initial huge prompt to Ollama)
// 
app.post("/api/end", async (req, res) => {
  const { gameId } = req.body;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(gameId);

    await handle.signal("noMoreTruths");

    res.json({ ok: true });
  } catch (err) {
    console.error("/api/end error:", err);
    res.status(500).json({ error: err.message });
  }
});





// 
// User guesses "number of truths"
// Signal: guessTruthCount
// 
app.post("/api/guessCount", async (req, res) => {
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

// 
// User submits an explanation for a truth
// Signal: explainTruth
// 
app.post("/api/explainTruth", async (req, res) => {
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

// 
// GET workflow state
// Query: getState
// 
app.get("/api/state/:gameId", async (req, res) => {
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


// 
// GET workflow data
// Query: getState
// 
app.get("/api/games", async (req, res) => {
  try {
    const client = await getTemporalClient();

    const iterator = client.workflow.list();
    const active = [];
    const completed = [];

    for await (const w of iterator) {
    	console.log(JSON.stringify(w, null, 2));
      if (w.status.name === "RUNNING") active.push(w.workflowId);
      else completed.push(w.workflowId);
    }

    res.json({ active, completed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3023, () => console.log("API listening on port 3023"));
