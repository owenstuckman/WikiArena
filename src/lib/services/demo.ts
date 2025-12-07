/**
 * Demo Data Service
 * Provides mock data for testing without Supabase connection
 */

import type { Source, Topic, LeaderboardEntry } from '$lib/types/database';

// Mock sources
export const DEMO_SOURCES: Source[] = [
  {
    id: 'source-wikipedia',
    name: 'Wikipedia',
    slug: 'wikipedia',
    description: 'The free encyclopedia that anyone can edit. Comprehensive, community-driven knowledge.',
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1542,
    rating_deviation: 85,
    volatility: 0.06,
    total_matches: 247,
    total_wins: 142,
    total_losses: 89,
    total_ties: 16,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'source-grokipedia',
    name: 'Grokipedia',
    slug: 'grokipedia',
    description: "AI-powered knowledge from xAI's Grok. Real-time, conversational information.",
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1458,
    rating_deviation: 92,
    volatility: 0.06,
    total_matches: 247,
    total_wins: 89,
    total_losses: 142,
    total_ties: 16,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock topics
export const DEMO_TOPICS: Topic[] = [
  { id: 't1', title: 'Artificial Intelligence', slug: 'artificial-intelligence', category: 'Technology', description: null, usage_count: 45, is_active: true, created_at: new Date().toISOString() },
  { id: 't2', title: 'Climate Change', slug: 'climate-change', category: 'Science', description: null, usage_count: 38, is_active: true, created_at: new Date().toISOString() },
  { id: 't3', title: 'Quantum Computing', slug: 'quantum-computing', category: 'Technology', description: null, usage_count: 32, is_active: true, created_at: new Date().toISOString() },
  { id: 't4', title: 'Black Holes', slug: 'black-holes', category: 'Science', description: null, usage_count: 28, is_active: true, created_at: new Date().toISOString() },
  { id: 't5', title: 'The Renaissance', slug: 'the-renaissance', category: 'History', description: null, usage_count: 22, is_active: true, created_at: new Date().toISOString() },
];

// Demo content for sources
export const DEMO_CONTENT: Record<string, Record<string, string>> = {
  'artificial-intelligence': {
    wikipedia: `Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.

The term "artificial intelligence" was coined in 1956, and AI has since become an umbrella term covering a wide variety of subfields. General-purpose techniques include search and mathematical optimization, formal logic, artificial neural networks, and statistical methods. Major goals of AI research include reasoning, knowledge representation, planning, learning, natural language processing, and perception.`,
    
    grokipedia: `**Artificial Intelligence: The Frontier of Machine Cognition**

AI represents humanity's bold attempt to recreate aspects of human intelligence in silicon form. At its core, AI systems are sophisticated pattern-recognition engines that learn from vast amounts of data to make predictions and decisions.

Modern AI can be broadly categorized into:
- **Narrow AI**: Systems designed for specific tasks (like chess, image recognition, or language translation)
- **General AI**: The still-theoretical goal of human-level reasoning across all domains

The current AI revolution is largely driven by deep learning—neural networks with many layers that can automatically discover complex patterns in data. This has enabled breakthrough applications in computer vision, natural language processing, and game playing.`,
  },
  'climate-change': {
    wikipedia: `Climate change refers to long-term shifts in global or regional climate patterns. Often specifically refers to the ongoing rise in global average temperature since the mid-20th century, primarily attributed to human activities, especially the burning of fossil fuels which increases heat-trapping greenhouse gas levels in Earth's atmosphere.

The Intergovernmental Panel on Climate Change (IPCC) has produced a series of Assessment Reports and Special Reports that are widely referenced in discussions of climate change science, impacts, and solutions. Scientific consensus is that climate change is real, human-caused, and poses significant risks to human and natural systems.`,
    
    grokipedia: `**Climate Change: Earth's Fever**

Climate change is perhaps the defining challenge of our era. The science is clear: human activities, particularly burning fossil fuels and deforestation, have increased atmospheric CO2 from ~280 ppm (pre-industrial) to over 420 ppm today—levels not seen in 800,000 years.

Key impacts already observed:
- Global temperature rise of ~1.1°C since pre-industrial times
- Sea level rise of 8-9 inches since 1880
- More frequent extreme weather events
- Shifting ecosystems and species migration

The good news? We have the technology to address it. Solar and wind are now the cheapest forms of new electricity generation in most of the world. Electric vehicles are reaching price parity with gas cars. The transition is happening—the question is whether it's fast enough.`,
  },
  'quantum-computing': {
    wikipedia: `Quantum computing is a type of computation that harnesses quantum mechanical phenomena, such as superposition and entanglement, to process information. Quantum computers use quantum bits or qubits, which can exist in multiple states simultaneously, allowing them to solve certain problems much faster than classical computers.

First proposed by physicist Richard Feynman in 1982, quantum computing has since advanced from theoretical concept to working prototypes. Major tech companies including IBM, Google, and Microsoft are investing heavily in quantum computing research. In 2019, Google claimed to have achieved "quantum supremacy"—demonstrating a quantum computer performing a calculation that would be impractical for classical computers.`,
    
    grokipedia: `**Quantum Computing: Computing's Next Giant Leap**

Imagine a computer that doesn't just calculate one possibility at a time, but explores millions of possibilities simultaneously. That's the promise of quantum computing.

Classical computers use bits (0 or 1). Quantum computers use qubits, which can be 0, 1, or both at once (superposition). When you combine multiple qubits, they can be "entangled"—meaning the state of one affects others instantly.

**Why it matters:**
- Drug discovery: Simulating molecular interactions accurately
- Cryptography: Both breaking and creating unbreakable codes
- Optimization: Solving logistics problems with countless variables
- AI: Training models exponentially faster

**Current state:** We're in the "ENIAC era" of quantum computing—the machines work but are room-sized, extremely expensive, and error-prone. But progress is accelerating.`,
  },
};

/**
 * Get demo leaderboard data
 */
export function getDemoLeaderboard(): LeaderboardEntry[] {
  return DEMO_SOURCES.map(source => ({
    id: source.id,
    name: source.name,
    slug: source.slug,
    logo_url: source.logo_url,
    rating: source.rating,
    rating_deviation: source.rating_deviation,
    total_matches: source.total_matches,
    total_wins: source.total_wins,
    total_losses: source.total_losses,
    total_ties: source.total_ties,
    win_rate: source.total_matches > 0 
      ? Math.round((source.total_wins / source.total_matches) * 1000) / 10 
      : 0,
  })).sort((a, b) => b.rating - a.rating);
}

/**
 * Get a random demo topic
 */
export function getRandomDemoTopic(): Topic {
  return DEMO_TOPICS[Math.floor(Math.random() * DEMO_TOPICS.length)];
}

/**
 * Get demo content for a topic
 */
export function getDemoContent(topicSlug: string, sourceSlug: string): string {
  const topicContent = DEMO_CONTENT[topicSlug];
  if (topicContent && topicContent[sourceSlug]) {
    return topicContent[sourceSlug];
  }
  
  // Find topic title
  const topic = DEMO_TOPICS.find(t => t.slug === topicSlug);
  const topicTitle = topic?.title || topicSlug.replace(/-/g, ' ');
  
  // Find source name
  const source = DEMO_SOURCES.find(s => s.slug === sourceSlug);
  const sourceName = source?.name || sourceSlug;
  
  // Generate fallback content based on source type
  if (sourceSlug === 'wikipedia') {
    return `**${topicTitle}** is a topic of significant interest and research. This article provides an overview based on encyclopedic knowledge.

This is placeholder content for "${topicTitle}" from Wikipedia. In production with Supabase configured, real Wikipedia content would be fetched via the MediaWiki API.

The topic encompasses various aspects and has been studied extensively by researchers and practitioners in the field. For more detailed information, please configure your Supabase connection to enable live Wikipedia integration.`;
  } else if (sourceSlug === 'grokipedia') {
    return `**${topicTitle}: An AI Perspective**

Let me break down ${topicTitle} for you in a way that's both informative and accessible.

This is simulated Grokipedia content about "${topicTitle}". In a production environment with an xAI API key configured, this would be real-time AI-generated content from Grok.

Key aspects worth understanding:
• The fundamental concepts and their practical applications
• Current developments and future implications  
• How this connects to broader fields of knowledge

Configure your environment variables to enable live AI-powered content generation.`;
  }
  
  // Generic fallback
  return `Content about "${topicTitle}" from ${sourceName}. 

This is demo placeholder content. Configure Supabase and API keys to see real content from knowledge sources.`;
}

/**
 * Simulate a vote and return updated ratings
 */
export function simulateDemoVote(
  sourceA: Source,
  sourceB: Source,
  winner: 'a' | 'b' | 'tie'
): { sourceA: Source; sourceB: Source; changeA: number; changeB: number } {
  // Simple rating change simulation
  const K = 32; // Rating change factor
  
  const expectedA = 1 / (1 + Math.pow(10, (sourceB.rating - sourceA.rating) / 400));
  const expectedB = 1 - expectedA;
  
  let scoreA: number, scoreB: number;
  switch (winner) {
    case 'a': scoreA = 1; scoreB = 0; break;
    case 'b': scoreA = 0; scoreB = 1; break;
    default: scoreA = 0.5; scoreB = 0.5;
  }
  
  const changeA = Math.round(K * (scoreA - expectedA));
  const changeB = Math.round(K * (scoreB - expectedB));
  
  return {
    sourceA: { ...sourceA, rating: sourceA.rating + changeA },
    sourceB: { ...sourceB, rating: sourceB.rating + changeB },
    changeA,
    changeB,
  };
}
