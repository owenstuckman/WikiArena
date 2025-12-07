# Knowledge Arena - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (SvelteKit)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Arena   │  │Leaderboard│  │Preferences│  │ Blender  │           │
│  │   Page   │  │   Page   │  │   Page   │  │   Page   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │             │             │                   │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐              │
│  │              Svelte Stores (State)                │              │
│  │   • matchStore  • leaderboardStore  • userStore   │              │
│  └───────────────────────┬───────────────────────────┘              │
│                          │                                          │
│  ┌───────────────────────┴───────────────────────────┐              │
│  │            Supabase Client SDK                    │              │
│  │   • Auth  • Database  • Realtime  • Functions     │              │
│  └───────────────────────┬───────────────────────────┘              │
└──────────────────────────┼──────────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┼──────────────────────────────────────────┐
│                     SUPABASE                                        │
├──────────────────────────┼──────────────────────────────────────────┤
│  ┌───────────────────────┴───────────────────────────┐              │
│  │                  Edge Functions                   │              │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │              │
│  │  │create-match │ │ submit-vote │ │   blend     │  │              │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘  │              │
│  └─────────┼───────────────┼───────────────┼─────────┘              │
│            │               │               │                        │
│  ┌─────────┼───────────────┼───────────────┼─────────┐              │
│  │         │    PostgreSQL Database        │         │              │
│  │  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐  │              │
│  │  │   sources   │ │   matches   │ │    votes    │  │              │
│  │  ├─────────────┤ ├─────────────┤ ├─────────────┤  │              │
│  │  │   ratings   │ │  user_prefs │ │blend_configs│  │              │
│  │  └─────────────┘ └─────────────┘ └─────────────┘  │              │
│  └───────────────────────────────────────────────────┘              │
│                                                                     │
│  ┌───────────────────────────────────────────────────┐              │
│  │              Realtime Subscriptions               │              │
│  │        (leaderboard updates, live matches)        │              │
│  └───────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
   │  Wikipedia  │  │  Grok API   │  │   Future    │
   │     API     │  │   (xAI)     │  │   Sources   │
   └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Frontend Architecture (SvelteKit)

### Directory Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── arena/
│   │   │   ├── ComparisonCard.svelte
│   │   │   ├── VoteButtons.svelte
│   │   │   ├── RevealPanel.svelte
│   │   │   └── TopicDisplay.svelte
│   │   ├── leaderboard/
│   │   │   ├── LeaderboardTable.svelte
│   │   │   ├── RatingBadge.svelte
│   │   │   ├── TrendIndicator.svelte
│   │   │   └── HeadToHead.svelte
│   │   ├── blend/
│   │   │   ├── BlendForm.svelte
│   │   │   ├── WeightSliders.svelte
│   │   │   └── BlendResult.svelte
│   │   └── ui/
│   │       ├── Button.svelte
│   │       ├── Card.svelte
│   │       ├── Modal.svelte
│   │       └── Loading.svelte
│   ├── stores/
│   │   ├── match.ts
│   │   ├── leaderboard.ts
│   │   ├── user.ts
│   │   └── preferences.ts
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── wikipedia.ts
│   │   ├── grok.ts
│   │   └── glicko2.ts
│   └── utils/
│       ├── formatting.ts
│       └── validation.ts
├── routes/
│   ├── +page.svelte              # Home/Landing
│   ├── +layout.svelte            # Root layout
│   ├── arena/
│   │   └── +page.svelte          # Arena comparison UI
│   ├── leaderboard/
│   │   └── +page.svelte          # Global rankings
│   ├── preferences/
│   │   └── +page.svelte          # User preferences
│   ├── blend/
│   │   └── +page.svelte          # Knowledge blender
│   └── api/
│       ├── match/+server.ts      # Match creation endpoint
│       └── vote/+server.ts       # Vote submission endpoint
└── app.html
```

### Key Stores

```typescript
// stores/match.ts
interface MatchState {
  currentMatch: Match | null;
  loading: boolean;
  error: string | null;
  phase: 'loading' | 'comparing' | 'revealing' | 'complete';
}

// stores/leaderboard.ts
interface LeaderboardState {
  sources: SourceRating[];
  lastUpdated: Date;
  filter: {
    category: string | null;
    timeRange: 'all' | 'week' | 'month';
  };
}

