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
 * @property {function(string): Promise<any>} extractFactsActivity - Fact extraction activity.
 * @property {function(any,string): Promise<Array<{fact:string,url:string}>>} getFactsFromWeb - Extract and return facts from search results.
 * @property {function(Array): Promise<Array>} reduceKnownFacts - Filters and deduplicates collected facts.
 */
const { askOllama, searchGoogle, extractFactsActivity, getFactsFromWeb, reduceKnownFacts } =
  proxyActivities({
    startToCloseTimeout: "5 minutes",
  });

// ------------------------------------------------------------
//  SIGNALS + QUERIES
// ------------------------------------------------------------

/** Signal: Trigger Google search and begin game initialisation. */
export const searchGoogleSignal = defineSignal("searchGoogle");

/** Signal: Collect factual data from search results. */
export const collectFactsSignal = defineSignal("collectFacts");

/** Signal: Filter facts, generate story prompt, and start core gameplay. */
export const filterFactsSignal = defineSignal("filterFacts");

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
  //  Search Google
  // ------------------------------------------------------------

  /**
   * Signal handler: Initiates the Google search + starts game setup.
   * @param {string} promptSubjectArg - The subject provided by the user.
   */
  setHandler(searchGoogleSignal, async (promptSubjectArg) => {
    if (gameStarted) return;
    gameStarted = true;

    subject = promptSubjectArg;

    googleResults = await searchGoogle(promptSubjectArg);

    numFound = 0;
    stage = 1;
  });

  // ------------------------------------------------------------
  //  START GAME (Collect facts)
  // ------------------------------------------------------------

  /**
   * Signal handler: Fetches facts from the web based on googleResults.
   * Waits until the Google search has completed.
   */
  setHandler(collectFactsSignal, async () => {
    await condition(() => googleResults !== null);

    console.log("CollectFacts running with googleResults:", googleResults);

    knownFacts = await getFactsFromWeb(googleResults, subject);

    stage = 1;
  });

  // ------------------------------------------------------------
  //  START GAME (Filter facts + Build story)
  // ------------------------------------------------------------

  /**
   * Signal handler: Filters facts, builds the story prompt, queries Ollama,
   * parses the output, and prepares the STORY for gameplay.
   */
  setHandler(filterFactsSignal, async () => {
    await condition(() => knownFacts !== null);

    if (knownFacts.length > 0) {
      console.log("FilterFacts running with collected facts:", knownFacts);

      knownFacts = await reduceKnownFacts(knownFacts);

      const prompt = initialGamePrompt(subject, knownFacts || []);
      const raw = await askOllama(prompt);

      const cleanedOutput = fixMainPromptOutput(raw);
      updateReply(cleanedOutput);

      const parsed = safeParseJson(cleanedOutput);
      if (!parsed || !parsed.STORY) {
        story = [];
        stage = 1;
        return;
      }

      story = parsed.STORY;
      numFound = 0;
      stage = 1;
    } else {
      updateReply(`It was not possible to generate a story about "${subject}". Try something different.`);
      stage = -1;
      finished = true;
    }
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