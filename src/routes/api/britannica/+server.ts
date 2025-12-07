import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { XAI_API_KEY } from '$env/static/private';

const BRITANNICA_BASE_URL = 'https://www.britannica.com';

// Phrase to remove if it appears anywhere in extracted/generated content
const EDITOR_REVIEW_PHRASE =
  "Our editors will review what you’ve submitted and determine whether to revise the article.";

interface BritannicaResult {
  title: string;
  content: string;
  url: string;
  isFallback: boolean;
  notFound?: boolean;
  source?: 'scrape' | 'playwright' | 'grok' | 'fallback';
}

export const GET: RequestHandler = async ({ url }) => {
  const topic = url.searchParams.get('topic');

  console.log(`\n=== Britannica Lookup Request ===`);
  console.log(`Topic: "${topic}"`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (!topic) {
    return json({ error: 'Missing topic parameter' }, { status: 400 });
  }

  // Strategy 1 — Fetch scraping
  console.log("\n[1] Trying direct fetch scraping…");
  const fetchResult = await tryFetch(topic);
  if (fetchResult) {
    console.log("[1] SUCCESS via fetch:", fetchResult.url);
    return json(fetchResult);
  }
  console.log("[1] Fetch scraping FAILED");

  // Strategy 2 — Playwright
  console.log("\n[2] Trying Playwright scraping…");
  const playwrightResult = await tryPlaywright(topic);
  if (playwrightResult) {
    console.log("[2] SUCCESS via Playwright:", playwrightResult.url);
    return json(playwrightResult);
  }
  console.log("[2] Playwright scraping FAILED");

  // Strategy 3 — Grok Fallback
  console.log("\n[3] Using Grok fallback…");
  const grokResult = await tryGrokApi(topic);
  if (grokResult) {
    console.log("[3] Grok generated fallback content.");
    return json(grokResult);
  }

  console.log("[3] Grok fallback FAILED (no API key?).");

  // Final fail
  console.log("\n❌ ALL METHODS FAILED — returning fallback empty result.");

  return json({
    title: topic,
    content: '',
    url: `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`,
    isFallback: true,
    notFound: true,
    source: 'fallback'
  });
};



/* -------------------------------------------------------------------------- */
/*                              DIRECT FETCH LOGIC                             */
/* -------------------------------------------------------------------------- */

async function tryFetch(topic: string): Promise<BritannicaResult | null> {
  try {
    console.log("[Fetch] Trying direct URL patterns…");

    const articleUrl = await tryDirectUrls(topic);

    if (articleUrl) {
      console.log(`[Fetch] Direct article URL discovered: ${articleUrl}`);
      const content = await fetchAndParse(articleUrl, topic);
      if (content && content.length > 500) {
        console.log("[Fetch] Direct content extraction SUCCESS");
        return {
          title: topic,
          content: sanitizeContent(content),
          url: articleUrl,
          isFallback: false,
          source: 'scrape'
        };
      }
      console.log("[Fetch] Direct article parse SHORT or EMPTY");
    } else {
      console.log("[Fetch] No direct URL match found.");
    }

    console.log("[Fetch] Trying search scraping…");
    const searchUrl = `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`;
    console.log("[Fetch] Search URL:", searchUrl);

    const searchHtml = await timedFetchText(searchUrl);

    if (!searchHtml) {
      console.log("[Fetch] FAILED to fetch search results.");
      return null;
    }

    if (searchHtml.includes("No results found")) {
      console.log("[Fetch] Britannica search says: NO RESULTS");
      return null;
    }

    // FIXED REGEX: Only match article URLs
    const articleUrlMatch = searchHtml.match(/href="(\/(?:topic|biography|place|science)\/[^"]+)"/i);

    console.log("[Fetch] Search regex match:", articleUrlMatch?.[1]);

    if (!articleUrlMatch) {
      console.log("[Fetch] No article URL found in search results.");
      return null;
    }

    const foundUrl = `${BRITANNICA_BASE_URL}${articleUrlMatch[1]}`;
    console.log("[Fetch] Resolved article URL:", foundUrl);

    const content = await fetchAndParse(foundUrl, topic);

    console.log("[Fetch] Parsed content length:", content?.length);

    if (content && content.length > 500) {
      console.log("[Fetch] Search-based content extraction SUCCESS");
      return {
        title: topic,
        content: sanitizeContent(content),
        url: foundUrl,
        isFallback: false,
        source: 'scrape'
      };
    }

  } catch (e) {
    console.log("❌ Fetch scraping error:", e);
  }

  return null;
}



