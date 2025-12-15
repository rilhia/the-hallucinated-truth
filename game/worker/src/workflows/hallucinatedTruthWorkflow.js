/**
 * Temporal Workflow for the Hallucinated Truth game.
 * Controls state, responds to signals, calls activities, and manages scoring.
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
} from "@temporalio/workflow";

import { safeParseJson } from "../helpers/safeParseJson.js";
import { fixMainPromptOutput } from "../helpers/fixMainPromptOutput.js";
import { initialGamePrompt, buildJudgePrompt } from "../helpers/promptBuilder.js";

// ------------------------------------------------------------
//  ACTIVITIES
// ------------------------------------------------------------

/**
 * Activities used by this workflow.
 * @typedef {Object} Activities
 * @property {function(string): Promise<string>} askOllama - LLM call to Ollama.
 * @property {function(string): Promise<any>} searchGoogle - Google CSE search.
 * @property {function(any,string): Promise<Array<{fact:string,url:string}>>} getFactsFromWeb - Extract and return facts from search results.
 * @property {function(Array): Promise<Array>} reduceKnownFacts - Filters and deduplicates collected facts.
 */
const { askOllama, searchGoogle, getFactsFromWeb, reduceKnownFacts } =
  proxyActivities({
    startToCloseTimeout: "5 minutes",
  });

// ------------------------------------------------------------
//  SIGNALS + QUERIES
// ------------------------------------------------------------

/** Signal: Start processing the game after the user adds a theme */
export const startProcessingGameSignal = defineSignal("startProcessingGame");

/** Signal: User submits an explanation of a truth. */
export const explainTruthSignal = defineSignal("explainTruth");

/** Signal: User indicates they believe there are no more truths left. */
export const noMoreTruthsSignal = defineSignal("noMoreTruths");

/**
 * Query: Get public workflow state.
 * @returns {Object} state snapshot
 */
export const getStateQuery = defineQuery("getState");

// ------------------------------------------------------------
//  WORKFLOW
// ------------------------------------------------------------

/**
 * The main Hallucinated Truth game workflow.
 * Manages story creation, fact matching, scoring, user interactions, and finalisation.
 *
 * @workflow
 * @returns {Promise<void>}
 */
export async function hallucinatedTruthWorkflow() {
  // ------------------------------------------------------------
  //  DURABLE STATE (minimised)
  // ------------------------------------------------------------

  /** @type {Array<string>} STORY array returned from the model */
  let story = [];

  /** @type {Array<{fact:string,url:string}> | null} Facts collected from the web */
  let knownFacts = null;

  /** @type {any} Cached Google search results */
  let googleResults = null;

  /**
   * @type {Array<{
   *   userText: string,
   *   matchedTruthIndex: number|null,
   *   correct: boolean
   * }>}
   * Stores user explanations and whether they matched a truth.
   */
  let userExplanations = [];

  /** @type {number} Count of truths found by the user */
  let numFound = 0;

  /** @type {boolean} Whether the game has started */
  let gameStarted = false;

  /** @type {boolean} Whether the workflow/game has finished */
  let finished = false;

  /**
   * @type {number}
   * 0 idle, 1 story shown, 2 guessing, 3 finished
   */
  let stage = 0;

  /** @type {number} Player score */
  let score = 0;

  /** @type {string} The last message returned to the UI */
  let lastReply = "";

  /** @type {string | null} Timestamp of last reply */
  let lastReplyTime = null;

  /** @type {string | null} Subject the user asked about */
  let subject = null;

  // ------------------------------------------------------------
  //  PUBLIC STATE
  // ------------------------------------------------------------

  setHandler(getStateQuery, () => ({
    googleResults,
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

  /**
   * Updates the workflow's last reply and timestamp.
   * @param {string} t - Text to send to the UI.
   */
  const updateReply = (t) => {
    lastReply = t;
    lastReplyTime = new Date().toISOString();
  };


  // ------------------------------------------------------------
  //  Start Processing Game
  // ------------------------------------------------------------

  /**
   * Signal handler: Initiates the Google search + starts game setup.
   * @param {string} promptSubjectArg - The subject provided by the user.
   */
  setHandler(startProcessingGameSignal, async (promptSubjectArg) => {
    if (gameStarted) return;
    gameStarted = true;

    subject = promptSubjectArg;
    stage = 1;

    // 1. Search
    googleResults = await searchGoogle(subject);

    // 2. Extract facts
    knownFacts = await getFactsFromWeb(googleResults, subject);

    if (!knownFacts || knownFacts.length === 0) {
      updateReply(`It was not possible to generate a story about "${subject}". Try something different.`);
      stage = -1;
      finished = true;
      return;
    }

    // 3. Reduce facts
    knownFacts = await reduceKnownFacts(knownFacts);

    // 4. Generate story
    const prompt = initialGamePrompt(subject, knownFacts);
    const raw = await askOllama(prompt);

    const cleanedOutput = fixMainPromptOutput(raw);
    updateReply(cleanedOutput);

    const parsed = safeParseJson(cleanedOutput);
    story = parsed?.STORY ?? [];

    numFound = 0;
  });


  // ------------------------------------------------------------
  //  USER SAYS: "NO MORE TRUTHS"
  // ------------------------------------------------------------

  /**
   * Signal handler: User claims to be finished guessing truths.
   * Applies scoring rules and ends the game.
   */
  setHandler(noMoreTruthsSignal, () => {
    const totalFacts = (knownFacts || []).length;
    const allFound = numFound === totalFacts && totalFacts > 0;

    if (allFound) {
      score += 3;
      updateReply("Well done! All truths were found!");
    } else {
      score -= (2 * (totalFacts - numFound));
      updateReply("Oh dear! You missed some truths...");
    }

    finished = true;
    stage = 3;
  });

  // ------------------------------------------------------------
  //  USER EXPLAINS A TRUTH
  // ------------------------------------------------------------

  /**
   * Signal handler: User submits a possible explanation matching a truth.
   * The workflow checks correctness via LLM and updates score/state.
   *
   * @param {string} userText - The user-provided explanation.
   */
  setHandler(explainTruthSignal, async (userText) => {
    const factsArray = knownFacts || [];

    const judgePrompt = buildJudgePrompt(userText, factsArray);
    const raw = await askOllama(judgePrompt);
    updateReply(raw);

    const parsed = safeParseJson(raw) || { matchIndex: null };
    const match = parsed.matchIndex;

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
      score -= 2;
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

  /**
   * Keeps the workflow running until the game is finished.
   * @returns {Promise<void>}
   */
  await condition(() => finished);
}
