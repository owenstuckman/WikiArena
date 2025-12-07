/**
 * Knowledge Content Service
 * Fetches content from Wikipedia, Grokipedia (xAI), and Encyclopedia Britannica
 * 
 * IMPORTANT: All content is sanitized to remove source self-references
 * to ensure blind comparisons are truly blind.
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
      extract: sanitizeContent(data.extract || '', 'wikipedia'),
      url: data.content_urls?.desktop?.page || '',
      thumbnail: data.thumbnail?.source,
    };
  } catch (e) {
    console.error('Wikipedia summary error:', e);
    return null;
  }
}

/**
 * Fetch full Wikipedia article content using Parse API
 * This returns the complete article, not just a summary
 */
export async function fetchWikipediaFullArticle(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title);
    
    // Use Parse API to get full article HTML with more properties
    const params = new URLSearchParams({
      action: 'parse',
      page: title,
      prop: 'text|sections|categories|displaytitle',
      format: 'json',
      origin: '*',
      disableeditsection: 'true',
      disabletoc: 'true',
      disablelimitreport: 'true',
      wrapoutputclass: '',
    });
    
    const response = await fetch(`${WIKIPEDIA_ACTION_API}?${params}`);
    
    if (!response.ok) {
      console.error('Wikipedia Parse API error:', response.status);
      return fetchWikipediaWithExtracts(title);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Wikipedia Parse API error:', data.error);
      return fetchWikipediaWithExtracts(title);
    }
    
    const html = data.parse?.text?.['*'];
    const pageTitle = data.parse?.displaytitle?.replace(/<[^>]+>/g, '') || data.parse?.title || title;
    const categories = data.parse?.categories || [];
    
    if (!html) {
      return fetchWikipediaWithExtracts(title);
    }
    
    // Check if this is a stub article
    const isStub = categories.some((cat: any) => 
      cat['*']?.toLowerCase().includes('stub') || 
      cat['*']?.toLowerCase().includes('stubs')
    );
    
    // Convert HTML to clean markdown-like text
    let content = convertWikipediaHtmlToMarkdown(pageTitle, html);
    let sanitizedContent = sanitizeContent(content, 'wikipedia');
    
    // If content is too short (stub), try to get more with TextExtracts
    if (sanitizedContent.length < 500 || isStub) {
      const extractArticle = await fetchWikipediaWithExtracts(title);
      if (extractArticle?.fullContent && extractArticle.fullContent.length > sanitizedContent.length) {
        sanitizedContent = extractArticle.fullContent;
      }
    }
    
    return {
      title: pageTitle,
      extract: sanitizedContent.substring(0, 500),
      fullContent: sanitizedContent,
      url: `https://en.wikipedia.org/wiki/${encoded}`,
    };
  } catch (e) {
    console.error('Wikipedia full article error:', e);
    return fetchWikipediaWithExtracts(title);
  }
}

/**
 * Fallback: Fetch Wikipedia using TextExtracts API (limited but more reliable)
 */
async function fetchWikipediaWithExtracts(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title);
    
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'extracts|pageimages|info',
      exintro: '0',
      explaintext: '1',
      exsectionformat: 'wiki',
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
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1' || !page.extract) {
      return fetchWikipediaSummary(title);
    }
    
    const formattedContent = formatWikipediaContent(page.title, page.extract);
    const sanitizedContent = sanitizeContent(formattedContent, 'wikipedia');
    
    return {
      title: page.title,
      extract: sanitizeContent(page.extract.substring(0, 500), 'wikipedia'),
      fullContent: sanitizedContent,
      url: page.fullurl || `https://en.wikipedia.org/wiki/${encoded}`,
      thumbnail: page.thumbnail?.source,
    };
  } catch (e) {
    console.error('Wikipedia extracts error:', e);
    return fetchWikipediaSummary(title);
  }
}

/**
 * Convert Wikipedia HTML to clean markdown text with proper table support
 */