async function tryDirectUrls(topic: string): Promise<string | null> {
  const formattedTopic = topic.toLowerCase().replace(/\s+/g, '-');
  const categories = ['topic', 'biography', 'place', 'science'];

  for (const category of categories) {
    const url = `${BRITANNICA_BASE_URL}/${category}/${formattedTopic}`;
    console.log(`[DirectURL] Checking: ${url}`);

    try {
      const resp = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      console.log(`[DirectURL] Status for ${url}:`, resp.status);

      if (resp.status === 200) {
        return url;
      }
    } catch (err) {
      console.log(`[DirectURL] FAILED for ${url}`, err);
    }
  }

  return null;
}



async function fetchAndParse(url: string, topic: string): Promise<string | null> {
  try {
    const html = await timedFetchText(url);
    if (!html) {
      console.log("[Parse] FAILED to fetch HTML for:", url);
      return null;
    }

    const content = parseBritannicaHtml(html, topic);

    return content;
  } catch (e) {
    console.log("❌ fetchAndParse ERROR:", e);
    return null;
  }
}



async function timedFetchText(url: string, timeoutMs = 9000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log(`[FetchText] GET ${url} → Status ${resp.status}`);

    if (!resp.ok) return null;

    return await resp.text();
  } catch (err) {
    console.log(`[FetchText] ERROR for ${url}:`, err);
    return null;
  }
}



/* -------------------------------------------------------------------------- */
/*                               PLAYWRIGHT LOGIC                              */
/* -------------------------------------------------------------------------- */

async function tryPlaywright(topic: string): Promise<BritannicaResult | null> {
  let browser: any = null;

  try {
    console.log("[Playwright] Starting Chromium…");
    const { chromium } = await import('playwright');

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0"
    });

    const page = await context.newPage();

    const formattedTopic = topic.toLowerCase().replace(/\s+/g, '-');
    let articleUrl = `${BRITANNICA_BASE_URL}/topic/${formattedTopic}`;

    console.log("[Playwright] Visiting:", articleUrl);
    await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });

    await page.waitForTimeout(800);

    let isArticle = await page.evaluate(() => {
      return (
        !!document.querySelector("article") ||
        !!document.querySelector("#article-content")
      );
    });

    if (!isArticle) {
      console.log("[Playwright] Direct URL not article. Trying SEARCH…");

      const searchUrl = `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });

      await page.waitForTimeout(800);

      const link = await page.$('a[href*="/topic/"], a[href*="/biography/"], a[href*="/place/"]');
      if (link) {
        const href = await link.getAttribute('href');
        if (href) {
          articleUrl = href.startsWith('/') ? BRITANNICA_BASE_URL + href : href;
          console.log("[Playwright] Search resolved →", articleUrl);
          await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
          await page.waitForTimeout(800);
        }
      }
    }

    const content = await page.evaluate(() => {
      const paragraphs: string[] = [];

      const title = document.querySelector("h1")?.textContent?.trim();
      if (title) paragraphs.push(`# ${title}`);

      const candidates = [
        "article p",
        "#article-content p",
        ".topic-content p"
      ];

      for (const sel of candidates) {
        const nodes = [...document.querySelectorAll(sel)];
        if (nodes.length) {
          nodes.forEach(n => {
            const text = n.textContent?.trim();
            if (text && text.length > 50) paragraphs.push(text);
          });
          break;
        }
      }

      return paragraphs.join("\n\n");
    });

    if (content && content.length > 500) {
      console.log("[Playwright] Extracted content length:", content.length);
      return {
        title: topic,
        content: sanitizeContent(content),
        url: articleUrl,
        isFallback: false,
        source: "playwright"
      };
    }

    console.log("[Playwright] Content too short.");
    return null;

  } catch (err) {
    console.log("❌ Playwright error:", err);
    return null;
  } finally {
    if (browser && browser.isConnected()) {
      console.log("[Playwright] Closing browser.");
      await browser.close();
    }
  }
}



