// helpers/promptBuilder.js
/**
 * Build the initial game prompt instructing the LLM how to generate facts and format.
 *
 * @returns {string} The prompt used to initialise game content.
 */
export function initialGamePrompt(promptSubject, knownFacts = []) {
  const subject = promptSubject || "something deeply ridiculous";
  const factsList = JSON.stringify(knownFacts, null, 2);

  return `///////////////////////////////////////////////////////////////
 FACT-BOUND STORY ENGINE — SPEC v3.3.1 (TRADITIONAL + CAMOUFLAGE)
///////////////////////////////////////////////////////////////

SYSTEM ROLE
You are the FACT-BOUND STORY ENGINE.

Your sole task is to generate a comedic, surreal, misleading lecture in STRICT JSON format, embedding every fact from the supplied FACTS array exactly once somewhere within the story.

You must produce ONE valid JSON object preceeded immediately by <<<START>>> and followed immediately by <<<END>>>.

You must not output:
- explanations
- commentary
- markdown
- system acknowledgements
- anything except <<<START>>> + JSON object + <<<END>>>

///////////////////////////////////////////////////////////////
 INPUT FORMAT (MODEL MUST READ CAREFULLY)
///////////////////////////////////////////////////////////////

You will receive a JSON array named FACTS containing objects shaped like this:

[
  {
    "fact": "string",
    "url": "string",
    "source": "string"
  },
  ...
]

Let N = FACTS.length.

Each FACTS[i].fact must be included EXACTLY ONCE in the story.

ABSOLUTE FORMAT RULES (HARD)
- FIRST SECTION of ENTIRE output must be <<<START>>>
- THE FIRST CHARACTER of JSON must be "{"
- FINAL CHARACTER of JSON must be "}"
- Characters IMMEDIATELY after "}" must be: <<<END>>>
- NOTHING may appear after <<<END>>>
- NOTHING may appear before "{"
- No markdown, no code fences, no headings
- No comments, notes, or apology-like phrasing
- No trailing commas
- All strings must use standard double quotes
- JSON must be fully valid and parseable

///////////////////////////////////////////////////////////////
 FACT PAYLOAD (YOU MUST EMBED ALL OF THESE)
///////////////////////////////////////////////////////////////

${factsList}

///////////////////////////////////////////////////////////////
 REQUIRED OUTPUT SHAPE (MANDATORY)
///////////////////////////////////////////////////////////////

You MUST output EXACTLY this structure:

<<<START>>>
{
  "STORY": [
    { "paragraph": "text", "number": 1 },
    { "paragraph": "text", "number": 2 },
    ...
  ]
}
<<<END>>>

RULES (HARD)
- FIRST SECTION of ENTIRE output must be <<<START>>>
- FIRST character of the JSON must be "{"
- Final character of the JSON must be "}"
- The characters IMMEDIATELY after "}" must be <<<END>>>
- NOTHING may appear before "{"
- NOTHING may appear after <<<END>>>
- No trailing commas
- JSON must fully parse
- All keys and all string values must use double quotes

///////////////////////////////////////////////////////////////
 STRUCTURAL RULES (NON-NEGOTIABLE)
///////////////////////////////////////////////////////////////

1. Number of paragraphs:
   - The STORY must contain EXACTLY (N x 2) paragraphs.

2. Mandatory opening line:
   Paragraph 1 MUST begin with this sentence phrased in a grammatically correct way:
   "Today, I am here to talk about ${subject}."
   After this sentence, it must continue with a funny and absurd falsehood.

3. Fact inclusion rules:
   - EVERY fact from FACTS[i].fact MUST appear EXACTLY ONCE somewhere in the STORY.
   - NO fact may appear in the first sentence of any paragraph.
   - Facts MUST be surrounded naturally by falsehoods.
   - You may rephrase facts, but their factual meaning MUST remain.
   - You MUST NOT distort, merge, duplicate, or omit facts.
   - You MUST NOT introduce any real-world facts that are not present in FACTS[i].fact.

4. Paragraph structure rules:
   - EVERY paragraph must begin with an unambiguously false statement.
   - Paragraphs MUST be traditional paragraphs:
       • multiple sentences (4 to 7 sentences each)
       • coherent narrative flow
       • not “micro-paragraphs” consisting of one isolated sentence
       • substantial enough to conceal facts naturally

///////////////////////////////////////////////////////////////
 CAMOUFLAGE RULES (ADDED, HARD)
///////////////////////////////////////////////////////////////

A. No fact spotlighting:
   - You MUST NOT use parentheses "(", ")" anywhere in the story text.
   - You MUST NOT use colon ":" to introduce a fact.
   - You MUST NOT use phrases that announce truth, including:
     "in fact", "as we all know", "actually", "the truth is", "historically",
     "according to", "it is documented", "sources say", "Wikipedia",
     "Britannica", "verified", "confirmed".

B. No standalone fact sentences:
   - A fact must never be its own sentence.
   - A fact must be embedded inside a longer sentence that also contains
     clearly false details before and after it.

C. Minimum hiding:
   - Any paragraph that contains a fact must contain at least TWO clearly false
     sentences in the same paragraph (not counting the sentence containing the fact).

FACT CONTRAST IS FORBIDDEN (HARD)

You must NOT introduce facts using contrastive framing, including:
- "or so they say"
- "in reality"
- "in truth"
- "but actually"
- "however"
- "it's well-documented"
- "they claim"
- "they say"

Facts must never be presented as a correction to a lie.
Facts must appear as if they are part of the lie.

FACT INTEGRATION RULE (HARD)

Every fact must be used to SUPPORT the false narrative of the paragraph,
not to contradict it.

A reader should initially accept the fact as part of the lie,
not recognize it as a correction.

ANTI-PATTERN RULE (HARD)

You must NOT use a one-fact-per-paragraph pattern.
Some paragraphs must contain:
- zero facts
- two facts woven together
- facts separated by at least two sentences

The placement must feel uneven and accidental.

///////////////////////////////////////////////////////////////
 STYLE & TONE REQUIREMENTS
///////////////////////////////////////////////////////////////

- Surreal
- Dryly authoritative
- Comedically overconfident
- Weirdly academic
- Highly imaginative
- Falsehoods must dominate and feel confidently delivered
- Facts must blend in as if they are absurd lies
- NO hinting about truth, rules, constraints, or any game-like structure

///////////////////////////////////////////////////////////////
 FINAL EXECUTION COMMAND
///////////////////////////////////////////////////////////////

After reading all instructions and the FACTS array:

Enter:

[STATE: GENERATE_STORY_JSON]
[MODE: MAXIMUM MISDIRECTION]
[CREATIVITY: HIGH]

Then output ONLY:
1. <<<START>>>
2. The valid JSON object
3. <<<END>>>

NOTHING ELSE.`;
}






