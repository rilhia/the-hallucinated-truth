// workflows/hallucinatedTruthWorkflow.js
import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
} from "@temporalio/workflow";

import { safeParseJson } from "../helpers/safeParseJson.js";
import { initialGamePrompt, buildJudgePrompt } from "../helpers/promptBuilder.js";

// ------------------------------------------------------------
//  ACTIVITIES
// ------------------------------------------------------------
const { askOllama, searchGoogleActivity, extractFactsActivity } =
  proxyActivities({
    startToCloseTimeout: "5 minutes",
  });

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
export async function hallucinatedTruthWorkflow() {
  // ------------------------------------------------------------
  //  DURABLE STATE (minimised)
  // ------------------------------------------------------------
  let story            = [];         // STORY array from model
  let knownFacts       = null;       // [{ fact, url }]
  let googleResults    = null;

  let userExplanations = [];         // [{ userText, matchedTruthIndex, correct }]
  let numFound         = 0;

  let gameStarted      = false;
  let finished         = false;
  let stage            = 0;          // 0 idle, 1 story shown, 2 guessing, 3 finished

  let score            = 0;
  let lastReply        = "";
  let lastReplyTime    = null;
  let subject          = null;

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
    lastReplyTime,
  }));

  // ------------------------------------------------------------
  //  HELPERS
  // ------------------------------------------------------------
  const updateReply = (t) => {
    lastReply = t;
    lastReplyTime = new Date().toISOString();
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
      try {
        googleResults = await searchGoogleActivity(promptSubject);
      } catch {
        googleResults = null;
      }
    }

    // 2. Extract facts
    if (promptSubject && googleResults && !knownFacts) {
      try {
        knownFacts = await extractFactsActivity(promptSubject, googleResults);
      } catch {
        knownFacts = [];
      }
    }

    // 3. Build prompt (defensive: ensure array)
    const prompt = initialGamePrompt(promptSubject, knownFacts || []);

    // 4. Call model
    const raw = await askOllama(prompt);

    // Strip sentinel marker if present
    const cleanedOutput = raw.replace(/<<<END>>>[\s\S]*$/, "").trim();

    updateReply(cleanedOutput);

    const parsed = safeParseJson(cleanedOutput);
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
    const totalFacts = (knownFacts || []).length;
    const allFound   = numFound === totalFacts && totalFacts > 0;

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
    const factsArray = knownFacts || [];

    const judgePrompt = buildJudgePrompt(userText, factsArray);
    const raw = await askOllama(judgePrompt);
    updateReply(raw);

    const parsed = safeParseJson(raw) || { matchIndex: null };
    const match  = parsed.matchIndex;

    const alreadyFound = userExplanations.some(
      (x) => x.matchedTruthIndex === match
    );

    if (match !== null && !alreadyFound) {
      score += 2;
      numFound++;
      userExplanations.push({
        userText,
        matchedTruthIndex: match,
        correct: true,
      });
    } else {
      score -= 3;
      userExplanations.push({
        userText,
        matchedTruthIndex: match,
        correct: false,
      });
    }

    stage = 2;
  });

  // ------------------------------------------------------------
  //  KEEP WORKFLOW ALIVE
  // ------------------------------------------------------------
  await condition(() => finished);
}