// stores/user.ts
interface UserState {
  session: Session | null;
  preferences: UserPreference[];
  voteHistory: Vote[];
  blendConfigs: BlendConfig[];
}
```

---

## Backend Architecture (Supabase)

### Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sources table (knowledge sources like Wikipedia, Grokipedia)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  api_endpoint VARCHAR(500),
  api_config JSONB DEFAULT '{}',
  logo_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  
  -- Glicko-2 rating fields
  rating FLOAT DEFAULT 1500,
  rating_deviation FLOAT DEFAULT 350,
  volatility FLOAT DEFAULT 0.06,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rating history for charts
CREATE TABLE rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  rating FLOAT NOT NULL,
  rating_deviation FLOAT NOT NULL,
  volatility FLOAT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topics for comparison
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(100),
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches (comparison sessions)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES topics(id),
  topic_query VARCHAR(500) NOT NULL,
  
  source_a_id UUID REFERENCES sources(id) NOT NULL,
  source_b_id UUID REFERENCES sources(id) NOT NULL,
  
  source_a_content TEXT,
  source_b_content TEXT,
  source_a_position INT NOT NULL, -- 1 = left, 2 = right (randomized)
  
  -- Cache metadata
  content_fetched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID NOT NULL, -- For anonymous tracking
  
  winner VARCHAR(10) NOT NULL CHECK (winner IN ('a', 'b', 'tie', 'both_bad')),
  
  -- Rating changes applied
  source_a_rating_before FLOAT,
  source_a_rating_after FLOAT,
  source_b_rating_before FLOAT,
  source_b_rating_after FLOAT,
  
  -- Vote metadata
  time_to_vote_ms INT, -- How long user took to decide
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences (aggregated from votes)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE NOT NULL,
  
  preference_score FLOAT DEFAULT 0, -- Calculated preference weight
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  ties INT DEFAULT 0,
  
  category VARCHAR(100), -- Optional category-specific preference
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, source_id, category)
);

-- Blend configurations
CREATE TABLE blend_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Source weights as JSON: { "wikipedia": 0.6, "grokipedia": 0.4 }
  weights JSONB NOT NULL DEFAULT '{}',
  
  -- Custom formatting instructions
  format_prompt TEXT,
  output_style VARCHAR(50) DEFAULT 'balanced', -- concise, detailed, academic, casual
  
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_votes_match_id ON votes(match_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_created_at ON votes(created_at);
CREATE INDEX idx_matches_sources ON matches(source_a_id, source_b_id);
CREATE INDEX idx_rating_history_source ON rating_history(source_id, recorded_at);
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- Trigger to update source ratings timestamp
CREATE OR REPLACE FUNCTION update_source_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_source_timestamp();
```

### Row Level Security Policies

```sql
-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE blend_configs ENABLE ROW LEVEL SECURITY;

-- Sources: Public read, admin write
CREATE POLICY "Sources are viewable by everyone" ON sources
  FOR SELECT USING (true);

-- Matches: Public read, service role create
CREATE POLICY "Matches are viewable by everyone" ON matches
  FOR SELECT USING (true);

-- Votes: Users can read their own, service can read all
CREATE POLICY "Users can view their own votes" ON votes
  FOR SELECT USING (
    auth.uid() = user_id OR 
    session_id = current_setting('app.session_id', true)::uuid
  );

CREATE POLICY "Anyone can create votes" ON votes
  FOR INSERT WITH CHECK (true);

-- User preferences: Users can only access their own
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Blend configs: Users can only access their own
CREATE POLICY "Users can manage own blend configs" ON blend_configs
  FOR ALL USING (auth.uid() = user_id);
```

---

## Glicko-2 Implementation

### Algorithm Overview

The Glicko-2 system uses three parameters per player/source:
1. **Rating (μ)**: Skill estimate (default: 1500)
2. **Rating Deviation (φ)**: Uncertainty in rating (default: 350)
3. **Volatility (σ)**: Expected fluctuation (default: 0.06)

### Implementation (TypeScript)

