-- ============================================
-- WikiArena: Add New Sources SQL
-- Run this in Supabase SQL Editor
-- ============================================

-- Insert Citizendium source
INSERT INTO sources (
  id,
  name,
  slug,
  description,
  api_endpoint,
  api_config,
  logo_url,
  is_active,
  rating,
  rating_deviation,
  volatility,
  total_matches,
  total_wins,
  total_losses,
  total_ties
) VALUES (
  gen_random_uuid(),
  'Citizendium',
  'citizendium',
  'Expert-guided encyclopedia founded by Wikipedia co-founder Larry Sanger',
  'https://citizendium.org/wiki/api.php',
  '{"type": "mediawiki", "base_url": "https://citizendium.org/wiki/"}',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Citizendium_Logo.svg/200px-Citizendium_Logo.svg.png',
  true,
  1500,  -- Starting Glicko-2 rating
  350,   -- Initial rating deviation (high uncertainty)
  0.06,  -- Default volatility
  0,
  0,
  0,
  0
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  api_endpoint = EXCLUDED.api_endpoint,
  api_config = EXCLUDED.api_config,
  logo_url = EXCLUDED.logo_url,
  is_active = EXCLUDED.is_active;

-- Insert New World Encyclopedia source
INSERT INTO sources (
  id,
  name,
  slug,
  description,
  api_endpoint,
  api_config,
  logo_url,
  is_active,
  rating,
  rating_deviation,
  volatility,
  total_matches,
  total_wins,
  total_losses,
  total_ties
) VALUES (
  gen_random_uuid(),
  'New World Encyclopedia',
  'newworld',
  'Encyclopedia with editorial oversight and contextual perspectives',
  'https://www.newworldencyclopedia.org/api.php',
  '{"type": "mediawiki", "base_url": "https://www.newworldencyclopedia.org/"}',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Open_book_nae_02.svg/200px-Open_book_nae_02.svg.png',
  true,
  1500,  -- Starting Glicko-2 rating
  350,   -- Initial rating deviation (high uncertainty)
  0.06,  -- Default volatility
  0,
  0,
  0,
  0
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  api_endpoint = EXCLUDED.api_endpoint,
  api_config = EXCLUDED.api_config,
  logo_url = EXCLUDED.logo_url,
  is_active = EXCLUDED.is_active;

-- Verify the sources were added
SELECT id, name, slug, rating, rating_deviation, is_active, created_at
FROM sources
ORDER BY name;

-- ============================================
-- OPTIONAL: Add category ratings for new sources
-- Run this if you have the source_category_ratings table
-- ============================================

-- Get the IDs of the new sources
DO $$
DECLARE
  citizendium_id UUID;
  newworld_id UUID;
BEGIN
  SELECT id INTO citizendium_id FROM sources WHERE slug = 'citizendium';
  SELECT id INTO newworld_id FROM sources WHERE slug = 'newworld';
  
  -- Insert category ratings for Citizendium (if table exists)
  IF citizendium_id IS NOT NULL THEN
    INSERT INTO source_category_ratings (source_id, category, rating, rating_deviation, volatility, total_matches)
    VALUES 
      (citizendium_id, 'accuracy', 1500, 350, 0.06, 0),
      (citizendium_id, 'readability', 1500, 350, 0.06, 0),
      (citizendium_id, 'comprehensiveness', 1500, 350, 0.06, 0),
      (citizendium_id, 'objectivity', 1500, 350, 0.06, 0)
    ON CONFLICT (source_id, category) DO NOTHING;
  END IF;
  
  -- Insert category ratings for New World Encyclopedia (if table exists)
  IF newworld_id IS NOT NULL THEN
    INSERT INTO source_category_ratings (source_id, category, rating, rating_deviation, volatility, total_matches)
    VALUES 
      (newworld_id, 'accuracy', 1500, 350, 0.06, 0),
      (newworld_id, 'readability', 1500, 350, 0.06, 0),
      (newworld_id, 'comprehensiveness', 1500, 350, 0.06, 0),
      (newworld_id, 'objectivity', 1500, 350, 0.06, 0)
    ON CONFLICT (source_id, category) DO NOTHING;
  END IF;
  
EXCEPTION WHEN undefined_table THEN
  -- source_category_ratings table doesn't exist, skip
  RAISE NOTICE 'source_category_ratings table not found, skipping category ratings';
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show all active sources
SELECT 
  name,
  slug,
  rating,
  rating_deviation,
  total_matches,
  is_active
FROM sources 
WHERE is_active = true
ORDER BY rating DESC;

-- Show source count
SELECT COUNT(*) as total_sources FROM sources WHERE is_active = true;
