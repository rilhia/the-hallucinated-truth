import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
} from "@temporalio/workflow";


// ------------------------------------------------------------
//  ACTIVITIES
// ------------------------------------------------------------
const { askOllama, searchGoogleActivity, extractFactsActivity } =
  proxyActivities({ startToCloseTimeout: "5 minutes" });


// ------------------------------------------------------------
//  SIGNALS + QUERIES
// ------------------------------------------------------------
export const startGameSignal    = defineSignal("startGame");
export const explainTruthSignal = defineSignal("explainTruth");
export const noMoreTruthsSignal = defineSignal("noMoreTruths");

export const getStateQuery      = defineQuery("getState");


// ------------------------------------------------------------
//  WORKFLOW
// ------------------------------------------------------------
export async function unbelievableTruthWorkflow() {

  // ------------------------------------------------------------
  //  DURABLE STATE (minimised)
  // ------------------------------------------------------------
  let story            = "";          // final STORY array from model
  let knownFacts       = null;        // [{ fact, url }]
  let googleResults    = null;

  let userExplanations = [];          // [{ userText, matchedTruthIndex, correct }]
  let numFound         = 0;

  let gameStarted      = false;
  let finished         = false;
  let stage            = 0;           // 0 idle  1 story shown  2 guessing  3 finished

  let score            = 0;
  let lastReply        = "";
  let lastReplyTime    = null;
  let subject    = null;


  // ------------------------------------------------------------
  //  PUBLIC STATE
  // ------------------------------------------------------------
  setHandler(getStateQuery, () => ({
  	subject,
    story,
    knownFacts,
    userExplanations,
    numFound,
    stage,
    score,
    lastReply,
    lastReplyTime
  }));


  // ------------------------------------------------------------
  //  HELPERS
  // ------------------------------------------------------------
  const updateReply = (t) => {
    lastReply = t;
    lastReplyTime = new Date().toISOString();
  };

  const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.log("JSON PARSE ERROR:", err);
    console.log("RAW RESPONSE:", raw);
    return null;
  }
};


  // ------------------------------------------------------------
  //  START GAME
  // ------------------------------------------------------------
  setHandler(startGameSignal, async (promptSubject) => {
    if (gameStarted) return;
    gameStarted = true;
    subject = promptSubject;

    // 1. Google Search
    if (promptSubject && !googleResults) {
      try { googleResults = await searchGoogleActivity(promptSubject); }
      catch { googleResults = null; }
    }

    // 2. Extract facts
    if (promptSubject && googleResults && !knownFacts) {
      try { knownFacts = await extractFactsActivity(promptSubject, googleResults); }
      catch { knownFacts = []; }
    }

    // 3. Build prompt
    const prompt = initialGamePrompt(promptSubject, knownFacts);

    // 4. Call model
    const raw = await askOllama(prompt);
    
    const cleanedOutput = raw.replace(/<<<END>>>[\s\S]*$/, "").trim();
    
    updateReply(cleanedOutput);

    const parsed = safeParse(cleanedOutput);
    if (!parsed || !parsed.STORY) {
      // fallback
      story = [];
      stage = 1;
      return;
    }

    story = parsed.STORY;
    numFound = 0;
    stage = 1;
  });


  // ------------------------------------------------------------
  //  USER SAYS: "NO MORE TRUTHS"
  // ------------------------------------------------------------
  setHandler(noMoreTruthsSignal, () => {
    const allFound = numFound === knownFacts.length;

    if (allFound) {
      score += 2;
      updateReply("Well done! All truths were found!");
    } else {
      score -= 3;
      updateReply("Oh dear! You missed some truths...");
    }

    finished = true;
    stage = 3;
  });


  // ------------------------------------------------------------
  //  USER EXPLAINS A TRUTH
  // ------------------------------------------------------------
  setHandler(explainTruthSignal, async (userText) => {

    const judgePrompt = buildJudgePrompt(userText, knownFacts);
    const raw = await askOllama(judgePrompt);
    updateReply(raw);

    const parsed = safeParse(raw) || { matchIndex: null };
    const match = parsed.matchIndex;

    const alreadyFound = userExplanations.some(x =>
      x.matchedTruthIndex === match
    );

    if (match !== null && !alreadyFound) {
      score += 2;
      numFound++;
      userExplanations.push({ userText, matchedTruthIndex: match, correct: true });
    } else {
      score -= 3;
      userExplanations.push({ userText, matchedTruthIndex: match, correct: false });
    }

    stage = 2;
  });


  // ------------------------------------------------------------
  //  KEEP WORKFLOW ALIVE
  // ------------------------------------------------------------
  await condition(() => finished);
}



