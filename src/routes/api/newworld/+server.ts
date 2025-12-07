import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { XAI_API_KEY } from '$env/static/private';

const NEWWORLD_API = 'https://www.newworldencyclopedia.org/api.php';
const NEWWORLD_BASE = 'https://www.newworldencyclopedia.org';

interface NewWorldResult {
  title: string;
  content: string;
  url: string;
  isFallback: boolean;
  notFound?: boolean;
  source?: 'mediawiki' | 'scrape' | 'grok' | 'fallback';
}

export const GET: RequestHandler = async ({ url }) => {
  const topic = url.searchParams.get('topic');
  
  if (!topic) {
    return json({ error: 'Missing topic parameter' }, { status: 400 });
  }

  // Strategy 1: Try MediaWiki API
  const mediaWikiResult = await tryMediaWikiApi(topic);
  if (mediaWikiResult) {
    return json(mediaWikiResult);
  }

  // Strategy 2: Try direct page scraping
  const scrapeResult = await tryScrape(topic);
  if (scrapeResult) {
    return json(scrapeResult);
  }

  // Strategy 3: Use Grok API to generate content
  const grokResult = await tryGrokApi(topic);
  if (grokResult) {
    return json(grokResult);
  }

  // No content found - return notFound
  return json({
    title: topic,
    content: '',
    url: `${NEWWORLD_BASE}/entry/${encodeURIComponent(topic)}`,
    isFallback: true,
    notFound: true,
    source: 'fallback'
  });
};

async function tryMediaWikiApi(topic: string): Promise<NewWorldResult | null> {
  try {
    // First try exact title
    const params = new URLSearchParams({
      action: 'query',
      titles: topic,
      prop: 'extracts|info',
      exintro: '0',
      explaintext: '0',
      exsectionformat: 'wiki',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${NEWWORLD_API}?${params}`, {
      headers: {
        'User-Agent': 'WikiArena/1.0 (Knowledge Comparison Platform)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('New World Encyclopedia API returned:', response.status);
      return null;
    }

    const data = await response.json();
    const pages = data.query?.pages;

    if (!pages) {
      return null;
    }

    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    // Page not found
    if (pageId === '-1' || !page.extract) {
      // Try search
      return await searchMediaWiki(topic);
    }

    const content = convertHtmlToMarkdown(page.extract, topic);
    
    if (content && content.length > 200) {
      return {
        title: page.title || topic,
        content,
        url: page.fullurl || `${NEWWORLD_BASE}/entry/${encodeURIComponent(topic)}`,
        isFallback: false,
        source: 'mediawiki'
      };
    }
  } catch (e) {
    console.log('New World Encyclopedia MediaWiki API error:', e instanceof Error ? e.message : e);
  }

  return null;
}

async function searchMediaWiki(topic: string): Promise<NewWorldResult | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: topic,
      srlimit: '1',
      format: 'json',
      origin: '*',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${NEWWORLD_API}?${params}`, {
      headers: {
        'User-Agent': 'WikiArena/1.0 (Knowledge Comparison Platform)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.query?.search;

    if (!results || results.length === 0) {
      return null; // No results found
    }

    // Fetch the found article
    const foundTitle = results[0].title;
    const fetchParams = new URLSearchParams({
      action: 'query',
      titles: foundTitle,
      prop: 'extracts|info',
      exintro: '0',
      explaintext: '0',
      exsectionformat: 'wiki',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });

    const fetchController = new AbortController();
    const fetchTimeoutId = setTimeout(() => fetchController.abort(), 8000);
    
    const articleResponse = await fetch(`${NEWWORLD_API}?${fetchParams}`, {
      headers: {
        'User-Agent': 'WikiArena/1.0 (Knowledge Comparison Platform)',
      },
      signal: fetchController.signal,
    });
    
    clearTimeout(fetchTimeoutId);

    if (!articleResponse.ok) return null;

    const articleData = await articleResponse.json();
    const pages = articleData.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    if (!page.extract) return null;

    const content = convertHtmlToMarkdown(page.extract, foundTitle);
    
    if (content && content.length > 200) {
      return {
        title: page.title || foundTitle,
        content,
        url: page.fullurl || `${NEWWORLD_BASE}/entry/${encodeURIComponent(foundTitle)}`,
        isFallback: false,
        source: 'mediawiki'
      };
    }
  } catch (e) {
    console.log('New World Encyclopedia search error:', e instanceof Error ? e.message : e);
  }

  return null;
}

async function tryScrape(topic: string): Promise<NewWorldResult | null> {
  try {
    const encodedTopic = encodeURIComponent(topic.replace(/\s+/g, '_'));
    const url = `${NEWWORLD_BASE}/entry/${encodedTopic}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    
    // Check if it's a valid article
    if (html.includes('There is currently no text in this page') || 
        html.includes('page does not exist') ||
        html.includes('Search results') ||
        html.includes('did not match any')) {
      return null;
    }

    const content = parseWikiHtml(html, topic);
    
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
    console.log('New World Encyclopedia scrape error:', e instanceof Error ? e.message : e);
  }

  return null;
}

async function tryGrokApi(topic: string): Promise<NewWorldResult | null> {
  if (!XAI_API_KEY) {
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
            content: `You are writing for New World Encyclopedia, which provides encyclopedic content with attention to ethical and values-based perspectives. Write comprehensive, factual articles that consider broader human significance.

Format in Markdown with:
- Clear introduction defining the subject
- Multiple sections with ## headers
- Balanced, thoughtful, educational tone
- Historical context and development
- Cultural and ethical significance where relevant
- Connections to human values and society

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

    if (content && content.length > 200) {
      return {
        title: topic,
        content: `# ${topic}\n\n${content}`,
        url: `${NEWWORLD_BASE}/entry/${encodeURIComponent(topic)}`,
        isFallback: false,
        source: 'grok'
      };
    }
  } catch (e) {
    console.log('Grok API error:', e instanceof Error ? e.message : e);
  }

  return null;
}

function convertHtmlToMarkdown(html: string, topic: string): string {
  let content = html;
  
  // Remove scripts and styles
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Convert links
  content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, (match, href, text) => {
    if (href.startsWith('/')) {
      href = `${NEWWORLD_BASE}${href}`;
    }
    return `[${text}](${href})`;
  });
  
  // Convert headers
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  content = content.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  
  // Convert paragraphs and lists
  content = content.replace(/<p[^>]*>/gi, '\n');
  content = content.replace(/<\/p>/gi, '\n');
  content = content.replace(/<li[^>]*>/gi, '- ');
  content = content.replace(/<\/li>/gi, '\n');
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
  
  // Clean up
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  content = content.trim();
  
  if (!content.startsWith('#')) {
    content = `# ${topic}\n\n${content}`;
  }
  
  // Remove self-references
  content = content.replace(/new world encyclopedia/gi, 'this encyclopedia');
  content = content.replace(/newworldencyclopedia/gi, 'this encyclopedia');
  
  return content;
}

function parseWikiHtml(html: string, topic: string): string {
  // Extract main content area
  let content = '';
  
  const contentMatch = html.match(/<div[^>]*id="mw-content-text"[^>]*>([\s\S]*?)<\/div>\s*<div/i) ||
                       html.match(/<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  
  if (contentMatch) {
    content = contentMatch[1];
  } else {
    content = html;
  }
  
  return convertHtmlToMarkdown(content, topic);
}