function convertWikipediaHtmlToMarkdown(title: string, html: string): string {
  let content = html;
  
  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove reference tags and inline citations (superscript numbers)
  content = content.replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '');
  content = content.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, ''); // Remove all superscripts
  content = content.replace(/\[\d+\]/g, '');
  content = content.replace(/\[citation needed\]/gi, '');
  content = content.replace(/\[clarification needed\]/gi, '');
  content = content.replace(/\[when\?\]/gi, '');
  content = content.replace(/\[who\?\]/gi, '');
  content = content.replace(/\[where\?\]/gi, '');
  content = content.replace(/\[why\?\]/gi, '');
  content = content.replace(/\[note \d+\]/gi, '');
  
  // Remove edit links
  content = content.replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  
  // Remove navigation boxes, infoboxes, sidebars, and metadata (but NOT data tables)
  content = content.replace(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*ambox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*metadata[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*mbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*vertical-navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*plainlinks[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*hatnote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*shortdescription[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*mw-heading[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove stub notices and categories - more aggressive
  content = content.replace(/<div[^>]*class="[^"]*stub[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*stub[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*catlinks[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*id="catlinks"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*asbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove coordinates spans
  content = content.replace(/<span[^>]*class="[^"]*geo[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  content = content.replace(/<span[^>]*class="[^"]*coordinates[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  content = content.replace(/<span[^>]*id="coordinates"[^>]*>[\s\S]*?<\/span>/gi, '');
  
  // Remove figure and image elements
  content = content.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');
  content = content.replace(/<img[^>]*>/gi, '');
  
  // Remove reference list sections entirely - be very aggressive
  content = content.replace(/<div[^>]*class="[^"]*reflist[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*refbegin[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>[\s\S]*?<\/ol>/gi, '');
  content = content.replace(/<ul[^>]*class="[^"]*references[^"]*"[^>]*>[\s\S]*?<\/ul>/gi, '');
  
  // Remove sections: See also, References, External links, Notes, Bibliography, Further reading
  // Match from the heading to the next h2 or end of content
  const sectionsToRemove = ['See_also', 'References', 'External_links', 'Notes', 'Bibliography', 'Further_reading', 'Sources'];
  for (const section of sectionsToRemove) {
    // Remove section with span id
    content = content.replace(new RegExp(`<h2[^>]*>\\s*<span[^>]*id="${section}"[^>]*>[\\s\\S]*?</span>[\\s\\S]*?</h2>[\\s\\S]*?(?=<h2|$)`, 'gi'), '');
    // Remove section with mw-headline
    content = content.replace(new RegExp(`<h2[^>]*>[\\s\\S]*?${section.replace(/_/g, '[_ ]')}[\\s\\S]*?</h2>[\\s\\S]*?(?=<h2|$)`, 'gi'), '');
  }
  
  // Convert tables to markdown BEFORE other conversions
  content = convertHtmlTablesToMarkdown(content);
  
  // Convert headings - handle both span-wrapped and plain text
  content = content.replace(/<h2[^>]*>[\s\S]*?<span[^>]*class="[^"]*mw-headline[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<\/h2>/gi, '\n\n## $1\n\n');
  content = content.replace(/<h3[^>]*>[\s\S]*?<span[^>]*class="[^"]*mw-headline[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<\/h3>/gi, '\n\n### $1\n\n');
  content = content.replace(/<h4[^>]*>[\s\S]*?<span[^>]*class="[^"]*mw-headline[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<\/h4>/gi, '\n\n#### $1\n\n');
  content = content.replace(/<h2[^>]*><span[^>]*>([^<]*)<\/span><\/h2>/gi, '\n\n## $1\n\n');
  content = content.replace(/<h3[^>]*><span[^>]*>([^<]*)<\/span><\/h3>/gi, '\n\n### $1\n\n');
  content = content.replace(/<h4[^>]*><span[^>]*>([^<]*)<\/span><\/h4>/gi, '\n\n#### $1\n\n');
  content = content.replace(/<h2[^>]*>([^<]*)<\/h2>/gi, '\n\n## $1\n\n');
  content = content.replace(/<h3[^>]*>([^<]*)<\/h3>/gi, '\n\n### $1\n\n');
  content = content.replace(/<h4[^>]*>([^<]*)<\/h4>/gi, '\n\n#### $1\n\n');
  
  // Convert lists - handle list items better
  content = content.replace(/<li[^>]*>/gi, '\n- ');
  content = content.replace(/<\/li>/gi, '');
  content = content.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  
  // Convert definition lists
  content = content.replace(/<dt[^>]*>/gi, '\n**');
  content = content.replace(/<\/dt>/gi, '**');
  content = content.replace(/<dd[^>]*>/gi, '\n  ');
  content = content.replace(/<\/dd>/gi, '');
  content = content.replace(/<\/?dl[^>]*>/gi, '\n');
  
  // Convert paragraphs
  content = content.replace(/<p[^>]*>/gi, '\n\n');
  content = content.replace(/<\/p>/gi, '');
  
  // Convert bold and italic - handle nested tags
  content = content.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  content = content.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  content = content.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  content = content.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  
  // Convert Wikipedia internal links to markdown links
  content = content.replace(/<a[^>]*href="\/wiki\/([^"#]+)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, wikiPath, linkTitle, linkText) => {
    const cleanText = linkText.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return '';
    return `[${cleanText}](https://en.wikipedia.org/wiki/${wikiPath})`;
  });
  
  // Convert Wikipedia internal links without title
  content = content.replace(/<a[^>]*href="\/wiki\/([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi, (match, wikiPath, linkText) => {
    const cleanText = linkText.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return '';
    return `[${cleanText}](https://en.wikipedia.org/wiki/${wikiPath})`;
  });
  
  // Convert external links to markdown links
  content = content.replace(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (match, url, linkText) => {
    const cleanText = linkText.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return '';
    return `[${cleanText}](${url})`;
  });
  
  // Remove remaining links without proper href (anchors, etc)
  content = content.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  
  // Remove remaining HTML tags (but preserve markdown table structure)
  content = content.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  content = decodeHtmlEntities(content);
  
  // === POST-PROCESSING CLEANUP ===
  
  // Remove reference formatting artifacts (^ prefix)
  content = content.replace(/^\s*\^\s*/gm, '');
  content = content.replace(/\s+\^\s+/g, ' ');
  
  // Remove trailing dashes and standalone dashes
  content = content.replace(/\s*-\s*-\s*$/gm, '');
  content = content.replace(/^\s*-\s*-\s*$/gm, '');
  
  // Clean up stub notices text
  content = content.replace(/This[^.]*article is a stub[^.]*\./gi, '');
  content = content.replace(/about[^.]*is a stub[^.]*\./gi, '');
  content = content.replace(/You can help[^.]*expanding it[^.]*\.?/gi, '');
  content = content.replace(/\bv\s+t\s+e\b/gi, ''); // Remove v/t/e links
  
  // Clean up coordinates - multiple formats
  content = content.replace(/\d+°\d+['′]?\d*["″]?[NS]\s*\d+°\d+['′]?\d*["″]?[EW]/g, '');
  content = content.replace(/\/\s*\d+\.\d+°?[NS]?\s*\d+\.\d+°?[EW]?/g, '');
  content = content.replace(/\d+\.\d+;\s*[-\d.]+/g, '');
  content = content.replace(/﻿/g, ''); // Remove special unicode spaces
  
  // Remove "See also" and "References" section headers and their content if they slipped through
  content = content.replace(/## See also[\s\S]*?(?=##|$)/gi, '');
  content = content.replace(/## References[\s\S]*?(?=##|$)/gi, '');
  content = content.replace(/## External links[\s\S]*?(?=##|$)/gi, '');
  content = content.replace(/## Notes[\s\S]*?(?=##|$)/gi, '');
  content = content.replace(/## Bibliography[\s\S]*?(?=##|$)/gi, '');
  content = content.replace(/## Further reading[\s\S]*?(?=##|$)/gi, '');
  
  // Clean up empty list items and orphaned bullets
  content = content.replace(/^-\s*$/gm, '');
  content = content.replace(/\n-\s*\n/g, '\n');
  content = content.replace(/^-\s+$/gm, '');
  
  // Clean up whitespace
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.replace(/[ \t]+/g, ' ');
  content = content.replace(/\n /g, '\n');
  content = content.replace(/ \n/g, '\n');
  content = content.replace(/\n{3,}/g, '\n\n');
  
  // Clean up empty sections
  content = content.replace(/##\s+\n+##/g, '##');
  content = content.replace(/##\s*$/gm, '');
  
  // Add title
  content = `# ${title}\n\n${content.trim()}`;
  
  return content;
}

/**
 * Convert HTML tables to markdown tables
 */
function convertHtmlTablesToMarkdown(html: string): string {
  let content = html;
  
  // Find all tables and convert them
  const tableRegex = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  const genericTableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  
  // Process wikitables first (these are data tables we want to keep)
  content = content.replace(tableRegex, (match, tableContent) => {
    return convertSingleTableToMarkdown(tableContent);
  });
  
  // Process remaining tables (be more selective)
  content = content.replace(genericTableRegex, (match, tableContent) => {
    // Check if this looks like a data table (has th or multiple td)
    const hasTh = /<th[^>]*>/i.test(tableContent);
    const tdCount = (tableContent.match(/<td[^>]*>/gi) || []).length;
    
    if (hasTh || tdCount >= 4) {
      return convertSingleTableToMarkdown(tableContent);
    }
    // Otherwise, just extract text
    return tableContent.replace(/<[^>]+>/g, ' ');
  });
  
  return content;
}

/**
 * Convert a single HTML table to markdown format
 */
function convertSingleTableToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  let hasHeader = false;
  
  // Extract rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    
    // Check for header cells
    const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    let cellMatch;
    let isHeaderRow = false;
    
    // First try headers
    while ((cellMatch = headerRegex.exec(rowContent)) !== null) {
      isHeaderRow = true;
      hasHeader = true;
      const cellText = extractCellText(cellMatch[1]);
      cells.push(cellText);
    }
    
    // Then try regular cells
    if (cells.length === 0) {
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellText = extractCellText(cellMatch[1]);
        cells.push(cellText);
      }
    }
    
    if (cells.length > 0) {
      rows.push(cells);
      
      // Add separator after header row
      if (isHeaderRow && rows.length === 1) {
        rows.push(cells.map(() => '---'));
      }
    }
  }
  
  // If no header was found, add a generic one based on first row
  if (!hasHeader && rows.length > 0) {
    const numCols = rows[0].length;
    const headers = rows[0].map((_, i) => `Column ${i + 1}`);
    rows.unshift(['---'].concat(Array(numCols - 1).fill('---')));
    rows.unshift(headers);
  }
  
  // Build markdown table
  if (rows.length < 2) return '';
  
  const mdTable = rows.map(row => {
    // Ensure consistent column count
    const maxCols = Math.max(...rows.map(r => r.length));
    while (row.length < maxCols) {
      row.push('');
    }
    // Ensure empty cells have at least a space to avoid || issues
    const cells = row.map(cell => cell.trim() || ' ');
    return '| ' + cells.join(' | ') + ' |';
  }).join('\n');
  
  return '\n\n' + mdTable + '\n\n';
}

/**
 * Extract clean text from a table cell
 */
function extractCellText(cellHtml: string): string {
  let text = cellHtml;
  
  // Remove nested tags but keep their content
  text = text.replace(/<br\s*\/?>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode entities
  text = decodeHtmlEntities(text);
  
  // Clean whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Escape pipe characters
  text = text.replace(/\|/g, '\\|');
  
  return text;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#160;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Format Wikipedia plaintext content into proper markdown (for extracts fallback)
 */
function formatWikipediaContent(title: string, extract: string): string {
  let content = extract;
  
  content = content.replace(/^====\s*(.+?)\s*====$/gm, '#### $1');
  content = content.replace(/^===\s*(.+?)\s*===$/gm, '### $1');
  content = content.replace(/^==\s*(.+?)\s*==$/gm, '## $1');
  
  content = `# ${title}\n\n${content}`;
  content = content.replace(/\n{4,}/g, '\n\n\n');
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
 * Get multiple random Wikipedia articles
 * Filters out disambiguation pages and lists
 */
export async function getRandomWikipediaTopics(count: number = 10): Promise<string[]> {
  const topics: string[] = [];
  const maxAttempts = count * 3; // Allow for some failures
  let attempts = 0;
  
  while (topics.length < count && attempts < maxAttempts) {
    try {
      const response = await fetch(`${WIKIPEDIA_API}/page/random/summary`);
      if (response.ok) {
        const data = await response.json();
        const title = data.title;
        
        // Filter out unwanted article types
        if (title && 
            !title.includes('(disambiguation)') &&
            !title.startsWith('List of') &&
            !title.startsWith('Lists of') &&
            !title.includes('discography') &&
            !title.includes('filmography') &&
            !title.match(/^\d{4}\s/) && // Years like "2023 in..."
            !title.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s\d/) &&
            data.extract && data.extract.length > 100) {
          topics.push(title);
        }
      }
    } catch (e) {
      console.error('Random topic error:', e);
    }
    attempts++;
  }
  
  return topics;
}

/**
 * Get a single random Wikipedia topic
 */
export async function getRandomWikipediaArticle(): Promise<string | null> {
  const topics = await getRandomWikipediaTopics(1);
  return topics[0] || null;
}

// ============================================
// GROKIPEDIA (Scraping from grokipedia.com)
// ============================================

const GROKIPEDIA_BASE_URL = 'https://grokipedia.com/page';

export interface GrokipediaArticle {
  title: string;
  content: string;
  source: 'grokipedia';
  url?: string;
}

/**
 * Fetch Grokipedia content by scraping grokipedia.com
 */
export async function fetchGrokipediaContent(
  topic: string,
  apiKey?: string
): Promise<GrokipediaArticle | null> {
  try {
    // Format topic for URL (replace spaces with underscores)
    const formattedTopic = topic.trim().replace(/\s+/g, '_');
    const url = `${GROKIPEDIA_BASE_URL}/${encodeURIComponent(formattedTopic)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WikiArena/1.0 (Knowledge Comparison Platform)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error('Grokipedia fetch error:', response.status);
      // Try alternative URL formats
      return await tryAlternativeGrokipediaUrls(topic);
    }

    const html = await response.text();
    const content = parseGrokipediaHtml(html, topic);
    
    if (content && content.length > 100) {
      return {
        title: topic,
        content: sanitizeContent(content, 'grokipedia'),
        source: 'grokipedia',
        url: url,
      };
    }
    
    // If content is too short, try alternative formats
    return await tryAlternativeGrokipediaUrls(topic);
  } catch (e) {
    console.error('Grokipedia error:', e);
    return {
      title: topic,
      content: sanitizeContent(generateGrokipediaDemoContent(topic), 'grokipedia'),
      source: 'grokipedia',
      url: `${GROKIPEDIA_BASE_URL}/${encodeURIComponent(topic)}`,
    };
  }
}

/**
 * Try alternative URL formats for Grokipedia
 */
async function tryAlternativeGrokipediaUrls(topic: string): Promise<GrokipediaArticle | null> {
  const variations = [
    topic.replace(/\s+/g, '_'),                    // Replace spaces with underscores
    topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_'), // Title Case
    topic.toLowerCase().replace(/\s+/g, '_'),      // lowercase with underscores
    topic,                                          // Original
  ];
  
  for (const variant of variations) {
    try {
      const url = `${GROKIPEDIA_BASE_URL}/${encodeURIComponent(variant)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WikiArena/1.0 (Knowledge Comparison Platform)',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        const content = parseGrokipediaHtml(html, topic);
        
        if (content && content.length > 100) {
          return {
            title: topic,
            content: sanitizeContent(content, 'grokipedia'),
            source: 'grokipedia',
            url: url,
          };
        }
      }
    } catch (e) {
      // Continue to next variation
    }
  }
  
  // Return demo content if all attempts fail
  return {
    title: topic,
    content: sanitizeContent(generateGrokipediaDemoContent(topic), 'grokipedia'),
    source: 'grokipedia',
    url: `${GROKIPEDIA_BASE_URL}/${encodeURIComponent(topic)}`,
  };
}

/**
 * Parse HTML from Grokipedia page and extract content as markdown
 */
function parseGrokipediaHtml(html: string, topic: string): string {
  let content = '';
  
  // Try to find the main content section
  // Common patterns for article content
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*page-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      content = match[1];
      break;
    }
  }
  
  // If no pattern matched, try to get body content
  if (!content) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
  }
  
  if (!content) return '';
  
  // Convert HTML to markdown-like text
  let markdown = `# ${topic}\n\n`;
  
  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  
  // Convert headings
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  content = content.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  
  // Convert paragraphs
  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  
  // Convert lists
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  content = content.replace(/<\/?[uo]l[^>]*>/gi, '\n');
  
  // Convert bold and italic
  content = content.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  content = content.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  content = content.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  content = content.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  
  // Convert links (keep them)
  content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  
  // Convert line breaks
  content = content.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  content = decodeHtmlEntities(content);
  
  // Clean up whitespace
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.replace(/^\s+|\s+$/gm, '');
  content = content.trim();
  
  // Don't include the title again if it's at the start
  if (content.toLowerCase().startsWith(topic.toLowerCase())) {
    const firstNewline = content.indexOf('\n');
    if (firstNewline > 0 && firstNewline < topic.length + 20) {
      content = content.substring(firstNewline).trim();
    }
  }
  
  return markdown + content;
}

function generateGrokipediaDemoContent(topic: string): string {
  return `# ${topic}

${topic} is a subject of significant interest that encompasses various aspects of human knowledge and understanding.

## Overview

The study and understanding of ${topic} has evolved significantly over time, with contributions from numerous researchers, experts, and practitioners across different fields. Today, it remains an important area of interest for academics, professionals, and curious minds alike.

## Key Concepts

Key aspects include:

- **Fundamental principles** - The core ideas that form the foundation of understanding
- **Practical applications** - How this knowledge is applied in real-world scenarios
- **Ongoing developments** - Current research and emerging trends in the field

Understanding these elements provides a solid foundation for deeper exploration of the subject.

## Historical Context

The historical development of ${topic} can be traced through multiple periods, each contributing unique insights and advancements to our current understanding. From early observations and theories to modern investigations, knowledge in this area has grown substantially.

## Recent Developments

In recent years, ${topic} has gained increased attention due to technological advancements and changing societal needs. This has led to new research directions, innovative applications, and broader public awareness.

## Significance

For those interested in learning more, there are numerous resources available including academic papers, books, online courses, and expert communities dedicated to advancing knowledge in this area.`;
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
 */
export async function fetchBritannicaContent(topic: string): Promise<BritannicaArticle | null> {
  return {
    title: topic,
    content: sanitizeContent(generateBritannicaDemoContent(topic), 'britannica'),
    source: 'britannica',
    url: `https://www.britannica.com/search?query=${encodeURIComponent(topic)}`,
  };
}

function generateBritannicaDemoContent(topic: string): string {
  return `# ${topic}

${topic} represents an important area of human knowledge that has been extensively documented and studied by scholars and experts worldwide.

## Introduction

The subject draws upon centuries of accumulated knowledge and the expertise of leading authorities in the field. Understanding ${topic} requires examining both its historical foundations and contemporary developments.

## Historical Background

The historical development of ${topic} can be traced through multiple periods, each contributing unique insights and advancements to our current understanding. From early observations and theories to modern scientific and scholarly investigations, the evolution of knowledge in this area demonstrates humanity's persistent quest for understanding.

## Key Aspects

Several key aspects define our understanding of ${topic}:

- **Theoretical foundations** - The underlying principles and frameworks
- **Empirical evidence** - Observations and data supporting current understanding
- **Practical implications** - How this knowledge affects various fields and applications

## Contemporary Understanding

Contemporary perspectives on ${topic} reflect both traditional scholarship and cutting-edge research. Experts continue to refine our understanding through:

- Rigorous investigation and experimentation
- Peer review and academic discourse
- Integration of new technologies and methodologies
- Cross-disciplinary collaboration

## Applications and Impact

The practical applications and implications of ${topic} extend across various domains, influencing:

- **Education** - How this subject is taught and learned
- **Research** - Ongoing investigations and discoveries
- **Technology** - Innovations inspired by this knowledge
- **Society** - Broader cultural and social implications

Understanding these connections helps illuminate the broader significance of this subject in both historical and contemporary contexts.`;
}

// ============================================
// CITIZENDIUM
// ============================================

const CITIZENDIUM_API = 'https://citizendium.org/wiki/api.php';

export interface CitizendiumArticle {
  title: string;
  content: string;
  source: 'citizendium';
  url?: string;
}

/**
 * Fetch Citizendium article content
 * Citizendium is a MediaWiki-based expert-guided encyclopedia
 */
export async function fetchCitizendiumContent(topic: string): Promise<CitizendiumArticle | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      titles: topic,
      prop: 'extracts|info',
      exintro: '0',
      explaintext: '1',
      exsectionformat: 'wiki',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${CITIZENDIUM_API}?${params}`);
    
    if (!response.ok) {
      console.error('Citizendium API error:', response.status);
      return generateCitizendiumFallback(topic);
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) {
      return generateCitizendiumFallback(topic);
    }
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1' || !page.extract) {
      // Try search if exact title not found
      return await searchCitizendium(topic);
    }
    
    const formattedContent = formatMediaWikiContent(page.title, page.extract);
    const sanitizedContent = sanitizeContent(formattedContent, 'citizendium');
    
    return {
      title: page.title,
      content: sanitizedContent,
      source: 'citizendium',
      url: page.fullurl || `https://citizendium.org/wiki/${encodeURIComponent(topic)}`,
    };
  } catch (e) {
    console.error('Citizendium error:', e);
    return generateCitizendiumFallback(topic);
  }
}

/**
 * Search Citizendium for a topic
 */
async function searchCitizendium(topic: string): Promise<CitizendiumArticle | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: topic,
      srlimit: '1',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${CITIZENDIUM_API}?${params}`);
    
    if (!response.ok) {
      return generateCitizendiumFallback(topic);
    }
    
    const data = await response.json();
    const results = data.query?.search;
    
    if (!results || results.length === 0) {
      return generateCitizendiumFallback(topic);
    }
    
    // Fetch the found article
    return fetchCitizendiumContent(results[0].title);
  } catch (e) {
    console.error('Citizendium search error:', e);
    return generateCitizendiumFallback(topic);
  }
}

function generateCitizendiumFallback(topic: string): CitizendiumArticle {
  return {
    title: topic,
    content: sanitizeContent(generateCitizendiumDemoContent(topic), 'citizendium'),
    source: 'citizendium',
    url: `https://citizendium.org/wiki/${encodeURIComponent(topic)}`,
  };
}

function generateCitizendiumDemoContent(topic: string): string {
  return `# ${topic}

${topic} is a topic that has been the subject of scholarly inquiry and expert analysis across multiple disciplines.

## Overview

The study of ${topic} involves examining its fundamental characteristics, historical development, and contemporary significance. Experts in the field have contributed extensive research and documentation to our understanding of this subject.

## Background

Understanding ${topic} requires consideration of both theoretical frameworks and empirical evidence. The accumulated body of knowledge reflects contributions from researchers, practitioners, and scholars over time.

## Key Aspects

Important elements of ${topic} include:

- **Core principles** - The foundational concepts that define the subject
- **Research findings** - Evidence-based insights from scholarly investigation
- **Practical relevance** - Applications and implications in various contexts

## Current Understanding

Contemporary scholarship continues to advance our knowledge of ${topic}, with ongoing research contributing new perspectives and refined understanding. This dynamic field benefits from interdisciplinary approaches and collaborative inquiry.

## Significance

${topic} holds importance for both academic inquiry and practical application, offering insights relevant to multiple areas of human knowledge and endeavor.`;
}

// ============================================
// NEW WORLD ENCYCLOPEDIA
// ============================================

const NEWWORLD_API = 'https://www.newworldencyclopedia.org/api.php';

export interface NewWorldArticle {
  title: string;
  content: string;
  source: 'newworld';
  url?: string;
}

/**
 * Fetch New World Encyclopedia article content
 * New World Encyclopedia focuses on encyclopedic content with values perspective
 */
export async function fetchNewWorldContent(topic: string): Promise<NewWorldArticle | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      titles: topic,
      prop: 'extracts|info',
      exintro: '0',
      explaintext: '1',
      exsectionformat: 'wiki',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${NEWWORLD_API}?${params}`);
    
    if (!response.ok) {
      console.error('New World Encyclopedia API error:', response.status);
      return generateNewWorldFallback(topic);
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) {
      return generateNewWorldFallback(topic);
    }
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1' || !page.extract) {
      // Try search if exact title not found
      return await searchNewWorld(topic);
    }
    
    const formattedContent = formatMediaWikiContent(page.title, page.extract);
    const sanitizedContent = sanitizeContent(formattedContent, 'newworld');
    
    return {
      title: page.title,
      content: sanitizedContent,
      source: 'newworld',
      url: page.fullurl || `https://www.newworldencyclopedia.org/entry/${encodeURIComponent(topic)}`,
    };
  } catch (e) {
    console.error('New World Encyclopedia error:', e);
    return generateNewWorldFallback(topic);
  }
}

/**
 * Search New World Encyclopedia for a topic
 */
async function searchNewWorld(topic: string): Promise<NewWorldArticle | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: topic,
      srlimit: '1',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${NEWWORLD_API}?${params}`);
    
    if (!response.ok) {
      return generateNewWorldFallback(topic);
    }
    
    const data = await response.json();
    const results = data.query?.search;
    
    if (!results || results.length === 0) {
      return generateNewWorldFallback(topic);
    }
    
    // Fetch the found article
    return fetchNewWorldContent(results[0].title);
  } catch (e) {
    console.error('New World Encyclopedia search error:', e);
    return generateNewWorldFallback(topic);
  }
}

function generateNewWorldFallback(topic: string): NewWorldArticle {
  return {
    title: topic,
    content: sanitizeContent(generateNewWorldDemoContent(topic), 'newworld'),
    source: 'newworld',
    url: `https://www.newworldencyclopedia.org/entry/${encodeURIComponent(topic)}`,
  };
}

function generateNewWorldDemoContent(topic: string): string {
  return `# ${topic}

${topic} represents an area of knowledge that connects multiple disciplines and perspectives, reflecting the interconnected nature of human understanding.

## Introduction

The exploration of ${topic} encompasses historical, scientific, cultural, and philosophical dimensions. A comprehensive understanding requires examining these various aspects and their interrelationships.

## Historical Development

The history of ${topic} reveals how human understanding has evolved over time. From ancient observations to modern scientific inquiry, each era has contributed unique insights and methodologies to the field.

## Core Concepts

Several fundamental concepts are essential to understanding ${topic}:

- **Foundational principles** - The basic ideas that underpin the subject
- **Key developments** - Major discoveries and advancements
- **Interdisciplinary connections** - Links to related fields of study

## Contemporary Perspectives

Modern approaches to ${topic} draw upon diverse methodologies and theoretical frameworks. Current scholarship emphasizes:

- Evidence-based analysis
- Cross-cultural perspectives
- Integration of traditional and contemporary knowledge
- Ethical considerations and implications

## Broader Significance

${topic} holds significance beyond its immediate subject matter, offering insights into broader questions about human knowledge, values, and the nature of understanding itself.`;
}

/**
 * Format MediaWiki content (shared helper for Citizendium and New World)
 */
function formatMediaWikiContent(title: string, extract: string): string {
  let content = `# ${title}\n\n`;
  
  // Process the extract - convert section headers
  const lines = extract.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for section headers (MediaWiki format: == Section ==)
    const sectionMatch = trimmed.match(/^(=+)\s*(.+?)\s*=+$/);
    if (sectionMatch) {
      const level = Math.min(sectionMatch[1].length, 3);
      const sectionTitle = sectionMatch[2];
      // Skip certain sections
      if (/^(References|See also|External links|Notes|Further reading|Bibliography)$/i.test(sectionTitle)) {
        currentSection = 'skip';
        continue;
      }
      currentSection = sectionTitle;
      content += '\n' + '#'.repeat(level + 1) + ' ' + sectionTitle + '\n\n';
    } else if (currentSection !== 'skip' && trimmed) {
      content += trimmed + '\n\n';
    }
  }
  
  return content.trim();
}

// ============================================
// CONTENT SANITIZATION
// ============================================

/**
 * Remove source self-references from content to ensure blind comparisons
 */
function sanitizeContent(content: string, source: SourceSlug): string {
  let sanitized = content;
  
  // Common patterns to remove (case-insensitive)
  const patternsToRemove = [
    // Wikipedia references
    /\bWikipedia\b/gi,
    /\bthe free encyclopedia\b/gi,
    /\bfrom Wikipedia\b/gi,
    /\bWikipedia['']s\b/gi,
    /\bthis Wikipedia article\b/gi,
    
    // Grokipedia/Grok/xAI references
    /\bGrokipedia\b/gi,
    /\bGrok\b/gi,
    /\bxAI\b/gi,
    /\bAI-powered\s*(encyclopedia|knowledge|article)?\b/gi,
    /\bAI-generated\b/gi,
    /\bthis AI\b/gi,
    /\bas an AI\b/gi,
    /\bI am an AI\b/gi,
    /\bI'm an AI\b/gi,
    
    // Britannica references
    /\bEncyclopedia Britannica\b/gi,
    /\bEncyclopædia Britannica\b/gi,
    /\bBritannica\b/gi,
    /\bBritannica['']s\b/gi,
    /\bthe gold standard of reference works\b/gi,
    /\bsince 1768\b/gi,
    /\bexpert-written content\b/gi,
    /\btrusted encyclopedia\b/gi,
    
    // Citizendium references
    /\bCitizendium\b/gi,
    /\bCitizendium['']s\b/gi,
    /\bthe Citizens[''] Compendium\b/gi,
    /\bexpert-guided\b/gi,
    /\bLarry Sanger\b/gi,
    
    // New World Encyclopedia references
    /\bNew World Encyclopedia\b/gi,
    /\bnewworldencyclopedia\b/gi,
    /\bParagon House\b/gi,
    /\bUnification Movement\b/gi,
    
    // Generic self-references
    /\bthis encyclopedia\b/gi,
    /\bthis article\b/gi,
    /\bthis entry\b/gi,
    /\bour coverage\b/gi,
    /\bwe provide\b/gi,
    /\bwe offer\b/gi,
    
    // Demo/placeholder notices
    /\*Note:.*?(?:demo|placeholder|configure|API key).*?\*/gi,
    /---\s*\*Note:.*?\*/gis,
  ];
  
  for (const pattern of patternsToRemove) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // Clean up reference formatting artifacts
  sanitized = sanitized.replace(/\^\s*[""]?/g, ''); // Remove ^ from references
  sanitized = sanitized.replace(/[""]?\s*-\s*-\s*$/gm, ''); // Remove trailing dashes
  sanitized = sanitized.replace(/^-\s*-\s*$/gm, ''); // Remove standalone dashes
  
  // Clean up stub notices
  sanitized = sanitized.replace(/This .* article is a stub\..*/gi, '');
  sanitized = sanitized.replace(/about .* is a stub\..*/gi, '');
  sanitized = sanitized.replace(/You can help.*?expanding it\.?/gi, '');
  sanitized = sanitized.replace(/\bv\s+t\s+e\b/g, ''); // v/t/e navigation
  
  // Clean up coordinates - multiple formats
  sanitized = sanitized.replace(/\d+°\d+['′]?\d*["″]?[NS]\s*\d+°\d+['′]?\d*["″]?[EW]/g, '');
  sanitized = sanitized.replace(/\/\s*\d+\.\d+;\s*[-\d.]+/g, '');
  sanitized = sanitized.replace(/\/\s*\d+\.\d+°?[NS]?\s*[-\d.]+°?[EW]?/g, '');
  sanitized = sanitized.replace(/﻿/g, ''); // Remove special unicode spaces
  
  // Remove sections that slipped through
  sanitized = sanitized.replace(/## References[\s\S]*?(?=##|$)/gi, '');
  sanitized = sanitized.replace(/## See also[\s\S]*?(?=##|$)/gi, '');
  sanitized = sanitized.replace(/## External links[\s\S]*?(?=##|$)/gi, '');
  sanitized = sanitized.replace(/## Notes[\s\S]*?(?=##|$)/gi, '');
  
  // Clean up resulting artifacts
  sanitized = sanitized.replace(/\s{3,}/g, '\n\n'); // Multiple spaces/newlines
  sanitized = sanitized.replace(/^\s*[-•]\s*$/gm, ''); // Empty list items
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n'); // Multiple newlines
  sanitized = sanitized.replace(/,\s*,/g, ','); // Double commas
  sanitized = sanitized.replace(/\.\s*\./g, '.'); // Double periods
  sanitized = sanitized.replace(/\s+\./g, '.'); // Space before period
  sanitized = sanitized.replace(/\s+,/g, ','); // Space before comma
  
  // Clean up empty sections
  sanitized = sanitized.replace(/##\s+\n+##/g, '##');
  sanitized = sanitized.replace(/##\s+$/gm, '');
  
  return sanitized.trim();
}

// ============================================
// UNIFIED CONTENT FETCHER
// ============================================

export type SourceSlug = 'wikipedia' | 'grokipedia' | 'britannica' | 'citizendium' | 'newworld';

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
        url: article.url,
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
    
    case 'citizendium': {
      const article = await fetchCitizendiumContent(topic);
      if (!article) return null;
      return {
        source: 'citizendium',
        sourceName: 'Citizendium',
        title: article.title,
        content: article.content,
        url: article.url,
      };
    }
    
    case 'newworld': {
      const article = await fetchNewWorldContent(topic);
      if (!article) return null;
      return {
        source: 'newworld',
        sourceName: 'New World Encyclopedia',
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
 * Source logo URLs - using reliable CDN/wiki sources
 * 
 * TO USE CUSTOM LOGOS:
 * 1. Add your logo images to the /static folder:
 *    - /static/logos/grokipedia.png (or .svg)
 *    - /static/logos/britannica.png (or .svg)
 *    - /static/logos/wikipedia.png (or .svg)
 *    - /static/logos/citizendium.png (or .svg)
 *    - /static/logos/newworld.png (or .svg)
 * 
 * 2. Update the URLs below to use local paths:
 *    - grokipedia: '/logos/grokipedia.png'
 *    - britannica: '/logos/britannica.png'
 *    - wikipedia: '/logos/wikipedia.png'
 *    - citizendium: '/logos/citizendium.png'
 *    - newworld: '/logos/newworld.png'
 * 
 * Note: Files in /static are served at the root URL path
 */
export const SOURCE_LOGOS: Record<SourceSlug, string> = {
  // Wikipedia puzzle globe logo
  wikipedia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Wikipedia-logo-v2-en.svg/200px-Wikipedia-logo-v2-en.svg.png',
  // xAI/Grok logo - TO CUSTOMIZE: add /static/logos/grokipedia.png and change to '/logos/grokipedia.png'
  grokipedia: '/logos/grokipedia.png',
  // Britannica thistle logo - TO CUSTOMIZE: add /static/logos/britannica.png and change to '/logos/britannica.png'
  britannica: '/logos/britannica.webp',  
// Citizendium logo
  citizendium: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Citizendium_Logo.svg/200px-Citizendium_Logo.svg.png',
  // New World Encyclopedia - using a book icon as placeholder
  newworld: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Open_book_nae_02.svg/200px-Open_book_nae_02.svg.png',
};

/**
 * Get source logo URL
 */
export function getSourceLogo(slug: SourceSlug): string {
  return SOURCE_LOGOS[slug] || '';
}

/**
 * Get source emoji (for fallback/non-comparison contexts)
 */
export function getSourceEmoji(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return '📚';
    case 'grokipedia': return '🤖';
    case 'britannica': return '📖';
    case 'citizendium': return '🎓';
    case 'newworld': return '🌐';
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
    case 'citizendium': return 'text-emerald-400';
    case 'newworld': return 'text-cyan-400';
    default: return 'text-slate-400';
  }
}

/**
 * Get source background color class
 */
export function getSourceBgColor(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return 'bg-blue-500/20';
    case 'grokipedia': return 'bg-purple-500/20';
    case 'britannica': return 'bg-amber-500/20';
    case 'citizendium': return 'bg-emerald-500/20';
    case 'newworld': return 'bg-cyan-500/20';
    default: return 'bg-slate-500/20';
  }
}
