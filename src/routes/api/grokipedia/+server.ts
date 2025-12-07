import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Grokipedia Scraper Route (Selenium-first, preserve formatting + links)
 *
 * Goals:
 * - Capture real JS-rendered page content.
 * - Preserve links + basic formatting in Markdown.
 * - Skip "page does not exist" renders even if the route loads.
 *
 * Strategy:
 * 1) Selenium:
 *    - Load page
 *    - Conservative cleanup (do NOT remove headers generically)
 *    - Choose best root (article/main/content)
 *    - Return hydrated HTML for that root
 *    - Convert HTML -> Markdown preserving links/formatting
 * 2) Raw fetch fallback with the same HTML -> Markdown conversion
 * 3) Fallback object if not found
 *
 * Requirements for Selenium:
 *   npm i selenium-webdriver
 *   Chrome/Chromium available in runtime
 *
 * Best environments:
 * - adapter-node
 * - VPS/Docker
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
    if (debugEnabled) seleniumResult.debug = debugPayloadBase;
    return json(seleniumResult);
  }

  if (debugNotes.some(n => n.toLowerCase().includes('selenium unavailable'))) {
    debugPayloadBase.seleniumAvailable = false;
  }

  // 2) Raw fetch fallback
  const fetchResult = await tryFetch(cleanedTopic, urlPatterns, debugNotes);
  if (fetchResult) {
    if (debugEnabled) fetchResult.debug = debugPayloadBase;
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

  if (debugEnabled) fallback.debug = debugPayloadBase;

  return json(fallback);
};

/**
 * Build URL patterns to maximize hit rate.
 * Example: https://grokipedia.com/page/Chinese_language
 */
function buildUrlPatterns(topic: string): string[] {
  const baseSlug = topic.replace(/\s+/g, '_');

  const titleCaseSlug = topic
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_');

  const lowerSlug = topic.toLowerCase().replace(/\s+/g, '_');

  const slugs = Array.from(new Set([baseSlug, titleCaseSlug, lowerSlug, topic]));

  return slugs.map(s => `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(s)}`);
}

function looksLikeNotFoundText(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('page not found') ||
    lower.includes('does not exist') ||
    lower.includes('no article found') ||
    /\b404\b/.test(lower)
  );
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

    // If you need a custom Chrome binary:
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

          // Hydration buffers
          await driver.sleep(1800);

          // Soft wait for meaningful body text
          try {
            await driver.wait(async () => {
              const body = await driver.findElement(By.css('body'));
              const txt = await body.getText();
              return (txt || '').trim().length > 200;
            }, 9000);
          } catch {
            // continue anyway
          }

          // DOM-based HTML extraction to preserve formatting + links
          const extracted = await driver.executeScript(
            function (topicName: string) {
              try {
                // Conservative cleanup:
                // avoid removing header tags/classes to prevent losing title/lead.
                const killSelectors = [
                  'script',
                  'style',
                  'nav',
                  'footer',
                  'aside',
                  '[role="navigation"]',
                  '[aria-label="navigation"]',
                  '[class*="cookie"]',
                  '[class*="consent"]',
                  '[class*="banner"]',
                  '[class*="popup"]',
                  '[class*="modal"]',
                  '[class*="advert"]',
                  '[class*="ads"]'
                ];

                document.querySelectorAll(killSelectors.join(','))
                  .forEach(el => el.remove());

                const preferred =
                  document.querySelector('article') ||
                  document.querySelector('main') ||
                  document.querySelector('#content') ||
                  document.querySelector('#main-content') ||
                  document.querySelector('.content') ||
                  document.querySelector('[class*="article"]') ||
                  document.querySelector('[class*="content"]');

                const root = preferred || document.body;

                const titleEl =
                  root.querySelector('h1') ||
                  document.querySelector('h1') ||
                  document.querySelector('title');

                const title = (titleEl?.textContent || '').trim() || topicName;

                const html = (root as HTMLElement).innerHTML || '';
                const textCheck = (root as HTMLElement).innerText?.trim() || '';

                if (!html || textCheck.length < 120) return null;

                const lower = textCheck.toLowerCase();
                if (
                  lower.includes('page not found') ||
                  lower.includes('does not exist') ||
                  lower.includes('no article found') ||
                  /\b404\b/.test(lower)
                ) {
                  return null;
                }

                return { title, html, textCheck };
              } catch {
                return null;
              }
            },
            topic
          ) as { title: string; html: string; textCheck: string } | null;

          if (extracted?.html) {
            if (looksLikeNotFoundText(extracted.textCheck || '')) {
              continue;
            }

            const content = parseHtmlToMarkdown(extracted.html, extracted.title);
            if (content && content.length > 150 && !looksLikeNotFoundText(content)) {
              return {
                title: extracted.title,
                content,
                url: pageUrl,
                isFallback: false,
                source: 'selenium'
              };
            }
          }

          // Secondary fallback: use hydrated full body HTML if root selection was odd
          const bodyExtract = await driver.executeScript(function () {
            try {
              const html = document.body?.innerHTML || '';
              const textCheck = document.body?.innerText?.trim() || '';
              const titleEl =
                document.querySelector('h1') ||
                document.querySelector('title');

              const title = (titleEl?.textContent || '').trim() || 'Untitled';

              if (!html || textCheck.length < 120) return null;

              const lower = textCheck.toLowerCase();
              if (
                lower.includes('page not found') ||
                lower.includes('does not exist') ||
                lower.includes('no article found') ||
                /\b404\b/.test(lower)
              ) {
                return null;
              }

              return { title, html, textCheck };
            } catch {
              return null;
            }
          }) as { title: string; html: string; textCheck: string } | null;

          if (bodyExtract?.html) {
            if (looksLikeNotFoundText(bodyExtract.textCheck || '')) {
              continue;
            }

            const content = parseHtmlToMarkdown(bodyExtract.html, bodyExtract.title);
            if (content && content.length > 150 && !looksLikeNotFoundText(content)) {
              return {
                title: bodyExtract.title || topic,
                content,
                url: pageUrl,
                isFallback: false,
                source: 'selenium'
              };
            }
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

      if (content && content.length > 150 && !looksLikeNotFoundText(content)) {
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
      const msg = `Fetch failed for ${pageUrl}: ${
        e instanceof Error ? e.message : String(e)
      }`;
      console.log(msg);
      debugNotes.push(msg);
      continue;
    }
  }

  return null;
}

