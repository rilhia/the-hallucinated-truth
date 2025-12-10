// activities/getFactsFromWeb.js
import { ChatOllama } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { extractMainTextWithCheerio } from "./extractMainTextWithCheerio.js";


const llm = new ChatOllama({
  model: "llama3:latest",
  temperature: 0.2,               // match your deterministic behaviour
  baseUrl: "http://host.docker.internal:11434",
});


/**
 * Scrape web pages from search results, chunk content and extract candidate facts via an LLM.
 *
 * - Loads documents from search results
 * - Splits into chunks
 * - Calls the model to extract candidate facts
 * - Deduplicates and chooses a curated subset suitable for the game
 *
 * @param {Array<Object>} results - Search results with URLs to load.
 * @param {String} subject - Subject being searched.
 * @returns {Promise<Array<Object>>} Curated list of fact objects.
 */
export async function getFactsFromWeb(results, subject) {

  
  console.log("Search Results: "+results);

  // 2. Load full pages
  const docs = await loadDocsFromResults(results, 10);
  
  console.log("Docs: "+docs);

  // 3. Split into chunks
  const chunks = await chunkDocuments(docs, subject);
  
  console.log("Chunks: "+chunks);

  // 4. Extract weird facts
  const allFacts = await extractFactsFromChunks(subject, chunks);
  
  console.log("All Facts: "+allFacts);

  // 5. Pick 4–8 weirdest
  const selected = pickWeirdFactSubset(allFacts);

  console.log("🎭 Final weird facts:", selected);

  return selected;  // ← STRUCTURE EXACTLY AS YOU REQUESTED
}

/**
 * Helper: load documents from search results.
 *
 * @private
 */
async function loadDocsFromResults(results, maxPages = 10) {
  const urls = results
    .map(r => r.link || r.url)
    .filter(Boolean)
    .slice(0, maxPages);

  const docs = [];

  for (const url of urls) {
    try {
      console.log("📄 Scraping + cleaning:", url);

      // Use *your* extractor only
      const cleanedText = await extractMainTextWithCheerio(url);

      docs.push(
        new Document({
          pageContent: cleanedText,
          metadata: {
            url,
            parentUrl: url,
            source: url,
            parentSource: url,
          },
        })
      );

    } catch (err) {
      console.warn("❌ Failed to load", url, err.message);
    }
  }

  return docs;
}

/**
 * Helper: split documents into chunks for LLM processing.
 *
 * @private
 */
async function chunkDocuments(docs, subject) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 10000,
    chunkOverlap: 200,
  });

  let chunks = await splitter.splitDocuments(docs);

  // Randomise globally for better fact distribution
  //shuffleInPlace(chunks);
  
  chunks = chunks.filter(c => chunkIsAboutSubject(subject, c.pageContent));

  return chunks;
}






/**
 * Determines whether a chunk of text is plausibly about a given subject.
 *
 * The check runs in three tiers:
 *
 * A) Direct match:  
 *    - Any subject word (longer than 2 chars) appears within the text.
 *
 * B) Partial match + verb:  
 *    - At least one subject word appears, AND  
 *    - At least one common verb is present.
 *
 * C) Fallback heuristic:  
 *    - Text contains at least 2 pronouns, AND  
 *    - Contains at least 3 common English stopwords.
 *
 * If none of the above conditions pass, the function returns false.
 *
 * @param {string} subject - The subject we are trying to detect references to.
 * @param {string} text - The text chunk being evaluated.
 * @returns {boolean} True if the text appears to be about the subject; otherwise false.
 */
function chunkIsAboutSubject(subject, text) {
  const lower = text.toLowerCase();

  // A: direct match of subject words
  const subjectWords = subject
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (subjectWords.some(w => lower.includes(w))) {
    return true;
  }

  // B: verb presence + 1 subject word
  const verbs = [
    "is","was","are","were","have","has",
    "do","does","did","can","will",
    "use","make","take","give","get","go","run","form"
  ];

  const containsVerb = verbs.some(v => lower.includes(` ${v} `));
  const containsPartialSubject = subjectWords.some(w => lower.includes(w));

  if (containsPartialSubject && containsVerb) {
    return true;
  }

  // C: fallback — English-density + pronoun presence
  const pronouns = ["they","their","them","he","she","his","her","it"];

  const pronounCount = pronouns.filter(p => lower.includes(` ${p} `)).length;

  const STOPWORDS = [
  "the", "and", "in", "on", "to", "for", "of", "with", "is", "that", "this", "was", "are"
  ];

  const stopwordCount = STOPWORDS.filter(s => lower.includes(` ${s} `)).length;

  if (pronounCount >= 2 && stopwordCount >= 3) {
    return true;
  }

  // otherwise reject
  return false;
}