/**
 * Build a judge prompt used to evaluate player explanations.
 *
 * @param {Object} opts - Options controlling judge behaviour.
 * @returns {string} The judge prompt text.
 */
export function buildJudgePrompt(userExplanation, knownFacts = []) {
  const list = knownFacts
    .map((f, i) => `Fact ${i}: "${f.fact}"`)
    .join("\n");

  return `
You must determine whether the USER EXPLANATION correctly matches one of the FACTS.
This requires strict factual consistency, not thematic similarity.

Absolute Rule

A user explanation is ONLY correct if:
	•	it does not contradict the fact in any specific detail
AND
	•	it does not change any numbers, dates, quantities, ages, or ranges
AND
	•	it preserves the correct direction of the details (e.g., “before age 14” is not the same as “before age 13”).

Non-Negotiable Specificity Rules
	1.	Numbers must match exactly unless they are completely omitted.
	•	Fact: “Expelled from 14 schools before age 13.”
	•	User: “Expelled from 13 schools…” → Incorrect (different number).
	•	User: “Expelled from many schools…” → Correct (no contradiction).
	2.	Ages and age ranges must match exactly in value and direction.
	•	Fact: “Before age 13.”
	•	User: “Before age 14.” → Incorrect (different condition).
	•	User: “When he was young.” → Correct (no contradiction).
	3.	If a user provides a specific detail, it must match the fact’s detail.
If they add specificity that is wrong → Incorrect.
If they stay general → Possibly correct.
	4.	Similarity of meaning is NOT enough.
Statements that are superficially similar but differ in specifics are not a match.
	5.	A user explanation that changes any measurable detail (number, date, age, duration, count, score, distance, year) is automatically incorrect.
There is no tolerance for “close enough” matches.


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

