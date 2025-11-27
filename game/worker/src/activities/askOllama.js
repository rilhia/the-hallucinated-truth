// activities/askOllama.js
import fetch from "node-fetch";
import { ChatOllama } from "@langchain/ollama";

/*
export async function askOllama(prompt) {
  console.log("🟦 [Activity] Sending prompt to Ollama:", prompt);

  try {
    const response = await fetch("http://host.docker.internal:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3:latest",
        prompt,
        stream: false,
      }),
    });

    const raw = await response.text();
    console.log("🟩 [Activity] Raw Ollama output:", raw);

    const json = JSON.parse(raw);       // ← REAL fix
    const result = json.response;       // ← FINAL TEXT

    console.log("🟩 [Activity] Parsed Ollama response:", result);
    return result;

  } catch (err) {
    console.error("🟥 [Activity] Ollama ERROR:", err);
    throw err;
  }
}
*/


export async function askOllama(prompt) {
  console.log("🟦 [Activity] Sending prompt to Ollama:", prompt);

  try {
    const llm = new ChatOllama({
      model: "llama3:latest",
      temperature: 0.7,               // match your deterministic behaviour
      baseUrl: "http://host.docker.internal:11434",
    });

    // LangChain always returns a "message"
    const response = await llm.invoke(prompt);

    // Extract the actual text content
    const result =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.join("")
          : String(response.content || "");

    console.log("🟩 [Activity] Parsed Ollama response:", result);
    return result;

  } catch (err) {
    console.error("🟥 [Activity] Ollama ERROR:", err);
    throw err;
  }
}