/* --------------------------- HTML → MARKDOWN -------------------------- */
/**
 * Converts HTML into Markdown while preserving:
 * - headings
 * - bold/italic
 * - lists
 * - blockquotes
 * - code/pre
 * - links
 *
 * This is intentionally conservative and general.
 * It aims to keep "everything" readable rather than perfectly match a specific site schema.
 */
function parseHtmlToMarkdown(html: string, titleFallback: string): string {
  let content = html;

  // Remove scripts/styles early
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Preserve line breaks
  content = content.replace(/<br\s*\/?>/gi, '\n');

  // Preserve preformatted code blocks
  content = content.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner) => {
    const cleaned = stripTags(inner);
    return `\n\`\`\`\n${decodeEntities(cleaned).trim()}\n\`\`\`\n`;
  });

  // Preserve inline code
  content = content.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner) => {
    const cleaned = decodeEntities(stripTags(inner)).replace(/\s+/g, ' ').trim();
    return cleaned ? `\`${cleaned}\`` : '';
  });

  // Convert links BEFORE stripping tags
  content = content.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href, inner) => {
      const text = decodeEntities(stripTags(inner)).replace(/\s+/g, ' ').trim();
      if (!text) return href;
      return `[${text}](${href})`;
    }
  );

  // Images -> keep alt text if present
  content = content.replace(
    /<img\s+[^>]*alt=["']([^"']*)["'][^>]*>/gi,
    (_m, alt) => (alt ? `\n\n![${decodeEntities(alt)}]\n\n` : '')
  );
  content = content.replace(/<img\s+[^>]*>/gi, '');

  // Headings
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  content = content.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  content = content.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  content = content.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Blockquotes
  content = content.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');

  // Paragraphs
  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // Lists
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  content = content.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Bold/italic
  content = content.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  content = content.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');

  // Remove remaining tags
  content = stripTags(content);

  // Decode entities
  content = decodeEntities(content);

  // Clean whitespace
  content = content.replace(/[ \t]+\n/g, '\n');
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  // Ensure top-level title
  if (!content.startsWith('#')) {
    const safeTitle = titleFallback?.trim() || 'Untitled';
    content = `# ${safeTitle}\n\n${content}`;
  }

  return content;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}
