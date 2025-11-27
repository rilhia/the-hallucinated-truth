// helpers/promptBuilder.js

export function initialGamePrompt(promptSubject, knownFacts = []) {
  const subject = promptSubject || "something deeply ridiculous";

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
  "Today, I am here to talk about ${subject}."
- You MUST include ALL supplied facts EXACTLY once.
- A supplied fact must appear completely and totally inline with the fact provided.
- Do NOT paraphrase, alter, shorten, or expand any fact.
- No paragraph may start with a true sentence.
- False statements must dominate the story.
- All falsehoods must be plausible or surreal and funny.
- All falsehoods must be completely false. There must NOT be any possibility that a falsehood could be true.
- All facts must be hidden among falsehoods.
- Do NOT reorder the facts.

THE FACTS YOU MUST EMBED:

${factsList}

HARD REQUIREMENTS:
- All facts MUST be included in the story
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
The valid and complete JSON object
FOLLOWED IMMEDIATELY by:
<<<END>>>

NOTHING ELSE.
  `;
}

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