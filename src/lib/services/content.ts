/**
 * Knowledge Content Service
 * Fetches content from Wikipedia, Grokipedia (xAI), and Encyclopedia Britannica
 */

// ============================================
// WIKIPEDIA
// ============================================

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';
const WIKIPEDIA_ACTION_API = 'https://en.wikipedia.org/w/api.php';

export interface WikipediaArticle {
  title: string;
  extract: string;
  fullContent?: string;
  url: string;
  thumbnail?: string;
}

/**
 * Fetch Wikipedia article summary
 */
export async function fetchWikipediaSummary(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const response = await fetch(`${WIKIPEDIA_API}/page/summary/${encoded}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title,
      extract: data.extract || '',
      url: data.content_urls?.desktop?.page || '',
      thumbnail: data.thumbnail?.source,
    };
  } catch (e) {
    console.error('Wikipedia summary error:', e);
    return null;
  }
}

/**
 * Fetch full Wikipedia article content (HTML)
 */
export async function fetchWikipediaFullArticle(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    
    // Get the full HTML content
    const htmlResponse = await fetch(`${WIKIPEDIA_API}/page/html/${encoded}`);
    
    if (!htmlResponse.ok) {
      // Fall back to summary
      return fetchWikipediaSummary(title);
    }
    
    const html = await htmlResponse.text();
    
    // Also get summary for metadata
    const summary = await fetchWikipediaSummary(title);
    
    // Parse HTML to plain text (simplified)
    const plainText = htmlToPlainText(html);
    
    return {
      title: summary?.title || title,
      extract: summary?.extract || '',
      fullContent: plainText,
      url: summary?.url || `https://en.wikipedia.org/wiki/${encoded}`,
      thumbnail: summary?.thumbnail,
    };
  } catch (e) {
    console.error('Wikipedia full article error:', e);
    return fetchWikipediaSummary(title);
  }
}

/**
 * Search Wikipedia for articles
 */
