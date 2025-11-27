import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/index.js";
import path from "path";
import { fileURLToPath } from "url";

async function run() {
  const address = process.env.TEMPORAL_ADDRESS || "temporal:7233";
  console.log("Connecting to Temporal at:", address);

  const connection = await NativeConnection.connect({ address });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const worker = await Worker.create({
    connection,
    taskQueue: "truth-game",
    workflowsPath: path.join(__dirname, 'workflows', 'hallucinatedTruthWorkflow.js'), //add to index.js if more than one workflow
    activities,
  });

  console.log("Worker started");
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});