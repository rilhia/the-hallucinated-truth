// helpers/safeParseJson.js
export function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("JSON PARSE ERROR:", err?.message || err);
    console.error("RAW RESPONSE:", raw);
    return null;
  }
}