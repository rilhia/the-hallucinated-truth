/**
 * Safely parse a JSON string.
 *
 * @param {string} str - JSON string to parse.
 * @param {*} [fallback=null] - Value to return if parsing fails.
 * @returns {*} Parsed object or the fallback value.
 */
export function safeParseJson(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.error("JSON PARSE ERROR:", err?.message || err);
    console.error("RAW RESPONSE:", str);
    return fallback;
  }
}