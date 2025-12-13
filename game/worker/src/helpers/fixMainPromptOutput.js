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

	console.log("OUTPUT TO BE MODIFIED:"+str);
	
  let original = str;

  //
  // STEP 1: If <<<START>>> exists, strip everything before it
  //
  const startIndex = original.indexOf("<<<START>>>");
  if (startIndex !== -1) {
    original = original.slice(startIndex + "<<<START>>>".length);
  }

  //
  // STEP 2: Trim leading whitespace/newlines after <<<START>>>
  //
  original = original.replace(/^\s+/, "");

  //
  // STEP 3: Remove <<<END>>> in all valid forms (your existing logic)
  //

  // Force <<<END>>> to be the end of the string

  const END_MARKER = "<<<END>>>";
  const endIndex = original.indexOf(END_MARKER);

  if (endIndex !== -1) {
    original = original.slice(0, endIndex);
  }

  // CASE 1: ends with } + newline + <<<END>>>
  if (
    original.endsWith("}\n<<<END>>>") ||
    original.endsWith("}\r\n<<<END>>>") ||
    original.endsWith("}\\n<<<END>>>") // escaped newline
  ) {
    return original.replace(/}\s*(?:\\n|\r?\n)<<<END>>>$/, "}");
  }

  // CASE 2: ends with newline + END marker (missing brace)
  if (
    original.endsWith("\n<<<END>>>") ||
    original.endsWith("\r\n<<<END>>>") ||
    original.endsWith("\\n<<<END>>>")
  ) {
    return original.replace(/(?:\\n|\r?\n)<<<END>>>$/, "}");
  }

  // CASE 3: ends with <<<END>>> directly
  if (original.endsWith("<<<END>>>")) {
    return original.slice(0, -"<<<END>>>".length) + "}";
  }

  //
  // STEP 4: Return cleaned string
  //
  return original;
}
