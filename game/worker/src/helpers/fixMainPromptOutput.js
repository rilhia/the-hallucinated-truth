/**
 * Normalize model output from the main prompt.
 *
 * Removes surrounding markers, fixes trailing characters and ensures the
 * string looks like a JSON object (ends with '}').
 *
 * @param {string} raw - Raw model output string.
 * @returns {string} Normalized string suitable for JSON parsing.
 */
export function fixMainPromptOutput(str) {
  if (!str) return str;

  console.log("OUTPUT TO BE MODIFIED:" + str);

  let original = str;

  const START = "<<<START>>>";
  const END   = "<<<END>>>";

  //
  // STEP 1: Find LAST <<<START>>> and LAST <<<END>>>
  //
  const startIndex = original.lastIndexOf(START);
  const endIndex   = original.lastIndexOf(END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    original = original.slice(
      startIndex + START.length,
      endIndex
    );
  }

  //
  // STEP 2: Trim whitespace
  //
  original = original.trim();

  //
  // STEP 3: Return cleaned JSON string
  //
  return original;
}
