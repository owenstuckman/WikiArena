/**
 * Glicko-2 Rating System Implementation
 * Based on: http://www.glicko.net/glicko/glicko2.pdf
 * 
 * This implementation provides accurate competitive ratings with:
 * - Rating (μ): Player skill estimate
 * - Rating Deviation (φ): Uncertainty in rating
 * - Volatility (σ): Expected fluctuation in rating
 */

// System constant (τ) - constrains volatility change
const TAU = 0.5;

// Scaling constant for Glicko-2
const SCALE = 173.7178;

// Convergence tolerance for volatility calculation
const EPSILON = 0.000001;

// Default values for new players/sources
export const DEFAULTS = {
  rating: 1500,
  ratingDeviation: 350,
  volatility: 0.06,
} as const;

export interface Rating {
  mu: number;      // Rating (Glicko scale: ~1500)
  phi: number;     // Rating deviation (uncertainty)
  sigma: number;   // Volatility
}

export interface MatchResult {
  opponent: Rating;
  score: number;   // 1 = win, 0.5 = draw, 0 = loss
}

export interface RatingUpdate {
  newRating: Rating;
  ratingChange: number;
}

/**
 * Convert from Glicko scale to Glicko-2 scale
 */
function toGlicko2Scale(rating: Rating): { mu: number; phi: number } {
  return {
    mu: (rating.mu - 1500) / SCALE,
    phi: rating.phi / SCALE,
  };
}

/**
 * Convert from Glicko-2 scale back to Glicko scale
 */
function fromGlicko2Scale(mu: number, phi: number): { mu: number; phi: number } {
  return {
    mu: mu * SCALE + 1500,
    phi: phi * SCALE,
  };
}

/**
 * g(φ) function - reduces impact of opponent's rating based on their RD
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * E(μ, μj, φj) - Expected score against opponent
 */
function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * f(x) function used in volatility iteration
 */
function f(
  x: number,
  delta: number,
  phi: number,
  v: number,
  a: number
): number {
  const ex = Math.exp(x);
  const d2 = delta * delta;
  const p2 = phi * phi;
  
  const numerator = ex * (d2 - p2 - v - ex);
  const denominator = 2 * Math.pow(p2 + v + ex, 2);
  
  return (numerator / denominator) - ((x - a) / (TAU * TAU));
}

/**
 * Compute new volatility using iterative algorithm
 */
function computeVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number
): number {
  const a = Math.log(sigma * sigma);
  const d2 = delta * delta;
  const p2 = phi * phi;
  
  // Step 5.1: Set initial values of A and B
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
  
  // Step 5.2: Iterate
  let fA = f(A, delta, phi, v, a);
  let fB = f(B, delta, phi, v, a);
  
  // Step 5.3: Iteration loop
  while (Math.abs(B - A) > EPSILON) {
    // Step 5.4
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C, delta, phi, v, a);
    
    // Step 5.5
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    
    // Step 5.6
    B = C;
    fB = fC;
  }
  
  // Step 5.7: Return new volatility
  return Math.exp(A / 2);
}

/**
 * Update a player's rating based on match results
 * 
 * @param player - Current rating of the player
 * @param results - Array of match results against opponents
 * @returns Updated rating
 */
export function updateRating(
  player: Rating,
  results: MatchResult[]
): RatingUpdate {
  const oldRating = player.mu;
  
  // Handle case with no results (rating period with no games)
  if (results.length === 0) {
    const phiPrime = Math.sqrt(player.phi * player.phi + player.sigma * player.sigma);
    return {
      newRating: {
        mu: player.mu,
        phi: Math.min(phiPrime, DEFAULTS.ratingDeviation), // Cap at initial RD
        sigma: player.sigma,
      },
      ratingChange: 0,
    };
  }
  
  // Step 2: Convert to Glicko-2 scale
  const { mu, phi } = toGlicko2Scale(player);
  
  // Step 3: Compute v (estimated variance)
  let vInverse = 0;
  let deltaSum = 0;
  
  for (const result of results) {
    const oppScaled = toGlicko2Scale(result.opponent);
    const gVal = g(oppScaled.phi);
    const E = expectedScore(mu, oppScaled.mu, oppScaled.phi);
    
    vInverse += gVal * gVal * E * (1 - E);
    deltaSum += gVal * (result.score - E);
  }
  
  const v = 1 / vInverse;
  
  // Step 4: Compute delta (estimated improvement)
  const delta = v * deltaSum;
  
  // Step 5: Compute new volatility
  const sigmaPrime = computeVolatility(player.sigma, phi, v, delta);
  
  // Step 6: Update rating deviation to new pre-rating period value
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  
  // Step 7: Update rating and RD
  const phiPrime = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / v));
  const muPrime = mu + phiPrime * phiPrime * deltaSum;
  
  // Step 8: Convert back to Glicko scale
  const converted = fromGlicko2Scale(muPrime, phiPrime);
  
  return {
    newRating: {
      mu: converted.mu,
      phi: converted.phi,
      sigma: sigmaPrime,
    },
    ratingChange: converted.mu - oldRating,
  };
}

/**
 * Calculate expected outcome between two players
 * Returns probability of player1 winning
 */
export function predictOutcome(player1: Rating, player2: Rating): number {
  const { mu: mu1 } = toGlicko2Scale(player1);
  const scaled2 = toGlicko2Scale(player2);
  
  return expectedScore(mu1, scaled2.mu, scaled2.phi);
}

/**
 * Get rating interval (confidence bounds)
 * Default is 95% confidence interval (~2 standard deviations)
 */
export function getRatingInterval(
  rating: Rating,
  confidence: number = 0.95
): { low: number; high: number } {
  // For 95% confidence, use ~1.96 standard deviations
  const z = confidence === 0.95 ? 1.96 : 
            confidence === 0.99 ? 2.576 : 
            confidence === 0.90 ? 1.645 : 1.96;
  
  const margin = z * rating.phi;
  
  return {
    low: Math.round(rating.mu - margin),
    high: Math.round(rating.mu + margin),
  };
}

/**
 * Create a new rating with default values
 */
export function createRating(
  mu: number = DEFAULTS.rating,
  phi: number = DEFAULTS.ratingDeviation,
  sigma: number = DEFAULTS.volatility
): Rating {
  return { mu, phi, sigma };
}

/**
 * Calculate rating change for a single match
 * Convenience function for arena voting
 */
export function calculateMatchOutcome(
  sourceA: Rating,
  sourceB: Rating,
  winner: 'a' | 'b' | 'tie'
): { newRatingA: Rating; newRatingB: Rating; changeA: number; changeB: number } {
  let scoreA: number;
  let scoreB: number;
  
  switch (winner) {
    case 'a':
      scoreA = 1;
      scoreB = 0;
      break;
    case 'b':
      scoreA = 0;
      scoreB = 1;
      break;
    case 'tie':
      scoreA = 0.5;
      scoreB = 0.5;
      break;
  }
  
  const updateA = updateRating(sourceA, [{ opponent: sourceB, score: scoreA }]);
  const updateB = updateRating(sourceB, [{ opponent: sourceA, score: scoreB }]);
  
  return {
    newRatingA: updateA.newRating,
    newRatingB: updateB.newRating,
    changeA: updateA.ratingChange,
    changeB: updateB.ratingChange,
  };
}

/**
 * Format rating for display
 */
export function formatRating(rating: Rating): string {
  const interval = getRatingInterval(rating);
  return `${Math.round(rating.mu)} (${interval.low}-${interval.high})`;
}
