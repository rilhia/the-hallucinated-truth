// activities/searchGoogle.js
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";


/**
 * Perform a Google Custom Search and post-filter results.
 *
 * Filters out non-HTML targets (PDFs, drive links, images) and returns
 * a curated list of search result entries.
 *
 * @param {string} query - Search query string.
 * @param {Object} [opts] - Optional search parameters.
 * @returns {Promise<Array<Object>>} Filtered search results.
 */
export async function searchGoogle(subject) {
	const googleSearchSubject = `
  Interesting facts about "${subject}"
  (site:wikipedia.org OR 
  site:britannica.com OR 
  site:nationalgeographic.com OR 
  site:smithsonianmag.com OR 
  site:scientificamerican.com OR 
  site:history.com OR 
  site:biography.com OR 
  site:nasa.gov OR 
  site:noaa.gov OR 
  site:nih.gov OR 
  site:nps.gov OR 
  site:loc.gov OR 
  site:fda.gov OR 
  site:cdc.gov OR 
  site:esa.int OR 
  site:jpl.nasa.gov OR 
  site:nature.com OR 
  site:science.org OR 
  site:newscientist.com OR 
  site:si.edu OR 
  site:encyclopedia.com OR 
  site:worldatlas.com OR 
  site:un.org OR 
  site:who.int OR 
  site:.gov OR 
  site:.edu)
`;
	
	
  console.log("🌐 [Activity] Running Google search:", googleSearchSubject);

  const google = new GoogleCustomSearch({
    apiKey: process.env.GOOGLE_API_KEY,
    googleCSEId: process.env.GOOGLE_CSE_ID,
    maxResults: 10,
  });

  let results = await google.call(googleSearchSubject);
  console.log("🔍 Google results:", results);

  // If it's a string, parse it
  if (typeof results === "string") {
    try {
      results = JSON.parse(results);
    } catch (err) {
      console.error("❌ Could not parse JSON:", err);
      return [];
    }
  }

  // If it's wrapped in { output: [...] }
  if (results?.output && Array.isArray(results.output)) {
    results = results.output;
  }

  // Final guard
  if (!Array.isArray(results)) {
    console.error("❌ Google results is NOT an array:", results);
    return [];
  }
  
  
  //Block pdfs and other file types
  results = results.filter(r => {
  const url = (r.link || r.url || "").toLowerCase();

  // block by extension
  if (url.endsWith(".pdf")) return false;
  if (url.endsWith(".ppt")) return false;
  if (url.endsWith(".pptx")) return false;
  if (url.endsWith(".doc")) return false;
  if (url.endsWith(".docx")) return false;
  
  // images
  if (url.endsWith(".jpg")) return false;
  if (url.endsWith(".jpeg")) return false;

  // block URLs containing format indicators
  if (url.includes("format=pdf")) return false;
  if (url.includes("type=pdf")) return false;

  // block Google Drive and file viewers
  if (url.includes("drive.google.com")) return false;
  if (url.includes("viewer")) return false;

  return true;
	});
  
  

  return results;
}


