import { Worker, NativeConnection } from "@temporalio/worker";
import path from "path";
import { askOllama, searchGoogleActivity, extractFactsActivity } from "./activities.js";

async function run() {
  const address = process.env.TEMPORAL_ADDRESS || "host.docker.internal:7233";
  console.log(` Connecting to Temporal at ${address}`);

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,

    // Load the new workflow that contains unbelievableTruthWorkflow
    workflowsPath: path.resolve("./src/workflow.js"),

    // Activities must include askOllama()
    activities: { askOllama, searchGoogleActivity, extractFactsActivity },

    // IMPORTANT: Task queue MUST match server.js
    taskQueue: "truth-game"
  });

  console.log(" Worker started for taskQueue truth-game");
  await worker.run();
}

run().catch(err => {
  console.error(" Worker failed:", err);
  process.exit(1);
});