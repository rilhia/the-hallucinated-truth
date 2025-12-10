import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/index.js";
import path from "path";
import { fileURLToPath } from "url";


/**
 * Entry point for starting a Temporal Worker.
 *
 * This worker:
 *  - Connects to a Temporal cluster (using TEMPORAL_ADDRESS if provided).
 *  - Registers workflow code located in `workflows/hallucinatedTruthWorkflow.js`.
 *    (If multiple workflows are added, update the index or path accordingly.)
 *  - Registers all activity functions exported from `./activities/index.js`.
 *  - Listens on the "truth-game" task queue for workflow and activity tasks.
 *  - Runs indefinitely until the process is stopped or an error occurs.
 *
 * Environment variables:
 *  - TEMPORAL_ADDRESS (optional): `<host>:<port>` of the Temporal server.
 *    Defaults to `"temporal:7233"` if unset.
 *
 * Errors:
 *  - Any unhandled error in worker startup or execution is logged,
 *    and the process exits with status code 1.
 *
 * @async
 * @returns {Promise<void>} Resolves once the worker has started running.
 */
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