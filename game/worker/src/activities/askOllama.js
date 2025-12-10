// activities/askOllama.js
import { ChatOllama } from "@langchain/ollama";

/**
 * Send a prompt to Ollama (via LangChain wrapper) and return a normalized response.
 *
 * @param {string} prompt - Prompt text for the model.
 * @param {Object} [opts] - Optional request options (model, temperature, etc).
 * @returns {Promise<string>} Model response text.
 */
export async function askOllama(prompt, opts = {}) {
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
    const result = normaliseContent(response.content);
    
    console.log("🟩 [Activity] Parsed Ollama response:", result);
    return result;

  } catch (err) {
    console.error("🟥 [Activity] Ollama ERROR:", err);
    throw err;
  }
}


/**
 * Normalise a content value into a string.
 *
 * - If the value is already a string, it is returned as-is.
 * - If the value is an array, its elements are joined into a single string.
 * - For any other value (including null/undefined), it is converted to a string.
 *
 * @param {*} c - The content to normalise. May be a string, array, or any other type.
 * @returns {string} A normalised string representation of the input.
 */
function normaliseContent(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.join("");
  return String(c || "");
}



