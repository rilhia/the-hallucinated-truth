// activities/extractFacts.js
import { ChatOllama } from "@langchain/ollama";
import { safeParseJson } from "../helpers/safeParseJson.js";

export async function extractFactsActivity(subject, results) {
  console.log("🤖 [Activity] Extracting facts for:", subject);

  const llm = new ChatOllama({
    model: "llama3:latest", // or llama3.2:3b
    temperature: 0.5,
    baseUrl: "http://host.docker.internal:11434",
  });

  const prompt = `
You are a JSON-only API.

Given the following search results, extract a random number (between 3 and 6) of fully verifiable historical, scientific, or cultural facts about: "${subject}". 

Each fact must be:
- absolutely true
- widely accepted
- supported by reputable sources

RULES:
- Respond with a JSON array ONLY.
- No explanation, no commentary.
- Do NOT wrap the JSON in backticks or markdown.
- Response MUST be a single JSON array that can be parsed by JSON.parse.

SEARCH_RESULTS:
${JSON.stringify(results, null, 2)}

RESPONSE_FORMAT:
[
  {
    "fact": "string",
    "source": "string",
    "url": "string"
  }
]

At the end, you MAY optionally append <<<END>>>.
No other text is allowed.
`;

  const response = await llm.invoke(prompt);
  const rawText  = typeof response.content === "string"
    ? response.content
    : response.content?.toString() ?? "";

  const jsonFragment = extractLastJsonArray(rawText)
    .replace(/<<<END>>>[\s\S]*$/, "")
    .trim();

  console.log("🧠 [LLM JSON]:", jsonFragment);

  const parsed = safeParseJson(jsonFragment);
  if (!parsed || !Array.isArray(parsed)) {
    throw new Error("Fact extraction returned invalid JSON array");
  }

  console.log("Stringified JSON:", JSON.stringify(parsed, null, 2));

  // Optionally normalise shape if you only care about fact + url
  return parsed.map((f) => ({
    fact: f.fact,
    url: f.url,
    source: f.source,
  }));
}

function extractLastJsonArray(text) {
  const regex = /\[[\s\S]*?\]/g;
  const matches = text.match(regex);
  if (!matches) {
    throw new Error("No JSON array found in model output");
  }
  return matches[matches.length - 1];
}