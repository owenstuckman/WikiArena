// supabase/functions/submit-vote/index.ts
// Records a vote and updates Glicko-2 ratings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Glicko-2 constants
const TAU = 0.5;
const SCALE = 173.7178;
const EPSILON = 0.000001;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { matchId, winner, sessionId, timeToVote } = await req.json();

    if (!matchId || !winner || !sessionId) {
      throw new Error('Missing required fields: matchId, winner, sessionId');
    }

    if (!['a', 'b', 'tie', 'both_bad'].includes(winner)) {
      throw new Error('Invalid winner value');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get match with source details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        source_a:sources!source_a_id(*),
        source_b:sources!source_b_id(*)
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      throw new Error('Match not found');
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('match_id', matchId)
      .eq('session_id', sessionId)
      .single();

    if (existingVote) {
      throw new Error('Already voted on this match');
    }

    // Calculate scores
    let scoreA: number, scoreB: number;
    switch (winner) {
      case 'a': scoreA = 1; scoreB = 0; break;
      case 'b': scoreA = 0; scoreB = 1; break;
      default: scoreA = 0.5; scoreB = 0.5;
    }

    // Current ratings
    const ratingA = {
      mu: match.source_a.rating,
      phi: match.source_a.rating_deviation,
      sigma: match.source_a.volatility,
    };

    const ratingB = {
      mu: match.source_b.rating,
      phi: match.source_b.rating_deviation,
      sigma: match.source_b.volatility,
    };

    // Calculate new ratings using Glicko-2
    const newRatingA = updateGlicko2(ratingA, ratingB, scoreA);
    const newRatingB = updateGlicko2(ratingB, ratingA, scoreB);

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
        time_to_vote_ms: timeToVote,
      })
      .select()
      .single();

    if (voteError) {
      throw new Error(`Failed to record vote: ${voteError.message}`);
    }

    // Update source ratings and stats
    await Promise.all([
      // Update source A
      supabase
        .from('sources')
        .update({
          rating: newRatingA.mu,
          rating_deviation: newRatingA.phi,
          volatility: newRatingA.sigma,
          total_matches: match.source_a.total_matches + 1,
          total_wins: match.source_a.total_wins + (winner === 'a' ? 1 : 0),
          total_losses: match.source_a.total_losses + (winner === 'b' ? 1 : 0),
          total_ties: match.source_a.total_ties + (['tie', 'both_bad'].includes(winner) ? 1 : 0),
        })
        .eq('id', match.source_a.id),

      // Update source B
      supabase
        .from('sources')
        .update({
          rating: newRatingB.mu,
          rating_deviation: newRatingB.phi,
          volatility: newRatingB.sigma,
          total_matches: match.source_b.total_matches + 1,
          total_wins: match.source_b.total_wins + (winner === 'b' ? 1 : 0),
          total_losses: match.source_b.total_losses + (winner === 'a' ? 1 : 0),
          total_ties: match.source_b.total_ties + (['tie', 'both_bad'].includes(winner) ? 1 : 0),
        })
        .eq('id', match.source_b.id),

      // Record rating history
      supabase.from('rating_history').insert([
        {
          source_id: match.source_a.id,
          rating: newRatingA.mu,
          rating_deviation: newRatingA.phi,
          volatility: newRatingA.sigma,
        },
        {
          source_id: match.source_b.id,
          rating: newRatingB.mu,
          rating_deviation: newRatingB.phi,
          volatility: newRatingB.sigma,
        },
      ]),

      // Mark match as completed
      supabase
        .from('matches')
        .update({ status: 'completed' })
        .eq('id', matchId),
    ]);

    const response = {
      vote,
      ratings: {
        sourceA: {
          before: ratingA.mu,
          after: newRatingA.mu,
          change: newRatingA.mu - ratingA.mu,
        },
        sourceB: {
          before: ratingB.mu,
          after: newRatingB.mu,
          change: newRatingB.mu - ratingB.mu,
        },
      },
      reveal: {
        sourceA: match.source_a,
        sourceB: match.source_b,
      },
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
        status: 400,
      }
    );
  }
});

// Glicko-2 Implementation
interface Rating {
  mu: number;
  phi: number;
  sigma: number;
}

function updateGlicko2(player: Rating, opponent: Rating, score: number): Rating {
  // Convert to Glicko-2 scale
  const mu = (player.mu - 1500) / SCALE;
  const phi = player.phi / SCALE;
  const muOpp = (opponent.mu - 1500) / SCALE;
  const phiOpp = opponent.phi / SCALE;

  // g function
  const g = 1 / Math.sqrt(1 + (3 * phiOpp * phiOpp) / (Math.PI * Math.PI));

  // Expected score
  const E = 1 / (1 + Math.exp(-g * (mu - muOpp)));

  // Variance
  const v = 1 / (g * g * E * (1 - E));

  // Delta
  const delta = v * g * (score - E);

  // New volatility
  const sigmaPrime = computeVolatility(player.sigma, phi, v, delta);

  // Pre-rating period RD
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

  // New RD
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  // New rating
  const muPrime = mu + phiPrime * phiPrime * g * (score - E);

  // Convert back to Glicko scale
  return {
    mu: muPrime * SCALE + 1500,
    phi: phiPrime * SCALE,
    sigma: sigmaPrime,
  };
}

function computeVolatility(sigma: number, phi: number, v: number, delta: number): number {
  const a = Math.log(sigma * sigma);
  const d2 = delta * delta;
  const p2 = phi * phi;

  let A = a;
  let B: number;

  if (d2 > p2 + v) {
    B = Math.log(d2 - p2 - v);
  } else {
    let k = 1;
    while (f(a - k * TAU, delta, phi, v, a) < 0) {
      k++;
    }
    B = a - k * TAU;
  }

  let fA = f(A, delta, phi, v, a);
  let fB = f(B, delta, phi, v, a);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C, delta, phi, v, a);

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

function f(x: number, delta: number, phi: number, v: number, a: number): number {
  const ex = Math.exp(x);
  const d2 = delta * delta;
  const p2 = phi * phi;

  const num = ex * (d2 - p2 - v - ex);
  const den = 2 * Math.pow(p2 + v + ex, 2);

  return num / den - (x - a) / (TAU * TAU);
}
