import express from "express";
import cors from "cors";

import startRoute from "./routes/start.js";
import initRoute from "./routes/init.js";
import endRoute from "./routes/end.js";
import explainTruthRoute from "./routes/explainTruth.js";
import stateRoute from "./routes/state.js";
import listGamesRoute from "./routes/listGames.js";

/**
 * Express application instance.
 * @type {import("express").Express}
 */
const app = express();

/**
 * Middleware: Parse incoming JSON request bodies.
 * Required for POST requests that send game IDs, text, or other data.
 */
app.use(express.json());

/**
 * Middleware: Enable Cross-Origin Resource Sharing (CORS).
 * Allows frontend clients running on any domain to interact with the API.
 */
app.use(
  cors({
    origin: "*", // Allow all origins (can be restricted later)
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * Route: Create a new game session.
 * @route POST /api/start
 */
app.use("/api/start", startRoute);

/**
 * Route: Initialise a game by generating the story and truths.
 * @route POST /api/init
 */
app.use("/api/init", initRoute);

/**
 * Route: End the game and produce final scoring/results.
 * @route POST /api/end
 */
app.use("/api/end", endRoute);

/**
 * Route: Submit a truth explanation attempt for verification.
 * @route POST /api/explainTruth
 */
app.use("/api/explainTruth", explainTruthRoute);

/**
 * Route: Retrieve the full state of an existing game.
 * @route GET /api/state/:id
 */
app.use("/api/state", stateRoute);

/**
 * Route: List all active and completed game sessions.
 * @route GET /api/games
 */
app.use("/api/games", listGamesRoute);

/**
 * Health check endpoint.
 * Allows external tools or browsers to verify that the API is running.
 *
 * @route GET /
 * @returns {string} Confirmation message
 */
app.get("/", (req, res) => res.send("Unbelievable Truth API is running"));

/**
 * Start the HTTP server.
 * @param {number} port - The port number the API listens on.
 */
app.listen(3023, () =>
  console.log("API listening on port 3023")
);
