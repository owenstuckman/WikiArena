-- Migration: 002_fix_rls_add_britannica.sql
-- Fixes RLS policies for anonymous voting and adds Encyclopedia Britannica

-- ============================================
-- FIX RLS POLICIES FOR ANONYMOUS VOTING
-- ============================================

-- Allow anonymous users to create matches
DROP POLICY IF EXISTS "Anyone can create matches" ON public.matches;
CREATE POLICY "Anyone can create matches" ON public.matches
  FOR INSERT WITH CHECK (true);

-- Allow anonymous users to update matches (for status changes)
DROP POLICY IF EXISTS "Anyone can update matches" ON public.matches;
CREATE POLICY "Anyone can update matches" ON public.matches
  FOR UPDATE USING (true);

-- Allow anonymous users to update source ratings (for Glicko-2 updates)
DROP POLICY IF EXISTS "Anyone can update sources" ON public.sources;
CREATE POLICY "Anyone can update sources" ON public.sources
  FOR UPDATE USING (true);

-- Allow anonymous users to insert rating history
DROP POLICY IF EXISTS "Anyone can insert rating history" ON public.rating_history;
CREATE POLICY "Anyone can insert rating history" ON public.rating_history
  FOR INSERT WITH CHECK (true);

-- ============================================
-- ADD ENCYCLOPEDIA BRITANNICA SOURCE
-- ============================================

