// activities/searchGoogle.js
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";

/*
export async function searchGoogleActivity(subject) {
  const googleSearchSubject = "Weird and interesting facts about " + subject;
  console.log("🌐 [Activity] Running Google search:", googleSearchSubject);

  const google = new GoogleCustomSearch({
    apiKey: process.env.GOOGLE_API_KEY,
    googleCSEId: process.env.GOOGLE_CSE_ID,
    maxResults: 10,
  });

  const results = await google.call(googleSearchSubject);
  console.log("🔍 Google results:", results);

  return results;
}
*/


export async function searchGoogleActivity(subject) {
  const query = "In-depth, detailed, comprehensive facts about " + subject;

  console.log("🌐 [Activity] Running Google search:", query);

  const google = new GoogleCustomSearch({
    apiKey: process.env.GOOGLE_API_KEY,
    googleCSEId: process.env.GOOGLE_CSE_ID,
    num: 10,   // max allowed by Google
  });

  let results = [];

  // Page 1 → start = 1
  const page1 = await google.call(query, { start: 1 });
  results = results.concat(page1);

  // Page 2 → start = 11
  const page2 = await google.call(query, { start: 11 });
  results = results.concat(page2);

  // Limit to 20 results total
  return results.slice(0, 20);
}