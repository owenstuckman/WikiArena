import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { XAI_API_KEY } from '$env/static/private';

const BRITANNICA_BASE_URL = 'https://www.britannica.com';

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
  
  if (!topic) {
    return json({ error: 'Missing topic parameter' }, { status: 400 });
  }

  // Strategy 1: Try regular fetch scraping
  const fetchResult = await tryFetch(topic);
  if (fetchResult) {
    return json(fetchResult);
  }

  // Strategy 2: Try Playwright (if available)
  const playwrightResult = await tryPlaywright(topic);
  if (playwrightResult) {
    return json(playwrightResult);
  }

  // Strategy 3: Use Grok API to generate Britannica-style content
  const grokResult = await tryGrokApi(topic);
  if (grokResult) {
    return json(grokResult);
  }

  // No content found
  return json({
    title: topic,
    content: '',
    url: `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`,
    isFallback: true,
    notFound: true,
    source: 'fallback'
  });
};

async function tryFetch(topic: string): Promise<BritannicaResult | null> {
  try {
    // First, try direct URL patterns
    const articleUrl = await tryDirectUrls(topic);
    
    if (articleUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const articleResponse = await fetch(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (articleResponse.ok) {
        const articleHtml = await articleResponse.text();
        const content = parseBritannicaHtml(articleHtml, topic);

        if (content && content.length > 500) {
          return {
            title: topic,
            content,
            url: articleUrl,
            isFallback: false,
            source: 'scrape'
          };
        }
      }
    }
    
    // If direct URL didn't work, try search
    const searchUrl = `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!searchResponse.ok) {
      return null;
    }

    const searchHtml = await searchResponse.text();
    
    // Check if no results
    if (searchHtml.includes('No results found') || 
        searchHtml.includes('did not match any') ||
        searchHtml.includes('0 results')) {
      return null;
    }
    
    // Find article URL from search results
    const articleUrlMatch = searchHtml.match(/href="(\/[a-z]+\/[^"]+)"/i);
    
    if (articleUrlMatch) {
      const foundUrl = `${BRITANNICA_BASE_URL}${articleUrlMatch[1]}`;
      
      const articleController = new AbortController();
      const articleTimeoutId = setTimeout(() => articleController.abort(), 8000);
      
      const articleResponse = await fetch(foundUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: articleController.signal,
      });
      
      clearTimeout(articleTimeoutId);

      if (articleResponse.ok) {
        const articleHtml = await articleResponse.text();
        const content = parseBritannicaHtml(articleHtml, topic);

        if (content && content.length > 500) {
          return {
            title: topic,
            content,
            url: foundUrl,
            isFallback: false,
            source: 'scrape'
          };
        }
      }
    }
  } catch (e) {
    console.log('Britannica fetch failed:', e instanceof Error ? e.message : e);
  }

  return null;
}

async function tryDirectUrls(topic: string): Promise<string | null> {
  const formattedTopic = topic.toLowerCase().replace(/\s+/g, '-');
  const categories = ['topic', 'biography', 'place', 'science', 'technology', 'animal', 'plant', 'event', 'art', 'sports'];
  
  for (const category of categories) {
    try {
      const url = `${BRITANNICA_BASE_URL}/${category}/${formattedTopic}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return url;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

async function tryPlaywright(topic: string): Promise<BritannicaResult | null> {
  try {
    const { chromium } = await import('playwright');
    
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      
      // Try direct topic URL first
      const formattedTopic = topic.toLowerCase().replace(/\s+/g, '-');
      let articleUrl = `${BRITANNICA_BASE_URL}/topic/${formattedTopic}`;
      
      await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(1000);
      
      // Check if we landed on an article
      let isArticle = await page.evaluate(() => {
        return document.querySelector('article') !== null || 
               document.querySelector('.topic-content') !== null ||
               document.querySelector('[class*="article"]') !== null;
      });
      
      if (!isArticle) {
        // Try search instead
        const searchUrl = `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(1000);
        
        // Click first result
        const firstLink = await page.$('a[href*="/topic/"], a[href*="/biography/"], a[href*="/place/"], a[href*="/science/"]');
        if (firstLink) {
          const href = await firstLink.getAttribute('href');
          if (href) {
            articleUrl = href.startsWith('/') ? `${BRITANNICA_BASE_URL}${href}` : href;
            await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
            await page.waitForTimeout(1000);
          }
        }
      }
      
      // Extract only article paragraphs
      const content = await page.evaluate(() => {
        const paragraphs: string[] = [];
        
        // Get article title
        const titleEl = document.querySelector('h1');
        if (titleEl) {
          paragraphs.push(`# ${titleEl.textContent?.trim()}`);
        }
        
        // Get main article paragraphs only
        const articleSelectors = [
          'article p',
          '.topic-content p',
          '[class*="article"] p',
          '.md-article p',
          'section p'
        ];
        
        for (const selector of articleSelectors) {
          const ps = document.querySelectorAll(selector);
          if (ps.length > 0) {
            ps.forEach(p => {
              const text = p.textContent?.trim();
              if (text && text.length > 50 && 
                  !text.includes('Ask the Chatbot') &&
                  !text.includes('Learn about this topic') &&
                  !text.includes('Read More') &&
                  !text.includes('Cite this article') &&
                  !text.includes('Written by') &&
                  !text.includes('Fact-checked by')) {
                paragraphs.push(text);
              }
            });
            break;
          }
        }
        
        // Get section headers
        const headers = document.querySelectorAll('article h2, article h3, .topic-content h2, .topic-content h3');
        headers.forEach(h => {
          const text = h.textContent?.trim();
          if (text && text.length > 2 && text.length < 100) {
            // Will be added in order
          }
        });
        
        return paragraphs.join('\n\n');
      });
      
      await browser.close();
      
      if (content && content.length > 500) {
        // Clean up the content
        let cleaned = content
          .replace(/britannica/gi, 'this encyclopedia')
          .replace(/\*\s*\*/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        return {
          title: topic,
          content: cleaned,
          url: articleUrl,
          isFallback: false,
          source: 'playwright'
        };
      }
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.log('Playwright scraping failed:', e instanceof Error ? e.message : e);
  }
  
  return null;
}

async function tryGrokApi(topic: string): Promise<BritannicaResult | null> {
  if (!XAI_API_KEY) {
    console.log('No XAI_API_KEY configured');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: `You are writing encyclopedia articles. Write comprehensive, scholarly, and authoritative content.

Format your response in Markdown with:
- A clear introduction establishing the subject
- Multiple sections with ## headers
- Scholarly, formal, and neutral tone
- Historical context and key facts
- No self-references to being an AI or encyclopedia`
          },
          {
            role: 'user',
            content: `Write a comprehensive encyclopedia article about: ${topic}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2500,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('Grok API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content && content.length > 300) {
      return {
        title: topic,
        content: `# ${topic}\n\n${content}`,
        url: `${BRITANNICA_BASE_URL}/search?query=${encodeURIComponent(topic)}`,
        isFallback: false,
        source: 'grok'
      };
    }
  } catch (e) {
    console.log('Grok API failed:', e instanceof Error ? e.message : e);
  }

  return null;
}