```typescript
// lib/services/glicko2.ts

const TAU = 0.5; // System constant
const SCALE = 173.7178; // Glicko-2 scaling factor

interface Rating {
  mu: number;      // Rating
  phi: number;     // Rating deviation
  sigma: number;   // Volatility
}

interface MatchResult {
  opponent: Rating;
  score: number; // 1 = win, 0.5 = tie, 0 = loss
}

export function updateRating(
  player: Rating,
  results: MatchResult[]
): Rating {
  // Step 1: Convert to Glicko-2 scale
  const mu = (player.mu - 1500) / SCALE;
  const phi = player.phi / SCALE;
  
  // Step 2: Compute variance (v)
  let vInverse = 0;
  let delta = 0;
  
  for (const result of results) {
    const muJ = (result.opponent.mu - 1500) / SCALE;
    const phiJ = result.opponent.phi / SCALE;
    
    const g = gFunction(phiJ);
    const E = expectedScore(mu, muJ, phiJ);
    
    vInverse += g * g * E * (1 - E);
    delta += g * (result.score - E);
  }
  
  const v = 1 / vInverse;
  delta *= v;
  
  // Step 3: Compute new volatility (σ')
  const newSigma = computeVolatility(player.sigma, phi, v, delta);
  
  // Step 4: Update rating deviation
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  
  // Step 5: Update rating
  const newMu = mu + newPhi * newPhi * delta / v;
  
  // Convert back to Glicko scale
  return {
    mu: newMu * SCALE + 1500,
    phi: newPhi * SCALE,
    sigma: newSigma
  };
}

function gFunction(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-gFunction(phiJ) * (mu - muJ)));
}

function computeVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number
): number {
  // Iterative algorithm to find new volatility
  const a = Math.log(sigma * sigma);
  const epsilon = 0.000001;
  
  let A = a;
  let B: number;
  
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU, phi, v, delta, a) < 0) {
      k++;
    }
    B = a - k * TAU;
  }
  
  let fA = f(A, phi, v, delta, a);
  let fB = f(B, phi, v, delta, a);
  
  while (Math.abs(B - A) > epsilon) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C, phi, v, delta, a);
    
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    
    B = C;
    fB = fC;
  }
  
  return Math.exp(A / 2);
}

function f(
  x: number,
  phi: number,
  v: number,
  delta: number,
  a: number
): number {
  const ex = Math.exp(x);
  const d2 = delta * delta;
  const p2 = phi * phi;
  
  return (
    (ex * (d2 - p2 - v - ex)) / (2 * Math.pow(p2 + v + ex, 2)) -
    (x - a) / (TAU * TAU)
  );
}
```

---

## Edge Functions

### Create Match

```typescript
// supabase/functions/create-match/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get active sources
  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true)

  if (!sources || sources.length < 2) {
    return new Response(
      JSON.stringify({ error: 'Not enough active sources' }),
      { status: 400 }
    )
  }

  // Select random topic
  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .order('usage_count', { ascending: true })
    .limit(10)
    .single()

  // Select two random sources
  const shuffled = sources.sort(() => Math.random() - 0.5)
  const [sourceA, sourceB] = shuffled.slice(0, 2)

  // Randomize display position
  const sourceAPosition = Math.random() > 0.5 ? 1 : 2

  // Fetch content from both sources (parallel)
  const [contentA, contentB] = await Promise.all([
    fetchContent(sourceA, topic.title),
    fetchContent(sourceB, topic.title)
  ])

  // Create match record
  const { data: match, error } = await supabase
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
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single()

  // Increment topic usage
  await supabase.rpc('increment_topic_usage', { topic_id: topic.id })

  return new Response(
    JSON.stringify({
      match,
      // Return content in display order (not actual order)
      leftContent: sourceAPosition === 1 ? contentA : contentB,
      rightContent: sourceAPosition === 1 ? contentB : contentA
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

async function fetchContent(source: any, query: string): Promise<string> {
  // Implementation varies by source
  switch (source.slug) {
    case 'wikipedia':
      return fetchWikipedia(query)
    case 'grokipedia':
      return fetchGrok(query)
    default:
      throw new Error(`Unknown source: ${source.slug}`)
  }
}
```

### Submit Vote

