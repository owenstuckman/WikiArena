import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Grokipedia Scraper Route (Selenium-first)
 *
 * Why:
 * - Grokipedia appears JS-heavy. Raw fetch often returns a thin shell.
 * - Selenium DOM extraction after hydration is more reliable than regex parsing.
 *
 * Requirements for Selenium path:
 *   npm i selenium-webdriver
 *   A runtime with Chrome/Chromium available (best with adapter-node/VPS/Docker)
 *
 * If Selenium/Chrome isn't available, this route will gracefully fall back to fetch scraping.
 */

const GROKIPEDIA_BASE_URL = 'https://grokipedia.com';

interface GrokipediaResult {
  title: string;
  content: string;
  url: string;
  isFallback: boolean;
  notFound?: boolean;
  source?: 'selenium' | 'scrape' | 'fallback';
  debug?: {
    triedUrls: string[];
    seleniumAvailable: boolean;
    notes: string[];
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const topic = url.searchParams.get('topic');
  const debugEnabled = url.searchParams.get('debug') === '1';

  if (!topic) {
    return json({ error: 'Missing topic parameter' }, { status: 400 });
  }

  const cleanedTopic = topic.trim();
  const urlPatterns = buildUrlPatterns(cleanedTopic);

  const debugNotes: string[] = [];
  const debugPayloadBase = {
    triedUrls: urlPatterns,
    seleniumAvailable: true,
    notes: debugNotes
  };

  // 1) Selenium first
  const seleniumResult = await trySelenium(cleanedTopic, urlPatterns, debugNotes);
  if (seleniumResult) {
    if (debugEnabled) {
      seleniumResult.debug = debugPayloadBase;
    }
    return json(seleniumResult);
  }

  // If Selenium failed due to environment, mark it
  if (debugNotes.some(n => n.toLowerCase().includes('selenium unavailable'))) {
    debugPayloadBase.seleniumAvailable = false;
  }

  // 2) Raw fetch fallback
  const fetchResult = await tryFetch(cleanedTopic, urlPatterns, debugNotes);
  if (fetchResult) {
    if (debugEnabled) {
      fetchResult.debug = debugPayloadBase;
    }
    return json(fetchResult);
  }

  // 3) Not found fallback
  const formattedTopic = cleanedTopic.replace(/\s+/g, '_');
  const fallback: GrokipediaResult = {
    title: cleanedTopic,
    content: '',
    url: `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(formattedTopic)}`,
    isFallback: true,
    notFound: true,
    source: 'fallback'
  };

  if (debugEnabled) {
    fallback.debug = debugPayloadBase;
  }

  return json(fallback);
};

/**
 * Build URL patterns to maximize hit rate.
 * Your example: https://grokipedia.com/page/Chinese_language
 */
function buildUrlPatterns(topic: string): string[] {
  const baseSlug = topic.replace(/\s+/g, '_');

  const titleCaseSlug = topic
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_');

  const lowerSlug = topic.toLowerCase().replace(/\s+/g, '_');

  const slugs = Array.from(new Set([
    baseSlug,
    titleCaseSlug,
    lowerSlug,
    topic
  ]));

  return slugs.map(s => `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(s)}`);
}

/* ------------------------------ SELENIUM ------------------------------ */

async function trySelenium(
  topic: string,
  urlPatterns: string[],
  debugNotes: string[]
): Promise<GrokipediaResult | null> {
  try {
    const selenium = await import('selenium-webdriver');
    const chrome = await import('selenium-webdriver/chrome');

    const { Builder, By } = selenium;

    const options = new chrome.Options();
    options.addArguments(
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,720'
    );

    // If you ever need a custom Chrome path:
    // options.setChromeBinaryPath(process.env.CHROME_BIN);

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    try {
      for (const pageUrl of urlPatterns) {
        try {
          console.log(`Selenium trying: ${pageUrl}`);
          await driver.get(pageUrl);

          // Hydration buffers for SPA content
          await driver.sleep(1200);

          // Soft wait for meaningful body text
          try {
            await driver.wait(async () => {
              const body = await driver.findElement(By.css('body'));
              const txt = await body.getText();
              return (txt || '').trim().length > 200;
            }, 7000);
          } catch {
            // continue anyway
          }

          // DOM-based extraction after hydration
          const extracted = await driver.executeScript(
            function (topicName: string) {
              try {
                const killSelectors = [
                  'nav', 'footer', 'header', 'aside', 'script', 'style',
                  '[class*="sidebar"]', '[class*="menu"]', '[class*="nav"]',
                  '[class*="footer"]', '[class*="header"]', '[class*="ad"]',
                  '[class*="cookie"]', '[class*="popup"]', '[role="navigation"]'
                ];

                document.querySelectorAll(killSelectors.join(','))
                  .forEach(el => el.remove());

                const contentSelectors = [
                  'article',
                  'main',
                  '[role="main"]',
                  '#content',
                  '#main-content',
                  '.content',
                  '.prose',
                  '[class*="article"]',
                  '[class*="content"]',
                  '[class*="markdown"]',
                  '[class*="prose"]',
                  '[class*="page"]'
                ];

                const candidates: Element[] = [];

                for (const sel of contentSelectors) {
                  document.querySelectorAll(sel).forEach(el => candidates.push(el));
                }

                document.querySelectorAll('div, section')
                  .forEach(el => candidates.push(el));

                let best: Element | null = null;
                let bestLen = 0;

                for (const el of candidates) {
                  const text = (el.textContent || '').trim();
                  if (text.length > bestLen && text.length > 200) {
                    best = el;
                    bestLen = text.length;
                  }
                }

                if (!best) {
                  best = document.body;
                }

                const titleEl =
                  document.querySelector('h1') ||
                  document.querySelector('title');

                const title = (titleEl?.textContent || '').trim() || topicName;

                const elements = best.querySelectorAll(
                  'h1, h2, h3, h4, p, li, blockquote'
                );

                const out: string[] = [];

                elements.forEach(el => {
                  const t = (el.textContent || '').trim();
                  if (!t) return;
                  if (t.length < 12) return;

                  const lower = t.toLowerCase();
                  if (
                    lower.includes('sign in') ||
                    lower.includes('sign up') ||
                    lower.includes('privacy') ||
                    lower.includes('terms') ||
                    lower.includes('cookie')
                  ) {
                    return;
                  }

                  const tag = el.tagName.toLowerCase();
                  if (tag === 'h1') out.push(`# ${t}`);
                  else if (tag === 'h2') out.push(`## ${t}`);
                  else if (tag === 'h3') out.push(`### ${t}`);
                  else if (tag === 'h4') out.push(`#### ${t}`);
                  else if (tag === 'li') out.push(`- ${t}`);
                  else if (tag === 'blockquote') out.push(`> ${t}`);
                  else out.push(t);
                });

                let content = out.join('\n\n')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();

                // Structure too thin, fall back to raw text
                if (content.length < 200) {
                  const raw = (best.textContent || '').trim();
                  if (raw.length > 200) {
                    content = `# ${title}\n\n${raw}`;
                  }
                }

                if (!content || content.length < 120) {
                  return null;
                }

                if (!content.startsWith('#')) {
                  content = `# ${title}\n\n${content}`;
                }

                return { title, content };
              } catch {
                return null;
              }
            },
            topic
          ) as { title: string; content: string } | null;

          if (extracted?.content) {
            const cleaned = extracted.content
              .replace(/\n{3,}/g, '\n\n')
              .trim();

            // Sometimes real pages are shorter than you'd think
            if (cleaned.length > 150) {
              return {
                title: extracted.title,
                content: cleaned,
                url: pageUrl,
                isFallback: false,
                source: 'selenium'
              };
            }
          }

          // As a secondary fallback within Selenium, parse the hydrated HTML
          // This helps if the DOM selection missed but the HTML is now rich.
          try {
            const html = await driver.getPageSource();
            if (html) {
              const lower = html.toLowerCase();
              if (
                !lower.includes('page not found') &&
                !lower.includes('does not exist') &&
                !lower.includes('no article found') &&
                !lower.includes('404')
              ) {
                const content = parseHtmlToMarkdown(html, topic);
                if (content && content.length > 150) {
                  const titleFromContent =
                    content.match(/^#\s+(.+)$/m)?.[1]?.trim() || topic;

                  return {
                    title: titleFromContent,
                    content,
                    url: pageUrl,
                    isFallback: false,
                    source: 'selenium'
                  };
                }
              }
            }
          } catch {
            // ignore
          }

        } catch (e) {
          console.log(
            `Selenium failed for ${pageUrl}:`,
            e instanceof Error ? e.message : e
          );
          continue;
        }
      }

      return null;
    } finally {
      await driver.quit();
    }
  } catch (e) {
    const msg = `Selenium unavailable (not installed or no Chrome in runtime): ${
      e instanceof Error ? e.message : String(e)
    }`;
    console.log(msg);
    debugNotes.push(msg);
    return null;
  }
}

/* ------------------------------- FETCH -------------------------------- */

async function tryFetch(
  topic: string,
  urlPatterns: string[],
  debugNotes: string[]
): Promise<GrokipediaResult | null> {
  for (const pageUrl of urlPatterns) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const html = await response.text();
      const lower = html.toLowerCase();

      if (
        lower.includes('page not found') ||
        lower.includes('does not exist') ||
        lower.includes('no article found') ||
        lower.includes('404')
      ) {
        continue;
      }

      const content = parseHtmlToMarkdown(html, topic);

      if (content && content.length > 150) {
        const titleFromContent =
          content.match(/^#\s+(.+)$/m)?.[1]?.trim() || topic;

        return {
          title: titleFromContent,
          content,
          url: pageUrl,
          isFallback: false,
          source: 'scrape'
        };
      }
    } catch (e) {
      const msg = `Fetch failed for ${pageUrl}: ${e instanceof Error ? e.message : String(e)}`;
      console.log(msg);
      debugNotes.push(msg);
      continue;
    }
  }

  return null;
}

/* --------------------------- HTML → MARKDOWN -------------------------- */

function parseHtmlToMarkdown(html: string, topic: string): string {
  let content = html;

  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 150) {
      content = match[1];
      break;
    }
  }

  // Remove unwanted elements
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  content = content.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<header[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<aside[\s\S]*?<\/aside>/gi, '');
  content = content.replace(/<form[\s\S]*?<\/form>/gi, '');
  content = content.replace(/<button[\s\S]*?<\/button>/gi, '');

  // Convert headers
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  content = content.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

  // Convert paragraphs
  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // Convert lists
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  content = content.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Convert formatting
  content = content.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  content = content.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');
  content = content.replace(/<br\s*\/?>/gi, '\n');

  // Remove remaining tags
  content = content.replace(/<[^>]+>/g, '');

  // Decode entities
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/&mdash;/g, '—');
  content = content.replace(/&ndash;/g, '–');

  // Clean up whitespace
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  if (!content.startsWith('#')) {
    content = `# ${topic}\n\n${content}`;
  }

  return content;
}
