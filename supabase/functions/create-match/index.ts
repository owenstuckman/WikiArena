// supabase/functions/create-match/index.ts
// Creates a new match by selecting random sources and topic

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get active sources
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesError || !sources || sources.length < 2) {
      throw new Error('Not enough active sources available');
    }

    // Get a random topic (prefer less used ones)
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: true })
      .limit(10);

    if (topicsError || !topics || topics.length === 0) {
      throw new Error('No topics available');
    }

    // Select random topic from least-used
    const topic = topics[Math.floor(Math.random() * topics.length)];

    // Select two random sources
    const shuffled = [...sources].sort(() => Math.random() - 0.5);
    const [sourceA, sourceB] = shuffled.slice(0, 2);

    // Randomize display position (1 = left, 2 = right)
    const sourceAPosition = Math.random() > 0.5 ? 1 : 2;

    // Fetch content from both sources in parallel
    const [contentA, contentB] = await Promise.all([
      fetchSourceContent(sourceA, topic.title),
      fetchSourceContent(sourceB, topic.title),
    ]);

    // Create match record
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        topic_id: topic.id,
        topic_query: topic.title,
        source_a_id: sourceA.id,
        source_b_id: sourceB.id,
        source_a_content: contentA,
        source_b_content: contentB,
        source_a_position: sourceAPosition,
        content_fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (matchError) {
      throw new Error(`Failed to create match: ${matchError.message}`);
    }

    // Increment topic usage
    await supabase.rpc('increment_topic_usage', { p_topic_id: topic.id });

    // Return match data with content in display order
    const response = {
      match: {
        id: match.id,
        topic: topic.title,
        sourceAPosition,
      },
      leftContent: sourceAPosition === 1 ? contentA : contentB,
      rightContent: sourceAPosition === 1 ? contentB : contentA,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function fetchSourceContent(source: any, query: string): Promise<string> {
  switch (source.slug) {
    case 'wikipedia':
      return await fetchWikipedia(query);
    case 'grokipedia':
      return await fetchGrok(query);
    default:
      return `Content about "${query}" from ${source.name}`;
  }
}

async function fetchWikipedia(query: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(query.replace(/ /g, '_'));
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      {
        headers: {
          'User-Agent': 'KnowledgeArena/1.0',
        },
      }
    );

    if (!response.ok) {
      return `No Wikipedia article found for "${query}".`;
    }

    const data = await response.json();
    return data.extract || `No summary available for "${query}".`;
  } catch (error) {
    return `Failed to fetch Wikipedia content for "${query}".`;
  }
}

async function fetchGrok(query: string): Promise<string> {
  const apiKey = Deno.env.get('XAI_API_KEY');
  
  if (!apiKey) {
    return `Grokipedia content about "${query}" is currently unavailable (API key not configured).`;
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
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
            content: 'You are Grokipedia, a knowledge encyclopedia. Provide factual, comprehensive information about topics. Be informative yet accessible. Keep responses concise but thorough (2-3 paragraphs).',
          },
          {
            role: 'user',
            content: `Explain: ${query}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    return `Grokipedia content about "${query}" is currently unavailable.`;
  }
}
