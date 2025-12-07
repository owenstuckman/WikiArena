-- Knowledge Arena Database Schema
-- Migration: 001_initial_schema.sql
-- Compatible with Supabase PostgreSQL 15+

-- ============================================
-- SOURCES TABLE
-- Knowledge sources (Wikipedia, Grokipedia, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  api_endpoint VARCHAR(500),
  api_config JSONB DEFAULT '{}',
  logo_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  
  -- Glicko-2 rating fields
  rating DOUBLE PRECISION DEFAULT 1500,
  rating_deviation DOUBLE PRECISION DEFAULT 350,
  volatility DOUBLE PRECISION DEFAULT 0.06,
  
  -- Statistics
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_ties INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RATING HISTORY
-- Track rating changes over time for charts
-- ============================================
CREATE TABLE IF NOT EXISTS public.rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  rating DOUBLE PRECISION NOT NULL,
  rating_deviation DOUBLE PRECISION NOT NULL,
  volatility DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TOPICS
-- Topics/queries for comparison
-- ============================================
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(100),
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATCHES
-- Comparison sessions between two sources
-- ============================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  topic_query VARCHAR(500) NOT NULL,
  
  source_a_id UUID REFERENCES public.sources(id) NOT NULL,
  source_b_id UUID REFERENCES public.sources(id) NOT NULL,
  
  source_a_content TEXT,
  source_b_content TEXT,
  
  -- Position randomization (1 = left, 2 = right)
  source_a_position INTEGER NOT NULL DEFAULT 1,
  
  -- Cache metadata
  content_fetched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Match status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOTES
-- User votes on matches
-- ============================================
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID NOT NULL, -- For anonymous tracking
  
  -- Winner: 'a', 'b', 'tie', 'both_bad'
  winner VARCHAR(10) NOT NULL CHECK (winner IN ('a', 'b', 'tie', 'both_bad')),
  
  -- Rating changes applied
  source_a_rating_before DOUBLE PRECISION,
  source_a_rating_after DOUBLE PRECISION,
  source_b_rating_before DOUBLE PRECISION,
  source_b_rating_after DOUBLE PRECISION,
  
  -- Vote metadata
  time_to_vote_ms INTEGER, -- How long user took to decide
  device_type VARCHAR(20), -- mobile, tablet, desktop
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate votes per match per session
  UNIQUE(match_id, session_id)
);

-- ============================================
-- USER PREFERENCES
-- Aggregated preferences from votes
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE NOT NULL,
  
  preference_score DOUBLE PRECISION DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  
  -- Optional category-specific preference
  category VARCHAR(100),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, source_id, category)
);