// ===================================================================
//  PROMPT (FACTS ARRAY REMOVED)
// ===================================================================
/*function initialGamePrompt(promptSubject, knownFacts = []) {

  const factsList = knownFacts.map((f, i) =>
    `FACT ${i + 1}: "${f.fact}"`
  ).join("\n");

  return `
You are writing a comedic lecture inspired by The Unbelievable Truth.

Your output MUST be ONLY one JSON object in this form:

{
  "STORY": [
    { "paragraph": "text", "number": 1 }
  ]
}

NO extra text before or after the JSON.
NO markdown, no comments.

STORY RULES:
- 4 to 8 paragraphs.
- Tone: confident, surreal, satirical, funny, weird.
- Start with: "Today, I am here to talk about <subject>."
- You MUST include ALL supplied facts EXACTLY once.
- A supplied fact must appear as a complete sentence, word-for-word, except:
  * capitalise the first letter
  * add final full stop if missing

The FACTS you MUST embed verbatim:

${factsList}

All other statements MUST be completely false but plausible or surreal and funny.
Falsehoods must dominate the output.
Truths must be hidden in the text so that they are hard to find. 
Falsehoods surrounding the truths must help to hide the truths.
No paragraph may start with a true sentence.
Do NOT reorder or paraphrase facts.


OUTPUT ONLY:
{
  "STORY": [...]
}

HARD REQUIREMENTS

- No disclaimers
- No mention of AI or models
- No safety talk
- No breaking format
- No meta commentary
- The ouput MUST start with a { and end with a }.
- Absolutely NOTHING may appear before the opening { or after the closing } in the OUTPUT. 
- No whitespace, no text, no newlines. The entire output MUST be a single JSON object.

  `;
}*/
/*
function initialGamePrompt(promptSubject, knownFacts = []) {

  const factsList = knownFacts.map((f, i) =>
    `FACT ${i + 1}: "${f.fact}"`
  ).join("\n");

  return `
You are writing a comedic lecture inspired by The Unbelievable Truth.

Your output MUST be ONLY one JSON object in this exact form:

{
  "STORY": [
    { "paragraph": "text", "number": 1 }
  ]
}

NO extra text before or after the JSON.
NO markdown, no comments.

STORY RULES:
- 4 to 8 paragraphs.
- Tone: confident, surreal, satirical, funny, weird.
- Start with: "Today, I am here to talk about <subject>."
- You MUST include ALL supplied facts EXACTLY once.
- A supplied fact must appear as a complete sentence, word-for-word, except:
  * capitalise the first letter
  * add final full stop if missing

The FACTS you MUST embed verbatim:

${factsList}

All other statements MUST be completely false but plausible or surreal and funny.
Falsehoods must dominate the output.
Truths must be hidden in the text so that they are hard to find. 
Falsehoods surrounding the truths must help to hide the truths.
No paragraph may start with a true sentence.
Do NOT reorder or paraphrase facts.

OUTPUT ONLY:
{
  "STORY": [...]
}

HARD REQUIREMENTS:
- No disclaimers
- No mention of AI or models
- No safety talk
- No breaking format
- No meta commentary
- The ouput MUST start with "{"
- The ouput MUST end with "}"
- Absolutely NOTHING may appear before the opening "{" or after the closing "}"
- No whitespace, no text, no newlines, no trailing commas.

FINAL VALIDATION STEP (MANDATORY):
Before finishing, you MUST verify:
1. The first character of your entire output is "{"
2. The last character of your entire output is "}"
3. All brackets and braces match
4. All strings use standard double quotes
5. No trailing commas exist anywhere
6. NOTHING appears after the closing "}"

If ANY check fails, FIX the JSON before outputting it.

Output ONLY the final valid JSON object.

FINAL COMPLETION RULE (MANDATORY):
After generating the JSON object, perform this final step:

1. Look at the last character of your output.
2. If it is not "}", you MUST append "}".
3. You MUST then output the complete corrected JSON object again.
4. You MUST NOT output explanations of what you fixed.
5. The ONLY output I receive MUST be the final valid JSON object.

This rule overrides all others. Do not stop before completing these steps.
  `;
}
*/

function initialGamePrompt(promptSubject, knownFacts = []) {

  const factsList = knownFacts
    .map((f, i) => `FACT ${i + 1}: "${f.fact}"`)
    .join("\n");

  return `
You are writing a comedic lecture inspired by The Unbelievable Truth.

You MUST output ONLY one JSON object, followed immediately by the marker <<<END>>>.

The required final output format is:

{
  "STORY": [
    { "paragraph": "text", "number": 1 }
  ]
}
<<<END>>>

IMPORTANT:
- The JSON object MUST be valid.
- The JSON object MUST end with "}".
- After the final "}", you MUST output the marker <<<END>>>.
- NOTHING may appear after <<<END>>>.
- NOTHING may appear before the opening "{".
- No markdown, no comments, no explanations.

STORY RULES:
- 4 to 8 paragraphs.
- Tone: confident, surreal, satirical, funny, weird.
- Must begin with this exact sentence:
  "Today, I am here to talk about <subject>."
- You MUST include ALL supplied facts EXACTLY once.
- A supplied fact must appear as a complete sentence, word-for-word, except:
  * Capitalise the first letter
  * Add a final full stop if missing
- Do NOT paraphrase, alter, shorten, or expand any fact.
- No paragraph may start with a true sentence.
- False statements must dominate the story.
- All falsehoods must be plausible or surreal and funny.
- All facts must be hidden among falsehoods.
- Do NOT reorder the facts.

THE FACTS YOU MUST EMBED VERBATIM:

${factsList}

HARD REQUIREMENTS:
- No disclaimers
- No mention of AI or models
- No meta commentary
- No safety talk
- No trailing commas
- All strings must use standard double quotes
- All braces and brackets must match
- The JSON must be valid and parseable

FINAL VALIDATION (MANDATORY):
Before finishing, you MUST verify:
1. The first character of your ENTIRE output is "{"
2. The JSON ends with "}"
3. The next characters immediately after "}" are <<<END>>>
4. NOTHING appears after <<<END>>>
5. No missing quotes, commas, or brackets

You MUST output ONLY:
The final valid JSON object
FOLLOWED IMMEDIATELY by:
<<<END>>>

NOTHING ELSE.
  `;
}


// ===================================================================
//  JUDGE PROMPT (uses knownFacts only)
// ===================================================================
function buildJudgePrompt(userExplanation, knownFacts) {
  const list = knownFacts
    .map((f, i) => `Fact ${i}: "${f.fact}"`)
    .join("\n");

  return `
You must determine whether the USER EXPLANATION matches one of the facts.

FACTS:
${list}

USER EXPLANATION:
"${userExplanation}"

Return ONLY strict JSON:
{
  "matchIndex": number | null
}
  `;
}