```typescript
// supabase/functions/submit-vote/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { updateRating } from './glicko2.ts'

serve(async (req) => {
  const { matchId, winner, sessionId, timeToVote } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get match details
  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      source_a:sources!source_a_id(*),
      source_b:sources!source_b_id(*)
    `)
    .eq('id', matchId)
    .single()

  if (!match) {
    return new Response(
      JSON.stringify({ error: 'Match not found' }),
      { status: 404 }
    )
  }

  // Calculate scores based on winner
  let scoreA: number, scoreB: number
  switch (winner) {
    case 'a': scoreA = 1; scoreB = 0; break
    case 'b': scoreA = 0; scoreB = 1; break
    case 'tie': scoreA = 0.5; scoreB = 0.5; break
    case 'both_bad': scoreA = 0.5; scoreB = 0.5; break // Tie effect
    default:
      return new Response(
        JSON.stringify({ error: 'Invalid winner value' }),
        { status: 400 }
      )
  }

  // Update ratings using Glicko-2
  const ratingA = {
    mu: match.source_a.rating,
    phi: match.source_a.rating_deviation,
    sigma: match.source_a.volatility
  }

  const ratingB = {
    mu: match.source_b.rating,
    phi: match.source_b.rating_deviation,
    sigma: match.source_b.volatility
  }

  const newRatingA = updateRating(ratingA, [{ opponent: ratingB, score: scoreA }])
  const newRatingB = updateRating(ratingB, [{ opponent: ratingA, score: scoreB }])

  // Record vote
  const { data: vote, error: voteError } = await supabase
    .from('votes')
    .insert({
      match_id: matchId,
      session_id: sessionId,
      winner,
      source_a_rating_before: ratingA.mu,
      source_a_rating_after: newRatingA.mu,
      source_b_rating_before: ratingB.mu,
      source_b_rating_after: newRatingB.mu,
      time_to_vote_ms: timeToVote
    })
    .select()
    .single()

  // Update source ratings
  await Promise.all([
    supabase
      .from('sources')
      .update({
        rating: newRatingA.mu,
        rating_deviation: newRatingA.phi,
        volatility: newRatingA.sigma
      })
      .eq('id', match.source_a_id),
    supabase
      .from('sources')
      .update({
        rating: newRatingB.mu,
        rating_deviation: newRatingB.phi,
        volatility: newRatingB.sigma
      })
      .eq('id', match.source_b_id),
    // Record rating history
    supabase.from('rating_history').insert([
      { source_id: match.source_a_id, ...newRatingA },
      { source_id: match.source_b_id, ...newRatingB }
    ])
  ])

  return new Response(
    JSON.stringify({
      vote,
      ratings: {
        sourceA: { before: ratingA.mu, after: newRatingA.mu },
        sourceB: { before: ratingB.mu, after: newRatingB.mu }
      },
      reveal: {
        sourceA: match.source_a,
        sourceB: match.source_b
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## API Integrations

### Wikipedia API

```typescript
// lib/services/wikipedia.ts

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1'

export async function fetchWikipediaSummary(title: string): Promise<string> {
  const encoded = encodeURIComponent(title)
  const response = await fetch(
    `${WIKIPEDIA_API}/page/summary/${encoded}`
  )
  
  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.extract || 'No content found'
}

export async function searchWikipedia(query: string): Promise<string[]> {
  const response = await fetch(
    `${WIKIPEDIA_API}/page/related/${encodeURIComponent(query)}`
  )
  
  const data = await response.json()
  return data.pages?.map((p: any) => p.title) || []
}
```

### Grok/xAI API

```typescript
// lib/services/grok.ts

const XAI_API = 'https://api.x.ai/v1'

export async function fetchGrokResponse(query: string): Promise<string> {
  const response = await fetch(`${XAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: 'You are a knowledge encyclopedia. Provide factual, comprehensive information about the topic. Be concise but thorough.'
        },
        {
          role: 'user',
          content: `Tell me about: ${query}`
        }
      ],
      temperature: 0.3
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}

export async function blendKnowledge(
  sources: { name: string; content: string }[],
  weights: Record<string, number>,
  formatPrompt?: string
): Promise<string> {
  const sourceText = sources
    .map(s => `[${s.name} (weight: ${weights[s.name] || 0.5})]:\n${s.content}`)
    .join('\n\n---\n\n')

  const response = await fetch(`${XAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: `You are a knowledge synthesizer. Blend the following sources according to their weights, prioritizing information from higher-weighted sources. ${formatPrompt || 'Provide a balanced, comprehensive response.'}`
        },
        {
          role: 'user',
          content: sourceText
        }
      ],
      temperature: 0.5
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel / Cloudflare                  │
│                    (SvelteKit Hosting)                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  Edge Network                   │    │
│  │         Global CDN + Edge Functions             │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│                   Supabase                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │   Database   │ │     Auth     │ │   Realtime   │    │
│  │  PostgreSQL  │ │   GoTrue     │ │   WebSocket  │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│  ┌──────────────┐ ┌──────────────┐                     │
│  │    Edge      │ │   Storage    │                     │
│  │  Functions   │ │   (Logos)    │                     │
│  └──────────────┘ └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### Environment Variables

```env
# Supabase
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# External APIs
XAI_API_KEY=xxx
WIKIPEDIA_API_USER_AGENT=KnowledgeArena/1.0

# App Config
PUBLIC_APP_URL=https://knowledge-arena.com
```
