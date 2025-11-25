import fetch from "node-fetch";
import { ChatOllama } from "@langchain/ollama";
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";
import { createAgent, tool } from "langchain";
import * as z from "zod";

// Parse Ollama NDJSON safely
function parseOllamaResponse(raw) {
  let last = null;

  // Split into lines (each line is a JSON object)
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);
      last = json; // most recent contains the final response
    } catch (err) {
      console.error("Failed to parse Ollama line:", line);
    }
  }
  return last?.response || "";
}

export async function askOllama(prompt) {
	
  console.log("🟦 [Activity] Sending prompt to Ollama:", prompt);

  try {
    const response = await fetch("http://host.docker.internal:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         model: "llama3:latest", //"llama3.2:3b", // "llama3:latest", //   "gpt-oss:20b",
        prompt,
        stream: false
      })
    });

    const raw = await response.text();
    console.log("🟩 [Activity] Raw Ollama output:", raw);

    const result = parseOllamaResponse(raw);

    console.log("🟩 [Activity] Parsed Ollama response:", result);

    return result;
  } catch (err) {
    console.error("🟥 [Activity] Ollama ERROR:", err);
    throw err;
  }
}



export async function searchGoogleActivity(subject) {
	const googleSearchSubject = "Weird and interesting facts about "+subject;
  console.log("🌐 [Activity] Running Google search:", subject);

  const google = new GoogleCustomSearch({
    apiKey: process.env.GOOGLE_API_KEY,
    googleCSEId: process.env.GOOGLE_CSE_ID,
    maxResults: 10,
  });

  const results = await google.call(googleSearchSubject);
  //const results = "[{\"title\":\"Tim Henman - Wikipedia\",\"link\":\"https://en.wikipedia.org/wiki/Tim_Henman\",\"snippet\":\"Timothy Henry Henman OBE (born 6 September 1974) is a British former professional tennis player. He was ranked world No. 4 in men's singles\"},{\"title\":\"Tim Henman | Overview | ATP Tour | Tennis\",\"link\":\"https://www.atptour.com/en/players/tim-henman/h336/overview\",\"snippet\":\"Personal details · DOB1974/09/06 · Weight170 lbs (77kg) · Height6'1\\\" (185cm) · Turned pro1993 · Follow player. CountryGreat Britain ...\"},{\"title\":\"Thoughts on Tim Henman as a player ? I personally owe him a lot ...\",\"link\":\"https://www.reddit.com/r/tennis/comments/sjyd0q/thoughts_on_tim_henman_as_a_player_i_personally/\",\"snippet\":\"Feb 4, 2022 ... Henman is also one of the few players to defeat Fed at Wimbledon and also holds a 5-0 record against him on indoor courts which is crazy.\"},{\"title\":\"Tim Henman's racquet? | Talk Tennis\",\"link\":\"http://tt.tennis-warehouse.com/index.php?threads/tim-henmans-racquet.54849/\",\"snippet\":\"Nov 2, 2005 ... The speculation has been that Henman has never even used any Slazenger racquet but has been using paintjobs of a Wilson PS 6.1 Classic with the PWS removed.\"},{\"title\":\"I'm former tennis player Tim Henman, ask me anything! : r/tennis\",\"link\":\"https://www.reddit.com/r/tennis/comments/160788i/im_former_tennis_player_tim_henman_ask_me_anything/\",\"snippet\":\"Aug 24, 2023 ... Hi everyone, I'm former British number 1 Tim Henman! I'lll be here at 7:00pm on Friday 25th August to answer your questions. Ask me anything!\"},{\"title\":\"A sobering reminder: Tim Henman will always lead Roger Federer 5 ...\",\"link\":\"http://tt.tennis-warehouse.com/index.php?threads/a-sobering-reminder-tim-henman-will-always-lead-roger-federer-5-0-in-their-h2h-on-indoor-courts.653519/\",\"snippet\":\"Sep 9, 2019 ... Across the span of five years between 1999-2004, Tim Henman not only continually bested Federer on indoor surfaces, but did so with aplomb.\"},{\"title\":\"David's hatred for Tim Henman is honestly one of the best things I've ...\",\"link\":\"https://www.reddit.com/r/WILTY/comments/q01mq6/davids_hatred_for_tim_henman_is_honestly_one_of/\",\"snippet\":\"Oct 2, 2021 ... Henman gets ragged on pretty good across the board, they had fun tearing him up on Mock the Week as well, but David's roast/rant is hilarious.\"},{\"title\":\"Tim Henman named Vice Captain of Team Europe | News | Laver Cup\",\"link\":\"https://lavercup.com/news/2025/03/25/tim-henman-named-vice-captain-of-team-europe-for-laver-cup\",\"snippet\":\"Mar 25, 2025 ... Former British No.1 and six-time Grand Slam semifinalist Tim Henman has been named Team Europe Vice Captain for the Laver Cup starting with the 2025 edition.\"},{\"title\":\"My body & soul: Tim Henman, ex-tennis player, 33 | Life and style ...\",\"link\":\"https://www.theguardian.com/lifeandstyle/2008/jun/15/healthandwellbeing\",\"snippet\":\"Jun 15, 2008 ... I always had a pretty healthy lifestyle when I was playing tennis, but since I've retired that's kind of gone out the window. Retiring has been brilliant.\"},{\"title\":\"Tim Henman Quotes - BrainyQuote\",\"link\":\"https://www.brainyquote.com/authors/tim-henman-quotes\",\"snippet\":\"“If there has been any match-fixing then we need to make sure that it's erased from our sport because it's a crime in sports. We have no place for it in any ...\"}]";

  console.log("🔍 Google results:", results);

  return results;
}


