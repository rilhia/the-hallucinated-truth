/**
 * Shuffle and trim an array of facts to a game-friendly count.
 *
 * Mutates the provided array to reduce it to 4 or 5 items.
 *
 * @param {Array<Object>} facts - Array of fact objects (mutated in-place).
 * @returns {Array<Object>} The same array instance, shortened.
 */
export function reduceKnownFacts(facts) {
  if (!Array.isArray(facts)) return;

  // Randomly choose whether to keep 4 or 5
  const keepCount = Math.random() < 0.5 ? 4 : 5;

  // Fisher–Yates shuffle in place
  for (let i = facts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [facts[i], facts[j]] = [facts[j], facts[i]];
  }

  // MUTATE the array: remove everything except first keepCount items
  facts.splice(keepCount);
  
  return facts;
}