export async function searchWikipedia(query: string, limit = 10): Promise<{ title: string; description: string }[]> {
  try {
    const params = new URLSearchParams({
      action: 'opensearch',
      search: query,
      limit: limit.toString(),
      namespace: '0',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${WIKIPEDIA_ACTION_API}?${params}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const titles = data[1] || [];
    const descriptions = data[2] || [];
    
    return titles.map((title: string, i: number) => ({
      title,
      description: descriptions[i] || '',
    }));
  } catch (e) {
    console.error('Wikipedia search error:', e);
    return [];
  }
}

/**
 * Get a random Wikipedia article
 */
export async function getRandomWikipediaArticle(): Promise<string | null> {
  try {
    const response = await fetch(`${WIKIPEDIA_API}/page/random/summary`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.title;
  } catch (e) {
    console.error('Wikipedia random error:', e);
    return null;
  }
}

// ============================================
// GROKIPEDIA (xAI API)
// ============================================

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export interface GrokipediaArticle {
  title: string;
  content: string;
  source: 'grokipedia';
}

/**
 * Fetch Grokipedia content via xAI API
 * Note: Requires API key - should be called server-side in production
 */
export async function fetchGrokipediaContent(
  topic: string,
  apiKey?: string
): Promise<GrokipediaArticle | null> {
  // If no API key, return demo content
  if (!apiKey) {
    return {
      title: topic,
      content: generateGrokipediaDemoContent(topic),
      source: 'grokipedia',
    };
  }

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          {
            role: 'system',
            content: `You are Grokipedia, an AI-powered encyclopedia. Provide a comprehensive, factual, and well-structured article about the given topic. Include:
- An introduction explaining what the topic is
- Key facts and information
- Historical context if relevant
- Current developments or applications
- Interesting facts or lesser-known information

Write in an encyclopedic style but make it engaging and accessible. Use clear paragraphs without markdown headers.`
          },
          {
            role: 'user',
            content: `Write an encyclopedia article about: ${topic}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('Grok API error:', response.status);
      return {
        title: topic,
        content: generateGrokipediaDemoContent(topic),
        source: 'grokipedia',
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || generateGrokipediaDemoContent(topic);

    return {
      title: topic,
      content,
      source: 'grokipedia',
    };
  } catch (e) {
    console.error('Grokipedia error:', e);
    return {
      title: topic,
      content: generateGrokipediaDemoContent(topic),
      source: 'grokipedia',
    };
  }
}

function generateGrokipediaDemoContent(topic: string): string {
  return `**${topic}**

${topic} is a fascinating subject that encompasses various aspects of human knowledge and understanding. This AI-generated article provides an overview of the key concepts and information related to this topic.

The study and understanding of ${topic} has evolved significantly over time, with contributions from numerous researchers, experts, and practitioners across different fields. Today, it remains an important area of interest for academics, professionals, and curious minds alike.

Key aspects of ${topic} include its fundamental principles, practical applications, and ongoing developments in the field. Understanding these elements provides a solid foundation for deeper exploration of the subject.

In recent years, ${topic} has gained increased attention due to technological advancements and changing societal needs. This has led to new research directions, innovative applications, and broader public awareness.

For those interested in learning more about ${topic}, there are numerous resources available including academic papers, books, online courses, and expert communities dedicated to advancing knowledge in this area.

*Note: This is demo content. Configure your xAI API key to get real AI-generated encyclopedia articles from Grokipedia.*`;
}

// ============================================
// ENCYCLOPEDIA BRITANNICA
// ============================================

export interface BritannicaArticle {
  title: string;
  content: string;
  source: 'britannica';
  url?: string;
}

/**
 * Fetch Encyclopedia Britannica content
 * Note: Britannica doesn't have a public API, so we provide curated demo content
 * In production, you would need a Britannica API partnership or use web scraping (with permission)
 */
export async function fetchBritannicaContent(topic: string): Promise<BritannicaArticle | null> {
  // Britannica doesn't have a public API
  // In production, you would integrate with their API (if available) or use licensed content
  return {
    title: topic,
    content: generateBritannicaDemoContent(topic),
    source: 'britannica',
    url: `https://www.britannica.com/search?query=${encodeURIComponent(topic)}`,
  };
}

function generateBritannicaDemoContent(topic: string): string {
  return `**${topic}**

Encyclopedia Britannica has been the gold standard of reference works since 1768, providing accurate, expert-written content on millions of topics.

${topic} represents an important area of human knowledge that has been extensively documented and studied by scholars and experts worldwide. The Encyclopedia Britannica's coverage of this topic draws upon centuries of accumulated knowledge and the expertise of leading authorities in the field.

The historical development of ${topic} can be traced through multiple periods, each contributing unique insights and advancements to our current understanding. From early observations and theories to modern scientific and scholarly investigations, the evolution of knowledge in this area demonstrates humanity's persistent quest for understanding.

Contemporary perspectives on ${topic} reflect both traditional scholarship and cutting-edge research. Experts continue to refine our understanding through rigorous investigation, peer review, and academic discourse.

The practical applications and implications of ${topic} extend across various domains, influencing education, policy, technology, and everyday life. Understanding these connections helps illuminate the broader significance of this subject.

*Note: This is demo content representing Britannica's encyclopedic style. In production, this would contain actual licensed Britannica content.*`;
}

// ============================================
// UNIFIED CONTENT FETCHER
// ============================================

export type SourceSlug = 'wikipedia' | 'grokipedia' | 'britannica';

export interface SourceContent {
  source: SourceSlug;
  sourceName: string;
  title: string;
  content: string;
  url?: string;
  thumbnail?: string;
}

/**
 * Fetch content from a specific source
 */
export async function fetchContentFromSource(
  topic: string,
  source: SourceSlug,
  xaiApiKey?: string
): Promise<SourceContent | null> {
  switch (source) {
    case 'wikipedia': {
      const article = await fetchWikipediaFullArticle(topic);
      if (!article) return null;
      return {
        source: 'wikipedia',
        sourceName: 'Wikipedia',
        title: article.title,
        content: article.fullContent || article.extract,
        url: article.url,
        thumbnail: article.thumbnail,
      };
    }
    
    case 'grokipedia': {
      const article = await fetchGrokipediaContent(topic, xaiApiKey);
      if (!article) return null;
      return {
        source: 'grokipedia',
        sourceName: 'Grokipedia',
        title: article.title,
        content: article.content,
      };
    }
    
    case 'britannica': {
      const article = await fetchBritannicaContent(topic);
      if (!article) return null;
      return {
        source: 'britannica',
        sourceName: 'Encyclopedia Britannica',
        title: article.title,
        content: article.content,
        url: article.url,
      };
    }
    
    default:
      return null;
  }
}

/**
 * Fetch content from multiple sources in parallel
 */
export async function fetchContentFromAllSources(
  topic: string,
  sources: SourceSlug[],
  xaiApiKey?: string
): Promise<SourceContent[]> {
  const results = await Promise.all(
    sources.map(source => fetchContentFromSource(topic, source, xaiApiKey))
  );
  return results.filter((r): r is SourceContent => r !== null);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Convert HTML to plain text (simplified)
 */
function htmlToPlainText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags but keep line breaks for block elements
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();
  
  // Limit length
  if (text.length > 5000) {
    text = text.substring(0, 5000) + '...';
  }
  
  return text;
}

/**
 * Get source emoji
 */
export function getSourceEmoji(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return '📚';
    case 'grokipedia': return '🤖';
    case 'britannica': return '📖';
    default: return '📄';
  }
}

/**
 * Get source color class
 */
export function getSourceColor(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return 'text-blue-400';
    case 'grokipedia': return 'text-purple-400';
    case 'britannica': return 'text-amber-400';
    default: return 'text-slate-400';
  }
}
