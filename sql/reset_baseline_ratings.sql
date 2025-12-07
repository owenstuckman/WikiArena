-- ============================================
-- WikiArena: Reset Sources to Equal Baseline
-- Run this in Supabase SQL Editor to ensure fair competition
-- ============================================

-- Standard Glicko-2 initial values
-- All sources start with identical ratings for fair competition

-- Reset ALL sources to equal baseline ratings
UPDATE sources SET
  rating = 1500,           -- Standard Glicko-2 starting rating
  rating_deviation = 350,  -- High RD indicates uncertainty (new player)
  volatility = 0.06,       -- Standard volatility
  total_matches = 0,
  total_wins = 0,
  total_losses = 0,
  total_ties = 0,
  updated_at = NOW()
WHERE is_active = true;

-- Also reset category ratings if they exist
DO $$
BEGIN
  UPDATE source_category_ratings SET
    rating = 1500,
    rating_deviation = 350,
    volatility = 0.06,
    total_matches = 0,
    updated_at = NOW();
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'source_category_ratings table not found, skipping';
END $$;

-- Verify the reset
SELECT 
  name,
  slug,
  rating,
  rating_deviation,
  total_matches,
  total_wins,
  total_losses,
  is_active
FROM sources 
WHERE is_active = true
ORDER BY name;

-- ============================================
-- Explanation of Glicko-2 Initial Values
-- ============================================
-- 
-- Rating: 1500
--   - Standard starting point in Glicko-2
--   - Represents "average" skill level
--   - All sources start equal for fair comparison
--
-- Rating Deviation (RD): 350
--   - Represents uncertainty about the rating
--   - High RD (350) = new/unrated player
--   - Decreases as more matches are played
--   - At 350, rating can swing significantly each match
--
-- Volatility: 0.06
--   - Expected fluctuation in rating
--   - Standard starting value
--   - Adjusts based on consistency of performance
--
-- Benefits of equal baseline:
--   1. No source has unfair advantage
--   2. Rankings emerge purely from user votes
--   3. Easy to compare sources at any point
--   4. Transparent and fair system
-- ============================================