-- ============================================
-- BLEND CONFIGS
-- User's saved blend configurations
-- ============================================
CREATE TABLE IF NOT EXISTS public.blend_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Source weights: { "source_id": weight, ... }
  weights JSONB NOT NULL DEFAULT '{}',
  
  -- Custom formatting instructions
  format_prompt TEXT,
  output_style VARCHAR(50) DEFAULT 'balanced',
  
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BLEND HISTORY
-- Record of blend requests
-- ============================================
CREATE TABLE IF NOT EXISTS public.blend_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  config_id UUID REFERENCES public.blend_configs(id) ON DELETE SET NULL,
  
  query TEXT NOT NULL,
  result TEXT,
  sources_used JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_votes_match_id ON public.votes(match_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_id ON public.votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_sources ON public.matches(source_a_id, source_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_topic ON public.matches(topic_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rating_history_source ON public.rating_history(source_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_category ON public.topics(category);
CREATE INDEX IF NOT EXISTS idx_topics_usage ON public.topics(usage_count DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Increment topic usage count
CREATE OR REPLACE FUNCTION public.increment_topic_usage(p_topic_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.topics 
  SET usage_count = usage_count + 1 
  WHERE id = p_topic_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get leaderboard with computed statistics
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  slug VARCHAR(50),
  logo_url VARCHAR(500),
  rating DOUBLE PRECISION,
  rating_deviation DOUBLE PRECISION,
  total_matches INTEGER,
  total_wins INTEGER,
  total_losses INTEGER,
  total_ties INTEGER,
  win_rate DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.slug,
    s.logo_url,
    s.rating,
    s.rating_deviation,
    s.total_matches,
    s.total_wins,
    s.total_losses,
    s.total_ties,
    CASE 
      WHEN s.total_matches > 0 
      THEN ROUND((s.total_wins::NUMERIC / s.total_matches * 100)::NUMERIC, 1)::DOUBLE PRECISION
      ELSE 0::DOUBLE PRECISION
    END as win_rate
  FROM public.sources s
  WHERE s.is_active = true
  ORDER BY s.rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS sources_updated_at ON public.sources;
DROP TRIGGER IF EXISTS blend_configs_updated_at ON public.blend_configs;
DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;

-- Create triggers
CREATE TRIGGER sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER blend_configs_updated_at
  BEFORE UPDATE ON public.blend_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blend_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blend_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS "Sources are viewable by everyone" ON public.sources;
DROP POLICY IF EXISTS "Rating history is viewable by everyone" ON public.rating_history;
DROP POLICY IF EXISTS "Topics are viewable by everyone" ON public.topics;
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.matches;
DROP POLICY IF EXISTS "Anyone can create votes" ON public.votes;
DROP POLICY IF EXISTS "Users can view their own votes" ON public.votes;
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can manage own blend configs" ON public.blend_configs;
DROP POLICY IF EXISTS "Users can manage own blend history" ON public.blend_history;

-- Sources: Public read
CREATE POLICY "Sources are viewable by everyone" ON public.sources
  FOR SELECT USING (true);

-- Rating history: Public read
CREATE POLICY "Rating history is viewable by everyone" ON public.rating_history
  FOR SELECT USING (true);

-- Topics: Public read
CREATE POLICY "Topics are viewable by everyone" ON public.topics
  FOR SELECT USING (true);

-- Matches: Public read
CREATE POLICY "Matches are viewable by everyone" ON public.matches
  FOR SELECT USING (true);

-- Votes: Public insert, public read for transparency
CREATE POLICY "Anyone can create votes" ON public.votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view all votes" ON public.votes
  FOR SELECT USING (true);

-- User preferences: Users access their own
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Blend configs: Users access their own
CREATE POLICY "Users can manage own blend configs" ON public.blend_configs
  FOR ALL USING (auth.uid() = user_id);

-- Blend history: Users access their own
CREATE POLICY "Users can manage own blend history" ON public.blend_history
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SERVICE ROLE POLICIES
-- Allow service role full access for Edge Functions
-- ============================================

-- These policies allow the service role (used by Edge Functions) to perform operations
DROP POLICY IF EXISTS "Service role can manage sources" ON public.sources;
DROP POLICY IF EXISTS "Service role can manage matches" ON public.matches;
DROP POLICY IF EXISTS "Service role can manage rating_history" ON public.rating_history;
DROP POLICY IF EXISTS "Service role can manage topics" ON public.topics;

CREATE POLICY "Service role can manage sources" ON public.sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage matches" ON public.matches
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage rating_history" ON public.rating_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage topics" ON public.topics
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SEED DATA
-- ============================================

-- Insert initial sources (upsert to avoid duplicates)
INSERT INTO public.sources (name, slug, description, is_active) VALUES
  ('Wikipedia', 'wikipedia', 'The free encyclopedia that anyone can edit. Comprehensive, community-driven knowledge.', true),
  ('Grokipedia', 'grokipedia', 'AI-powered knowledge from xAI''s Grok. Real-time, conversational information.', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample topics (upsert to avoid duplicates)
INSERT INTO public.topics (title, slug, category) VALUES
  ('Artificial Intelligence', 'artificial-intelligence', 'Technology'),
  ('Climate Change', 'climate-change', 'Science'),
  ('World War II', 'world-war-ii', 'History'),
  ('Quantum Computing', 'quantum-computing', 'Technology'),
  ('The Renaissance', 'the-renaissance', 'History'),
  ('Black Holes', 'black-holes', 'Science'),
  ('Electric Vehicles', 'electric-vehicles', 'Technology'),
  ('Ancient Rome', 'ancient-rome', 'History'),
  ('Machine Learning', 'machine-learning', 'Technology'),
  ('Photosynthesis', 'photosynthesis', 'Science'),
  ('The Industrial Revolution', 'industrial-revolution', 'History'),
  ('Cryptocurrency', 'cryptocurrency', 'Technology'),
  ('DNA', 'dna', 'Science'),
  ('The French Revolution', 'french-revolution', 'History'),
  ('Solar Energy', 'solar-energy', 'Science')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- GRANTS
-- Ensure proper permissions
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant access to tables
GRANT SELECT ON public.sources TO anon, authenticated;
GRANT SELECT ON public.rating_history TO anon, authenticated;
GRANT SELECT ON public.topics TO anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT SELECT, INSERT ON public.votes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blend_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blend_history TO authenticated;

-- Full access for service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.increment_topic_usage(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated, service_role;