export async function extractFactsActivity(subject, results) {
  console.log("🤖 [Activity] Extracting facts for:", subject);

  const llm = new ChatOllama({
    model: "llama3:latest", //"llama3.2:3b", //  "llama3:latest", //   "gpt-oss:20b",
    temperature: 0,
    baseUrl: "http://host.docker.internal:11434",
  });

  const prompt = `
You are a JSON-only API.

TASK:
Given the following search results, extract a random number (between 1 and 6 ) of fully verifiable historical, scientific, or cultural facts about: "${subject}". 

Each fact must be:
- absolutely true
- widely accepted
- supported by reputable sources

RULES:
- Respond with a JSON array ONLY.
- No explanation, no commentary, no natural language.
- Do NOT repeat the prompt.
- Do NOT wrap the JSON in backticks or markdown.
- Your entire response MUST be a single JSON array that can be parsed by JSON.parse.

SEARCH_RESULTS:
${JSON.stringify(results, null, 2)}

RESPONSE_FORMAT:
[
  {
    "fact": "string",
    "source": "string",
    "url": "string"
  }
]

FINAL VALIDATION (MANDATORY):
Before finishing, you MUST verify:
1. The first character of your ENTIRE output is "["
2. The JSON ends with "]"
3. The next characters immediately after "]" are <<<END>>>
4. NOTHING appears after <<<END>>>
5. No missing quotes, commas, or brackets

You MUST output ONLY:
The final valid JSON object
FOLLOWED IMMEDIATELY by:
<<<END>>>

NOTHING ELSE.


`;

  const response = await llm.invoke(prompt);
  const answerRaw = extractLastJsonArray(response.content);
  
  const answer = answerRaw.replace(/<<<END>>>[\s\S]*$/, "").trim();

  console.log("🧠 [LLM JSON]:", answer);

	const returnJSON = JSON.parse(answer);
	
	console.log("Stringified JSON: "+JSON.stringify(returnJSON, null, 2));
	
  return returnJSON;
}



function extractLastJsonArray(text) {
  const regex = /\[[\s\S]*?\]/g;
  const matches = text.match(regex);

  if (!matches) {
    throw new Error("No JSON array found in model output");
  }

  // always take the LAST match — that's where the final answer is
  return matches[matches.length - 1];
}
