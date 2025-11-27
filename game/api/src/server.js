import express from "express";
import cors from "cors";

import startRoute from "./routes/start.js";
import initRoute from "./routes/init.js";
import endRoute from "./routes/end.js";
import guessCountRoute from "./routes/guessCount.js";
import explainTruthRoute from "./routes/explainTruth.js";
import stateRoute from "./routes/state.js";
import listGamesRoute from "./routes/listGames.js";

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Mount routes
app.use("/api/start", startRoute);
app.use("/api/init", initRoute);
app.use("/api/end", endRoute);
app.use("/api/guessCount", guessCountRoute);
app.use("/api/explainTruth", explainTruthRoute);
app.use("/api/state", stateRoute);
app.use("/api/games", listGamesRoute);

// Health route
app.get("/", (req, res) => res.send("Unbelievable Truth API is running"));

app.listen(3023, () => console.log("API listening on port 3023"));