function parseBritannicaHtml(html: string, topic: string): string {
  // Extract only the main article content
  let articleContent = '';
  
  // Try to find the main article section
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    articleContent = articleMatch[1];
  } else {
    // Try other selectors
    const contentMatch = html.match(/<section[^>]*class="[^"]*topic-paragraph[^"]*"[^>]*>([\s\S]*?)<\/section>/gi);
    if (contentMatch) {
      articleContent = contentMatch.join('\n');
    } else {
      // Last resort - get body
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      articleContent = bodyMatch ? bodyMatch[1] : html;
    }
  }
  
  // Remove unwanted sections FIRST
  articleContent = articleContent.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  articleContent = articleContent.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  articleContent = articleContent.replace(/<header[\s\S]*?<\/header>/gi, '');
  articleContent = articleContent.replace(/<aside[\s\S]*?<\/aside>/gi, '');
  articleContent = articleContent.replace(/<script[\s\S]*?<\/script>/gi, '');
  articleContent = articleContent.replace(/<style[\s\S]*?<\/style>/gi, '');
  articleContent = articleContent.replace(/<form[\s\S]*?<\/form>/gi, '');
  articleContent = articleContent.replace(/<button[\s\S]*?<\/button>/gi, '');
  articleContent = articleContent.replace(/<input[^>]*>/gi, '');
  
  // Remove chatbot, related articles, and UI elements
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*chatbot[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*related[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*share[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*cite[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  articleContent = articleContent.replace(/<div[^>]*class="[^"]*feedback[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Extract title
  let title = topic;
  const titleMatch = articleContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
  }
  
  // Extract paragraphs - only keep substantial ones
  const paragraphs: string[] = [];
  const pMatches = articleContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  
  for (const match of pMatches) {
    let text = match[1];
    
    // Remove inline tags but keep text
    text = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1');
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&mdash;/g, '—');
    text = text.replace(/&ndash;/g, '–');
    
    text = text.trim();
    
    // Skip junk lines
    if (text.length < 50) continue;
    if (text.includes('Ask the Chatbot')) continue;
    if (text.includes('Learn about this topic')) continue;
    if (text.includes('Read More')) continue;
    if (text.includes('Cite this article')) continue;
    if (text.includes('Written by')) continue;
    if (text.includes('Fact-checked by')) continue;
    if (text.includes('Last Updated')) continue;
    if (text.match(/^\*+$/)) continue;
    if (text.match(/^[\s\*]+$/)) continue;
    
    paragraphs.push(text);
  }
  
  // Extract headers
  const headers: { level: number; text: string; index: number }[] = [];
  let hIndex = 0;
  
  for (const level of [2, 3]) {
    const hMatches = articleContent.matchAll(new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'));
    for (const match of hMatches) {
      let text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 2 && text.length < 100 && !text.includes('Related')) {
        headers.push({ level, text, index: hIndex++ });
      }
    }
  }
  
  // Build final content
  let content = `# ${title}\n\n`;
  content += paragraphs.join('\n\n');
  
  // Clean up
  content = content.replace(/britannica/gi, 'this encyclopedia');
  content = content.replace(/\*\s*\*/g, '');
  content = content.replace(/\*\*\s*\*\*/g, '');
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trim();
  
  return content;
}
