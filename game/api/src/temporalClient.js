import { Connection, Client } from "@temporalio/client";

let client;

export async function getTemporalClient() {
  if (!client) {
    const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";

    console.log(`Connecting to Temporal at ${address}...`);
    const connection = await Connection.connect({ address });
    client = new Client({ connection });
    console.log("Connected to Temporal");
  }
  return client;
}