/* -------------------------------------------------------------------------- */
/*                                 GROK FALLBACK                               */
/* -------------------------------------------------------------------------- */

async function tryGrokApi(topic: string): Promise<BritannicaResult | null> {
  if (!XAI_API_KEY) {
    console.log("[Grok] No API key.");
    return null;
  }

  try {
    console.log("[Grok] Sending request…");

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content:
              "You write encyclopedia articles in Britannica style. Formal, neutral, structured, no self-reference."
          },
          {
            role: "user",
            content: `Write a comprehensive encyclopedia entry about: ${topic}`
          }
        ],
        max_tokens: 2500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.log("[Grok] API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.log("[Grok] Empty content received.");
      return null;
    }

    console.log("[Grok] Response length:", content.length);

    return {
      title: topic,
      content: sanitizeContent(content),
      url: `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`,
      isFallback: false,
      source: "grok"
    };
  } catch (err) {
    console.log("❌ Grok error:", err);
    return null;
  }
}



/* -------------------------------------------------------------------------- */
/*                             HTML PARSING (IMPROVED)                         */
/* -------------------------------------------------------------------------- */

function parseBritannicaHtml(html: string, topic: string): string {
  console.log("[Parse] Extracting article content…");

  let articleContent = "";

  // Primary <article>
  let match = html.match(/<article[\s\S]*?<\/article>/i);
  if (match) {
    console.log("[Parse] Found <article> block");
    articleContent = match[0];
  }

  // Alternate container
  if (!articleContent) {
    match = html.match(/<div[^>]*id="article-content"[^>]*>([\s\S]*?)<\/div>/i);
    if (match) {
      console.log("[Parse] Found #article-content block");
      articleContent = match[1];
    }
  }

  // Full fallback
  if (!articleContent) {
    console.log("[Parse] No article structure found — using <body>");
    match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    articleContent = match ? match[1] : html;
  }

  // Strip unwanted UI noise
  const removePatterns = [
    /<nav[\s\S]*?<\/nav>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<script[\s\S]*?<\/script>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<div[^>]*class="[^"]*(related|ad|chatbot|share|feedback)[^"]*"[^>]*>[\s\S]*?<\/div>/gi
  ];

  removePatterns.forEach(pattern => {
    articleContent = articleContent.replace(pattern, "");
  });

  // Extract <p> text
  const paragraphs: string[] = [];

  for (const match of articleContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    let text = match[1]
      .replace(/<a[^>]*>(.*?)<\/a>/gi, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (text.length > 50) paragraphs.push(text);
  }

  console.log("[Parse] Final paragraph count:", paragraphs.length);

  let content = `# ${topic}\n\n${paragraphs.join("\n\n")}`;
  content = sanitizeContent(content);

  return content.trim();
}



/* -------------------------------------------------------------------------- */
/*                                 SANITIZATION                                */
/* -------------------------------------------------------------------------- */

function sanitizeContent(input: string): string {
  if (!input) return input;

  // Remove the exact phrase (smart apostrophe)
  let out = input.replaceAll(EDITOR_REVIEW_PHRASE, '');

  // Also remove a straight-apostrophe variant just in case
  out = out.replaceAll(
    "Our editors will review what you've submitted and determine whether to revise the article.",
    ''
  );

  // Clean up any leftover double blank lines caused by removal
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  return out;
}
