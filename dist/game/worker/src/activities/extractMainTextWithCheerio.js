import * as cheerio from "cheerio";
import fetch from "node-fetch";

/**
 * Fetch HTML for a URL and extract the main textual content using Cheerio.
 *
 * Returns cleaned plain text suitable for chunking and LLM consumption.
 *
 * @param {string} url - URL to fetch and extract.
 * @returns {Promise<string>} Extracted and cleaned main text.
 */
export async function extractMainTextWithCheerio(url) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // 1. Remove giant trash elements
  $("script, style, nav, footer, header, svg, noscript, iframe").remove();
  $(".ads, .advert, .promo, .cookie-banner, .subscribe").remove();

  // 2. Extract likely main content nodes
  const candidates = [
    "article",
    "main",
    "section",
    "#content",
    ".content",
    ".article",
    ".post",
  ];

  let text = "";

  for (const sel of candidates) {
    const block = $(sel);
    if (block.length > 0) {
      text = block.text();
      break;
    }
  }

  // 3. Fallback to body if no better candidates found
  if (!text.trim()) {
    text = $("body").text();
  }
	
  return cleanExtractedText(text);
}

/**
 * Clean extracted text (remove scripts, heavy markup and extra whitespace).
 *
 * @private
 */
export function cleanExtractedText(text) {
  return text
    .replace(/\s{2,}/g, " ")                 // collapse whitespace
    .replace(/[^\S\r\n]+/g, " ")             // collapse tabs
    .replace(/\n{2,}/g, "\n")                // collapse blank lines
    .replace(/\[\s*\]/g, "")                 // remove empty brackets
    .replace(/Show more/gi, "")              // common UI junk
    .replace(/© .*?$/gm, "")                 // copyright footers
    .replace(/^\s+|\s+$/g, "")               // trim edges
    .trim();
}