INSERT INTO public.sources (name, slug, description, is_active) VALUES
  ('Encyclopedia Britannica', 'britannica', 'The world''s most trusted encyclopedia since 1768. Expert-written, fact-checked content.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- ADD MORE TOPICS
-- ============================================

INSERT INTO public.topics (title, slug, category) VALUES
  ('Neural Networks', 'neural-networks', 'Technology'),
  ('Theory of Relativity', 'theory-of-relativity', 'Science'),
  ('The Cold War', 'the-cold-war', 'History'),
  ('Blockchain Technology', 'blockchain-technology', 'Technology'),
  ('Evolution', 'evolution', 'Science'),
  ('Ancient Egypt', 'ancient-egypt', 'History'),
  ('Cybersecurity', 'cybersecurity', 'Technology'),
  ('The Big Bang', 'the-big-bang', 'Science'),
  ('World War I', 'world-war-i', 'History'),
  ('5G Technology', '5g-technology', 'Technology'),
  ('Genetics', 'genetics', 'Science'),
  ('The Roman Empire', 'the-roman-empire', 'History'),
  ('Cloud Computing', 'cloud-computing', 'Technology'),
  ('Plate Tectonics', 'plate-tectonics', 'Science'),
  ('The American Revolution', 'american-revolution', 'History'),
  ('Virtual Reality', 'virtual-reality', 'Technology'),
  ('Human Anatomy', 'human-anatomy', 'Science'),
  ('Medieval Europe', 'medieval-europe', 'History'),
  ('Internet of Things', 'internet-of-things', 'Technology'),
  ('Astronomy', 'astronomy', 'Science')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FUNCTION: Submit vote with rating update
-- This bypasses RLS for atomic vote submission
-- ============================================

CREATE OR REPLACE FUNCTION public.submit_vote(
  p_topic_query TEXT,
  p_source_a_id UUID,
  p_source_b_id UUID,
  p_source_a_content TEXT,
  p_source_b_content TEXT,
  p_source_a_position INTEGER,
  p_winner TEXT,
  p_session_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_time_to_vote_ms INTEGER DEFAULT NULL,
  p_new_rating_a DOUBLE PRECISION DEFAULT NULL,
  p_new_rating_b DOUBLE PRECISION DEFAULT NULL,
  p_new_rd_a DOUBLE PRECISION DEFAULT NULL,
  p_new_rd_b DOUBLE PRECISION DEFAULT NULL,
  p_new_vol_a DOUBLE PRECISION DEFAULT NULL,
  p_new_vol_b DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_match_id UUID;
  v_vote_id UUID;
  v_source_a RECORD;
  v_source_b RECORD;
  v_actual_winner TEXT;
BEGIN
  -- Get current source data
  SELECT * INTO v_source_a FROM public.sources WHERE id = p_source_a_id;
  SELECT * INTO v_source_b FROM public.sources WHERE id = p_source_b_id;
  
  IF v_source_a IS NULL OR v_source_b IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid source IDs');
  END IF;

  -- Create match record
  INSERT INTO public.matches (
    topic_query,
    source_a_id,
    source_b_id,
    source_a_content,
    source_b_content,
    source_a_position,
    status
  ) VALUES (
    p_topic_query,
    p_source_a_id,
    p_source_b_id,
    p_source_a_content,
    p_source_b_content,
    p_source_a_position,
    'completed'
  )
  RETURNING id INTO v_match_id;

  -- Create vote record
  INSERT INTO public.votes (
    match_id,
    user_id,
    session_id,
    winner,
    source_a_rating_before,
    source_a_rating_after,
    source_b_rating_before,
    source_b_rating_after,
    time_to_vote_ms
  ) VALUES (
    v_match_id,
    p_user_id,
    p_session_id,
    p_winner,
    v_source_a.rating,
    COALESCE(p_new_rating_a, v_source_a.rating),
    v_source_b.rating,
    COALESCE(p_new_rating_b, v_source_b.rating),
    p_time_to_vote_ms
  )
  RETURNING id INTO v_vote_id;

  -- Determine actual winner for stats
  IF p_winner = 'a' THEN
    v_actual_winner := 'a';
  ELSIF p_winner = 'b' THEN
    v_actual_winner := 'b';
  ELSE
    v_actual_winner := 'tie';
  END IF;

  -- Update source A ratings and stats
  UPDATE public.sources SET
    rating = COALESCE(p_new_rating_a, rating),
    rating_deviation = COALESCE(p_new_rd_a, rating_deviation),
    volatility = COALESCE(p_new_vol_a, volatility),
    total_matches = total_matches + 1,
    total_wins = total_wins + CASE WHEN v_actual_winner = 'a' THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN v_actual_winner = 'b' THEN 1 ELSE 0 END,
    total_ties = total_ties + CASE WHEN v_actual_winner = 'tie' THEN 1 ELSE 0 END
  WHERE id = p_source_a_id;

  -- Update source B ratings and stats
  UPDATE public.sources SET
    rating = COALESCE(p_new_rating_b, rating),
    rating_deviation = COALESCE(p_new_rd_b, rating_deviation),
    volatility = COALESCE(p_new_vol_b, volatility),
    total_matches = total_matches + 1,
    total_wins = total_wins + CASE WHEN v_actual_winner = 'b' THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN v_actual_winner = 'a' THEN 1 ELSE 0 END,
    total_ties = total_ties + CASE WHEN v_actual_winner = 'tie' THEN 1 ELSE 0 END
  WHERE id = p_source_b_id;

  -- Insert rating history
  INSERT INTO public.rating_history (source_id, rating, rating_deviation, volatility)
  VALUES 
    (p_source_a_id, COALESCE(p_new_rating_a, v_source_a.rating), COALESCE(p_new_rd_a, v_source_a.rating_deviation), COALESCE(p_new_vol_a, v_source_a.volatility)),
    (p_source_b_id, COALESCE(p_new_rating_b, v_source_b.rating), COALESCE(p_new_rd_b, v_source_b.rating_deviation), COALESCE(p_new_vol_b, v_source_b.volatility));

  RETURN json_build_object(
    'success', true,
    'match_id', v_match_id,
    'vote_id', v_vote_id,
    'source_a_old_rating', v_source_a.rating,
    'source_a_new_rating', COALESCE(p_new_rating_a, v_source_a.rating),
    'source_b_old_rating', v_source_b.rating,
    'source_b_new_rating', COALESCE(p_new_rating_b, v_source_b.rating)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.submit_vote TO anon, authenticated;
