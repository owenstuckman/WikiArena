import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { XAI_API_KEY } from '$env/static/private';

const GROKIPEDIA_BASE_URL = 'https://grokipedia.com';

interface GrokipediaResult {
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

  // Strategy 1: Try Playwright first (Grokipedia is a JS-heavy site)
  const playwrightResult = await tryPlaywright(topic);
  if (playwrightResult) {
    return json(playwrightResult);
  }

  // Strategy 2: Try regular fetch as backup
  const fetchResult = await tryFetch(topic);
  if (fetchResult) {
    return json(fetchResult);
  }

  // Strategy 3: Use Grok API to generate content
  const grokResult = await tryGrokApi(topic);
  if (grokResult) {
    return json(grokResult);
  }

  // No content found
  const formattedTopic = topic.trim().replace(/\s+/g, '_');
  return json({
    title: topic,
    content: '',
    url: `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(formattedTopic)}`,
    isFallback: true,
    notFound: true,
    source: 'fallback'
  });
};

async function tryPlaywright(topic: string): Promise<GrokipediaResult | null> {
  try {
    const { chromium } = await import('playwright');
    
    const browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    let result: GrokipediaResult | null = null;
    
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        javaScriptEnabled: true,
      });
      
      const page = await context.newPage();
      
      // Try multiple URL patterns
      const urlPatterns = [
        `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
        `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_'))}`,
        `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, '_'))}`,
        `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic)}`,
      ];
      
      for (const url of urlPatterns) {
        try {
          console.log(`Trying Grokipedia URL: ${url}`);
          
          // Navigate with longer timeout for JS-heavy sites
          await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 12000 
          });
          
          // Wait for content to load - try multiple strategies
          try {
            await page.waitForSelector('article, .article, .content, main, [class*="article"], [class*="content"]', { 
              timeout: 5000 
            });
          } catch {
            // If no selector found, wait a bit for JS to render
            await page.waitForTimeout(2000);
          }
          
          // Additional wait for dynamic content
          await page.waitForTimeout(1500);
          
          // Check if we're on an error page
          const isError = await page.evaluate(() => {
            const body = document.body.textContent?.toLowerCase() || '';
            return body.includes('page not found') || 
                   body.includes('404') ||
                   body.includes('does not exist') ||
                   body.includes('no article found') ||
                   body.includes('error loading');
          });
          
          if (isError) {
            console.log(`Grokipedia: Page not found for ${url}`);
            continue;
          }
          
          // Extract content with multiple strategies
          const extracted = await page.evaluate((topicName) => {
            // Remove unwanted elements
            const unwanted = document.querySelectorAll('nav, footer, header, aside, script, style, [class*="sidebar"], [class*="menu"], [class*="nav"], [class*="footer"], [class*="header"], [class*="ad"], [class*="cookie"], [class*="popup"]');
            unwanted.forEach(el => el.remove());
            
            // Strategy 1: Look for main content containers
            const contentSelectors = [
              'article',
              '[class*="article-content"]',
              '[class*="wiki-content"]',
              '[class*="page-content"]',
              '[class*="entry-content"]',
              '.content',
              'main',
              '[role="main"]',
              '#content',
              '#main-content',
              '.prose',
              '[class*="markdown"]',
            ];
            
            let contentEl: Element | null = null;
            for (const selector of contentSelectors) {
              const el = document.querySelector(selector);
              if (el && el.textContent && el.textContent.trim().length > 300) {
                contentEl = el;
                break;
              }
            }
            
            if (!contentEl) {
              // Fallback: get the largest text container
              const allDivs = Array.from(document.querySelectorAll('div, section'));
              let maxLen = 0;
              for (const div of allDivs) {
                const text = div.textContent?.trim() || '';
                if (text.length > maxLen && text.length > 300) {
                  maxLen = text.length;
                  contentEl = div;
                }
              }
            }
            
            if (!contentEl) {
              return null;
            }
            
            // Get title
            const titleEl = document.querySelector('h1') || document.querySelector('title');
            const title = titleEl?.textContent?.trim() || topicName;
            
            // Build markdown content
            const paragraphs: string[] = [];
            
            // Get headers and paragraphs
            const elements = contentEl.querySelectorAll('h1, h2, h3, h4, p, li, blockquote');
            
            for (const el of elements) {
              const text = el.textContent?.trim();
              if (!text || text.length < 20) continue;
              
              // Skip navigation/UI text
              if (text.includes('Sign in') || text.includes('Sign up') || 
                  text.includes('Cookie') || text.includes('Privacy') ||
                  text.includes('Terms of') || text.includes('©')) {
                continue;
              }
              
              const tagName = el.tagName.toLowerCase();
              if (tagName === 'h1') {
                paragraphs.push(`# ${text}`);
              } else if (tagName === 'h2') {
                paragraphs.push(`## ${text}`);
              } else if (tagName === 'h3') {
                paragraphs.push(`### ${text}`);
              } else if (tagName === 'h4') {
                paragraphs.push(`#### ${text}`);
              } else if (tagName === 'li') {
                paragraphs.push(`- ${text}`);
              } else if (tagName === 'blockquote') {
                paragraphs.push(`> ${text}`);
              } else {
                paragraphs.push(text);
              }
            }
            
            // If no structured content, get raw text
            if (paragraphs.length < 3) {
              const rawText = contentEl.textContent?.trim() || '';
              if (rawText.length > 300) {
                return {
                  title,
                  content: `# ${title}\n\n${rawText}`,
                };
              }
              return null;
            }
            
            return {
              title,
              content: paragraphs.join('\n\n'),
            };
          }, topic);
          
          if (extracted && extracted.content && extracted.content.length > 300) {
            // Clean up the content
            let content = extracted.content
              .replace(/grokipedia/gi, 'this encyclopedia')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            
            // Ensure title is present
            if (!content.startsWith('#')) {
              content = `# ${extracted.title}\n\n${content}`;
            }
            
            result = {
              title: extracted.title,
              content,
              url,
              isFallback: false,
              source: 'playwright'
            };
            
            console.log(`Grokipedia: Successfully extracted ${content.length} chars from ${url}`);
            break;
          }
        } catch (e) {
          console.log(`Grokipedia: Failed to load ${url}:`, e instanceof Error ? e.message : e);
          continue;
        }
      }
      
      await context.close();
    } finally {
      await browser.close();
    }
    
    return result;
  } catch (e) {
    console.log('Grokipedia Playwright error:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function tryFetch(topic: string): Promise<GrokipediaResult | null> {
  const urlPatterns = [
    `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
    `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_'))}`,
    `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, '_'))}`,
  ];

  for (const url of urlPatterns) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const html = await response.text();
      
      // Check if page doesn't exist
      if (html.includes('Page not found') || 
          html.includes('does not exist') ||
          html.includes('404') ||
          html.includes('No article found')) {
        continue;
      }
      
      const content = parseHtmlToMarkdown(html, topic);

      if (content && content.length > 300) {
        return {
          title: topic,
          content,
          url,
          isFallback: false,
          source: 'scrape'
        };
      }
    } catch (e) {
      console.log(`Grokipedia fetch failed for ${url}:`, e instanceof Error ? e.message : e);
      continue;
    }
  }

  return null;
}

async function tryGrokApi(topic: string): Promise<GrokipediaResult | null> {
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
            content: `You are an expert encyclopedia writer. Write comprehensive, factual, and well-structured encyclopedia-style articles.

Format in Markdown with:
- A clear introduction
- Multiple sections with ## headers
- Factual, neutral tone
- Key facts, dates, and details

Do NOT mention AI or that content is generated.`
          },
          {
            role: 'user',
            content: `Write a comprehensive encyclopedia article about: ${topic}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
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
        url: `${GROKIPEDIA_BASE_URL}/page/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
        isFallback: false,
        source: 'grok'
      };
    }
  } catch (e) {
    console.log('Grok API failed:', e instanceof Error ? e.message : e);
  }

  return null;
}

function parseHtmlToMarkdown(html: string, topic: string): string {
  let content = html;
  
  // Extract main content area
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 300) {
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
  
  // Clean up
  content = content.replace(/grokipedia/gi, 'this encyclopedia');
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trim();
  
  if (!content.startsWith('#')) {
    content = `# ${topic}\n\n${content}`;
  }
  
  return content;
}
