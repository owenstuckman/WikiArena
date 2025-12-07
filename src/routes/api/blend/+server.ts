import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { XAI_API_KEY } from '$env/static/private';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { sourceContexts, query, outputStyle, formatPrompt } = body;

    if (!sourceContexts || !query) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if API key is configured
    if (!XAI_API_KEY || XAI_API_KEY === 'your-xai-api-key-here') {
      return json({ 
        error: 'XAI_API_KEY not configured',
        demo: true,
        content: generateDemoBlend(sourceContexts, query)
      });
    }

    // Build style instruction
    const styleInstructions: Record<string, string> = {
      balanced: 'Provide a balanced mix of detail and brevity. Be informative but not overwhelming.',
      concise: 'Be extremely concise. Get straight to the point with minimal elaboration.',
      detailed: 'Provide comprehensive coverage with examples, context, and thorough explanations.',
      academic: 'Use a scholarly, formal tone. Structure with clear sections and maintain objectivity.',
      casual: 'Write in a friendly, conversational tone. Use simple language and relatable examples.',
      eli5: 'Explain like I\'m 5 years old. Use very simple words, analogies, and short sentences.',
    };

    const stylePrompt = styleInstructions[outputStyle] || styleInstructions.balanced;

    // Build the full prompt
    const systemPrompt = `You are a knowledge synthesizer that blends information from multiple encyclopedia sources into a unified, coherent response.

CRITICAL RULES:
1. Do NOT mention the source names in your response
2. Do NOT say "according to Source A" or reference sources by name
3. Synthesize the information naturally as if writing an original article
4. When sources conflict, prefer information from higher-weighted sources
5. Use markdown formatting (headings, lists, bold) appropriately
6. Include tables if the source content contains tabular data

OUTPUT STYLE: ${stylePrompt}
${formatPrompt ? `FORMAT INSTRUCTIONS: ${formatPrompt}` : ''}

Your response should be a well-structured article about the topic that combines the best information from all sources.`;

    const userPrompt = `Topic: ${query}

Here is the content from multiple knowledge sources. Please synthesize this into a single, unified article:

${sourceContexts}

Remember: Do NOT mention source names. Write as if this is original content.`;

    // Call xAI API
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('xAI API error:', response.status, errorText);
      return json({ 
        error: `xAI API error: ${response.status}`,
        demo: true,
        content: generateDemoBlend(sourceContexts, query)
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return json({ 
        error: 'No content in response',
        demo: true,
        content: generateDemoBlend(sourceContexts, query)
      });
    }

    return json({ content, demo: false });
  } catch (error) {
    console.error('Blend API error:', error);
    return json({ 
      error: 'Internal server error',
      demo: true,
      content: `# ${(await request.json().catch(() => ({ query: 'Topic' }))).query || 'Topic'}\n\nAn error occurred while blending content. Please try again.`
    }, { status: 500 });
  }
};

function generateDemoBlend(sourceContexts: string, query: string): string {
  // Parse source contexts to extract content
  const sources = sourceContexts.split('---').filter(s => s.trim());
  
  if (sources.length === 0) {
    return `# ${query}\n\nNo content available from the selected sources.`;
  }

  // Extract unique sections from sources
  const allSections: { heading: string; content: string }[] = [];
  
  for (const source of sources) {
    const sections = source.split(/(?=^## )/m);
    for (const section of sections) {
      if (section.trim()) {
        const headingMatch = section.match(/^## (.+?)$/m);
        const heading = headingMatch ? headingMatch[1].trim() : 'Overview';
        const content = headingMatch ? section.replace(/^## .+?\n/, '').trim() : section.trim();
        
        // Remove source header lines
        const cleanContent = content.replace(/^### Source:.*$/gm, '').trim();
        
        if (cleanContent.length > 50) {
          allSections.push({
            heading: heading.replace(/^#+ /, ''),
            content: cleanContent.substring(0, 600),
          });
        }
      }
    }
  }

  // Group sections by similar headings
  const uniqueHeadings = [...new Set(allSections.map(s => s.heading))];
  
  let result = `# ${query}\n\n`;
  
  // Add introduction from first source
  const intro = allSections.find(s => 
    s.heading.toLowerCase().includes('introduction') || 
    s.heading.toLowerCase().includes('overview') ||
    !s.heading.includes(' ')
  );
  
  if (intro) {
    result += intro.content.split('\n').slice(0, 3).join('\n') + '\n\n';
  }
  
  // Add unique sections (skip duplicates)
  const addedHeadings = new Set<string>();
  for (const section of allSections) {
    const normalizedHeading = section.heading.toLowerCase();
    if (!addedHeadings.has(normalizedHeading) && 
        !normalizedHeading.includes('source') &&
        section.content.length > 100) {
      addedHeadings.add(normalizedHeading);
      result += `## ${section.heading}\n\n${section.content}\n\n`;
      
      if (addedHeadings.size >= 5) break;
    }
  }
  
  result += `---\n\n*This is a demo blend. Configure your XAI_API_KEY for AI-powered synthesis.*`;
  
  return result;
}
