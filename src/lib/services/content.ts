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
  sections?: WikipediaSection[];
}

export interface WikipediaSection {
  title: string;
  content: string;
  level: number;
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
 * Fetch full Wikipedia article content using TextExtracts API
 * This provides cleaner, plaintext content with proper formatting
 */
export async function fetchWikipediaFullArticle(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title);
    
    // Use the TextExtracts API for cleaner content
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'extracts|pageimages|info',
      exintro: '0', // Get full article, not just intro
      explaintext: '1', // Get plaintext
      exsectionformat: 'wiki', // Include section headers
      exchars: '15000', // Get up to 15000 chars
      piprop: 'thumbnail',
      pithumbsize: '400',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${WIKIPEDIA_ACTION_API}?${params}`);
    
    if (!response.ok) {
      return fetchWikipediaSummary(title);
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) {
      return fetchWikipediaSummary(title);
    }
    
    // Get the first (and usually only) page
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1' || !page.extract) {
      return fetchWikipediaSummary(title);
    }
    
    // Format the content with proper markdown
    const formattedContent = formatWikipediaContent(page.title, page.extract);
    
    return {
      title: page.title,
      extract: page.extract.substring(0, 500),
      fullContent: formattedContent,
      url: page.fullurl || `https://en.wikipedia.org/wiki/${encoded}`,
      thumbnail: page.thumbnail?.source,
    };
  } catch (e) {
    console.error('Wikipedia full article error:', e);
    return fetchWikipediaSummary(title);
  }
}

/**
 * Format Wikipedia plaintext content into proper markdown
 */
function formatWikipediaContent(title: string, extract: string): string {
  let content = extract;
  
  // Convert section headers (Wikipedia returns them as "== Title ==")
  content = content.replace(/^====\s*(.+?)\s*====$/gm, '#### $1');
  content = content.replace(/^===\s*(.+?)\s*===$/gm, '### $1');
  content = content.replace(/^==\s*(.+?)\s*==$/gm, '## $1');
  
  // Add the title as H1
  content = `# ${title}\n\n${content}`;
  
  // Clean up excessive newlines
  content = content.replace(/\n{4,}/g, '\n\n\n');
  
  // Ensure paragraphs are separated properly
  content = content.replace(/\n\n/g, '\n\n');
  
  return content.trim();
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
            content: `You are Grokipedia, an AI-powered encyclopedia. Write a comprehensive, factual, well-structured article about the given topic using markdown formatting.

Structure your response with:
- A title as # heading
- An introduction paragraph
- Multiple ## sections covering different aspects
- Key facts and information
- Historical context if relevant
- Current developments or applications

Write in an engaging, encyclopedic style. Use proper markdown formatting including headers, bold, italic, and bullet points where appropriate.`
          },
          {
            role: 'user',
            content: `Write an encyclopedia article about: ${topic}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
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
  return `# ${topic}

${topic} is a fascinating subject that encompasses various aspects of human knowledge and understanding. This AI-generated article provides an overview of the key concepts and information related to this topic.

## Overview

The study and understanding of ${topic} has evolved significantly over time, with contributions from numerous researchers, experts, and practitioners across different fields. Today, it remains an important area of interest for academics, professionals, and curious minds alike.

## Key Concepts

Key aspects of ${topic} include:

- **Fundamental principles** - The core ideas that form the foundation of understanding
- **Practical applications** - How this knowledge is applied in real-world scenarios
- **Ongoing developments** - Current research and emerging trends in the field

Understanding these elements provides a solid foundation for deeper exploration of the subject.

## Recent Developments

In recent years, ${topic} has gained increased attention due to technological advancements and changing societal needs. This has led to new research directions, innovative applications, and broader public awareness.

## Further Reading

For those interested in learning more about ${topic}, there are numerous resources available including academic papers, books, online courses, and expert communities dedicated to advancing knowledge in this area.

---
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
  return `# ${topic}

**Encyclopedia Britannica** has been the gold standard of reference works since 1768, providing accurate, expert-written content on millions of topics.

## Introduction

${topic} represents an important area of human knowledge that has been extensively documented and studied by scholars and experts worldwide. The Encyclopedia Britannica's coverage of this topic draws upon centuries of accumulated knowledge and the expertise of leading authorities in the field.

## Historical Background

The historical development of ${topic} can be traced through multiple periods, each contributing unique insights and advancements to our current understanding. From early observations and theories to modern scientific and scholarly investigations, the evolution of knowledge in this area demonstrates humanity's persistent quest for understanding.

## Contemporary Perspectives

Contemporary perspectives on ${topic} reflect both traditional scholarship and cutting-edge research. Experts continue to refine our understanding through:

- Rigorous investigation and experimentation
- Peer review and academic discourse
- Integration of new technologies and methodologies
- Cross-disciplinary collaboration

## Significance and Applications

The practical applications and implications of ${topic} extend across various domains, influencing:

- **Education** - How we teach and learn about this subject
- **Policy** - Decisions made by governments and organizations
- **Technology** - Innovations inspired by this knowledge
- **Daily life** - How this affects ordinary people

Understanding these connections helps illuminate the broader significance of this subject.

---
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
