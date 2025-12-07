-- Knowledge Arena Database Schema
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SOURCES TABLE
-- Knowledge sources (Wikipedia, Grokipedia, etc.)
-- ============================================
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
  
  -- Statistics
  total_matches INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_losses INT DEFAULT 0,
  total_ties INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RATING HISTORY
-- Track rating changes over time for charts
-- ============================================
CREATE TABLE rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  rating FLOAT NOT NULL,
  rating_deviation FLOAT NOT NULL,
  volatility FLOAT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TOPICS
-- Topics/queries for comparison
-- ============================================
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(100),
  description TEXT,
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATCHES
-- Comparison sessions between two sources
-- ============================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES topics(id),
  topic_query VARCHAR(500) NOT NULL,
  
  source_a_id UUID REFERENCES sources(id) NOT NULL,
  source_b_id UUID REFERENCES sources(id) NOT NULL,
  
  source_a_content TEXT,
  source_b_content TEXT,
  
  -- Position randomization (1 = left, 2 = right)
  source_a_position INT NOT NULL DEFAULT 1,
  
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
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID NOT NULL, -- For anonymous tracking
  
  -- Winner: 'a', 'b', 'tie', 'both_bad'
  winner VARCHAR(10) NOT NULL CHECK (winner IN ('a', 'b', 'tie', 'both_bad')),
  
  -- Rating changes applied
  source_a_rating_before FLOAT,
  source_a_rating_after FLOAT,
  source_b_rating_before FLOAT,
  source_b_rating_after FLOAT,
  
  -- Vote metadata
  time_to_vote_ms INT, -- How long user took to decide
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
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE NOT NULL,
  
  preference_score FLOAT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  ties INT DEFAULT 0,
  
  -- Optional category-specific preference
  category VARCHAR(100),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, source_id, category)
);

-- ============================================
-- BLEND CONFIGS
-- User's saved blend configurations
-- ============================================
CREATE TABLE blend_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE blend_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  config_id UUID REFERENCES blend_configs(id) ON DELETE SET NULL,
  
  query TEXT NOT NULL,
  result TEXT,
  sources_used JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_votes_match_id ON votes(match_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_session_id ON votes(session_id);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);

CREATE INDEX idx_matches_sources ON matches(source_a_id, source_b_id);
CREATE INDEX idx_matches_topic ON matches(topic_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);

CREATE INDEX idx_rating_history_source ON rating_history(source_id, recorded_at DESC);
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_topics_category ON topics(category);
CREATE INDEX idx_topics_usage ON topics(usage_count DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update source timestamp on change
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

-- Update blend_configs timestamp
CREATE TRIGGER blend_configs_updated_at
  BEFORE UPDATE ON blend_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_source_timestamp();

-- Update user_preferences timestamp
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_source_timestamp();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Increment topic usage count
CREATE OR REPLACE FUNCTION increment_topic_usage(p_topic_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE topics 
  SET usage_count = usage_count + 1 
  WHERE id = p_topic_id;
END;
$$ LANGUAGE plpgsql;

-- Get leaderboard with computed statistics
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  slug VARCHAR(50),
  logo_url VARCHAR(500),
  rating FLOAT,
  rating_deviation FLOAT,
  total_matches INT,
  total_wins INT,
  total_losses INT,
  total_ties INT,
  win_rate FLOAT
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
      THEN ROUND((s.total_wins::NUMERIC / s.total_matches * 100)::NUMERIC, 1)
      ELSE 0
    END as win_rate
  FROM sources s
  WHERE s.is_active = true
  ORDER BY s.rating DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE blend_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blend_history ENABLE ROW LEVEL SECURITY;

-- Sources: Public read
CREATE POLICY "Sources are viewable by everyone" ON sources
  FOR SELECT USING (true);

-- Rating history: Public read
CREATE POLICY "Rating history is viewable by everyone" ON rating_history
  FOR SELECT USING (true);

-- Topics: Public read
CREATE POLICY "Topics are viewable by everyone" ON topics
  FOR SELECT USING (true);

-- Matches: Public read
CREATE POLICY "Matches are viewable by everyone" ON matches
  FOR SELECT USING (true);

-- Votes: Public insert, users can read their own
CREATE POLICY "Anyone can create votes" ON votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own votes" ON votes
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() IS NULL
  );

-- User preferences: Users access their own
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Blend configs: Users access their own
CREATE POLICY "Users can manage own blend configs" ON blend_configs
  FOR ALL USING (auth.uid() = user_id);

-- Blend history: Users access their own
CREATE POLICY "Users can manage own blend history" ON blend_history
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert initial sources
INSERT INTO sources (name, slug, description, is_active) VALUES
  ('Wikipedia', 'wikipedia', 'The free encyclopedia that anyone can edit. Comprehensive, community-driven knowledge.', true),
  ('Grokipedia', 'grokipedia', 'AI-powered knowledge from xAI''s Grok. Real-time, conversational information.', true);

-- Insert sample topics
INSERT INTO topics (title, slug, category) VALUES
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
  ('Solar Energy', 'solar-energy', 'Science');