/**
 * Extracts unusual, explicit facts about a subject from multiple text chunks
 * by prompting an LLM to return structured JSON.
 *
 * For each chunk:
 *  - A fact-extraction prompt is constructed and sent to the model.
 *  - The model’s response is normalised to a raw string.
 *  - The function attempts to `JSON.parse` the output.
 *  - Valid facts are collected and annotated with URL + source metadata.
 *
 * Additional behaviour:
 *  - Processing stops early if 10 total facts have been collected.
 *  - Chunks with invalid or unparseable JSON are skipped.
 *
 * @async
 * @param {string} subject - The subject the LLM should extract facts about.
 * @param {Array<{ pageContent: string, metadata: object }>} chunks
 *        The text chunks to analyse, each containing text and metadata.
 * @returns {Promise<Array<{fact: string, url: string, source: string}>>}
 *          A list of validated, structured facts extracted by the LLM.
 */
async function extractFactsFromChunks(subject, chunks) {
  const allFacts = [];

  for (const chunk of chunks) {
  	if (allFacts.length >= 10) break;
    const text = chunk.pageContent;



const prompt = `
You are the FACT-EXTRACTION ENGINE.

Your ONLY output is a single valid JSON object.
The FIRST character MUST be "{" and the LAST character MUST be "}".

////////////////////////////////////////////////////////////////
// TASK
////////////////////////////////////////////////////////////////

1. Read the provided text.
2. Identify EVERY explicit factual statement about "${subject}" and only "${subject}".
3. From those, select up to 5 that are the most unusual, surprising,
   interesting, or uncommon.
4. A fact MUST be:
   - fully supported by the text exactly as written
   - not invented, assumed, or inferred
   - a complete, standalone sentence OR a faithful restatement
5. If the SOURCE TEXT contains *no explicit facts at all*, return:
   { "facts": [] }

////////////////////////////////////////////////////////////////
// SOURCE TEXT
////////////////////////////////////////////////////////////////

"""
${text.slice(0, 4000)}
"""

////////////////////////////////////////////////////////////////
// STRICT OUTPUT CONTRACT
////////////////////////////////////////////////////////////////

Return ONLY this structure, with no commentary:

{
  "facts": [
    { "fact": "FACT FROM SOURCE TEXT", "url": "${chunk.metadata.parentUrl}" }
  ]
}

RULES:
- JSON must be syntactically valid.
- "facts" must always be an array.
- "facts" can be an empty array if no facts are found.
- The array may be empty.
- Each object MUST contain:
    - "fact": string
    - "url": string (always "${chunk.metadata.parentUrl}")
- No trailing commas.
- No markdown.
- No explanation.
- No extra text before or after the JSON.

BEGIN NOW.
`;

console.log("Prompt: "+prompt);



    const res = await llm.invoke([{ role: "user", content: prompt }]);

    const raw =
      typeof res.content === "string"
        ? res.content
        : Array.isArray(res.content)
        ? res.content.map(c => (typeof c === "string" ? c : c.text || "")).join("\n")
        : String(res.content);

    let parsed;
    try {
      parsed = JSON.parse(raw);
      console.log("Good JSON:"+JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.warn("⚠️ Failed to parse JSON:", raw);
      continue;
    }

    if (!parsed.facts || !Array.isArray(parsed.facts)) continue;

    for (const f of parsed.facts) {
      if (!f || typeof f !== "object") continue;
      if (!f.fact || typeof f.fact !== "string") continue;

			allFacts.push({
  			fact: f.fact.trim(),
  			url: chunk.metadata.parentUrl,
  			source: chunk.metadata.parentSource,
			});

    }
    
    console.log("Chunk: "+text.slice(0, 4000));
  }

  return allFacts;
}

/**
 * Deduplicates a list of fact objects, randomises the order,
 * and returns a subset of 4–8 "weird" facts.
 *
 * Steps:
 *  1. Deduplicate by lower-cased fact text.
 *  2. Shuffle to introduce variety between runs.
 *  3. Enforce the `maxCount` upper bound.
 *  4. Warn if fewer than `minCount` are available.
 *
 * @param {Array<{ fact: string, url: string, source: string }>} facts
 *        An array of fact objects to filter and select from.
 * @param {number} [maxCount=8] - Maximum number of facts to return.
 * @param {number} [minCount=4] - Minimum preferred number of facts.
 * @returns {Array<object>} A shuffled, deduplicated subset of the fact list.
 */
function pickWeirdFactSubset(facts, maxCount = 8, minCount = 4) {
  const map = new Map();

  for (const f of facts) {
    const key = f.fact.toLowerCase().trim();
    if (!map.has(key)) map.set(key, f);
  }

  let deduped = Array.from(map.values());

  // Shuffle so results vary
  deduped = deduped
    .map(f => ({ rand: Math.random(), f }))
    .sort((a, b) => a.rand - b.rand)
    .map(x => x.f);

  if (deduped.length > maxCount) return deduped.slice(0, maxCount);
  if (deduped.length < minCount) {
    console.warn(`⚠️ Only ${deduped.length} weird facts found.`);
  }

  return deduped;
}



