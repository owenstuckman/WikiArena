/**
 * Shapley Value Calculator for Knowledge Quality Assessment
 * 
 * Calculates fair attribution of quality contributions across sources.
 * Based on cooperative game theory - measures each source's marginal contribution.
 */

export interface QualityMetrics {
  accuracy: number;      // 0-1 score for factual accuracy
  readability: number;   // 0-1 score for clarity
  depth: number;         // 0-1 score for comprehensiveness  
  objectivity: number;   // 0-1 score for neutrality
  citations: number;     // 0-1 score for sourcing
}

export interface SourceQuality {
  sourceId: string;
  sourceName: string;
  sourceSlug: string;
  metrics: QualityMetrics;
  overallScore: number;
  shapleyValue: number;
  expectedValue: number;
}

export interface QualityAssessment {
  sources: SourceQuality[];
  coalitionValue: number;  // Combined quality of all sources
  timestamp: Date;
}

/**
 * Weights for combining quality metrics into overall score
 */
const METRIC_WEIGHTS = {
  accuracy: 0.30,
  readability: 0.20,
  depth: 0.25,
  objectivity: 0.15,
  citations: 0.10,
};

/**
 * Calculate overall quality score from individual metrics
 */
export function calculateOverallScore(metrics: QualityMetrics): number {
  return (
    metrics.accuracy * METRIC_WEIGHTS.accuracy +
    metrics.readability * METRIC_WEIGHTS.readability +
    metrics.depth * METRIC_WEIGHTS.depth +
    metrics.objectivity * METRIC_WEIGHTS.objectivity +
    metrics.citations * METRIC_WEIGHTS.citations
  );
}

/**
 * Estimate quality metrics from content analysis
 * This is a heuristic-based approach - in production you'd use ML models
 * All sources start with the same base scores - differentiation comes from content analysis
 */
export function estimateQualityMetrics(content: string, sourceName: string): QualityMetrics {
  const wordCount = content.split(/\s+/).length;
  const sentenceCount = (content.match(/[.!?]+/g) || []).length;
  const paragraphCount = (content.match(/\n\n/g) || []).length + 1;
  const headingCount = (content.match(/^##?\s/gm) || []).length;
  const linkCount = (content.match(/\[.+?\]\(.+?\)/g) || []).length;
  
  // Average words per sentence (lower is more readable, optimal around 15-20)
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 20;
  
  // Readability: optimal sentences are 15-20 words, penalize very long or very short
  // Score drops as sentences deviate from optimal range
  const readability = Math.max(0, Math.min(1, 1 - Math.abs(avgWordsPerSentence - 17.5) / 25));
  
  // Depth: based on content length and structure
  // More words = more depth (up to 2000), plus bonus for good structure
  const depthFromLength = Math.min(1, wordCount / 2000);
  const depthFromStructure = Math.min(1, (headingCount + paragraphCount) / 15);
  const depth = (depthFromLength * 0.6 + depthFromStructure * 0.4);
  
  // Citations: based on link count relative to content length
  // Expect roughly 1 link per 200 words for well-cited content
  const expectedLinks = wordCount / 200;
  const citations = Math.min(1, linkCount / Math.max(expectedLinks, 1));
  
  // Accuracy: ALL sources start at same base (0.7)
  // Bonus for having citations (well-sourced content is more likely accurate)
  // Bonus for good structure (organized content tends to be more careful)
  const baseAccuracy = 0.7;
  const citationBonus = citations * 0.15; // Up to +0.15 for citations
  const structureBonus = Math.min(0.1, (headingCount / 10) * 0.1); // Up to +0.1 for structure
  const accuracy = baseAccuracy + citationBonus + structureBonus;
  
  // Objectivity: look for neutral language (penalize superlatives, opinions)
  // Count opinion words relative to content length
  const opinionWords = (content.match(/\b(best|worst|amazing|terrible|obviously|clearly|everyone knows|undoubtedly|certainly|definitely|absolutely)\b/gi) || []).length;
  const objectivity = Math.max(0.5, 1 - (opinionWords / Math.max(sentenceCount, 1)) * 2);
  
  return {
    accuracy: Math.min(1, accuracy),
    readability: Math.max(0.3, readability),
    depth: Math.max(0.2, depth),
    objectivity: Math.max(0.4, objectivity),
    citations: citations,
  };
}

/**
 * Calculate the characteristic function v(S) for a coalition S
 * This represents the "value" created by a set of sources working together
 */
function coalitionValue(qualities: SourceQuality[], coalition: number[]): number {
  if (coalition.length === 0) return 0;
  
  // Get the sources in this coalition
  const coalitionSources = coalition.map(i => qualities[i]);
  
  // Coalition value is slightly more than average (synergy)
  // but with diminishing returns for redundancy
  const scores = coalitionSources.map(s => s.overallScore);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Synergy factor: combining sources adds some value
  const synergyBonus = coalitionSources.length > 1 ? 0.05 * (coalitionSources.length - 1) : 0;
  
  // Diminishing returns for very similar sources
  const uniquenessBonus = calculateUniqueness(coalitionSources);
  
  return Math.min(1, maxScore * 0.6 + avgScore * 0.4 + synergyBonus + uniquenessBonus);
}

/**
 * Calculate uniqueness bonus - sources with different strengths add more value
 */
function calculateUniqueness(sources: SourceQuality[]): number {
  if (sources.length < 2) return 0;
  
  // Compare metric profiles
  let totalDiff = 0;
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const m1 = sources[i].metrics;
      const m2 = sources[j].metrics;
      totalDiff += Math.abs(m1.accuracy - m2.accuracy);
      totalDiff += Math.abs(m1.readability - m2.readability);
      totalDiff += Math.abs(m1.depth - m2.depth);
      totalDiff += Math.abs(m1.objectivity - m2.objectivity);
    }
  }
  
  const pairs = (sources.length * (sources.length - 1)) / 2;
  const avgDiff = totalDiff / (pairs * 4); // 4 metrics compared
  
  return avgDiff * 0.1; // Small bonus for diversity
}

/**
 * Generate all subsets of a set
 */
function* subsets(arr: number[]): Generator<number[]> {
  for (let i = 0; i < (1 << arr.length); i++) {
    const subset: number[] = [];
    for (let j = 0; j < arr.length; j++) {
      if (i & (1 << j)) {
        subset.push(arr[j]);
      }
    }
    yield subset;
  }
}

/**
 * Calculate factorial
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Calculate Shapley values for all sources
 * Shapley value = fair attribution of each source's contribution
 */
export function calculateShapleyValues(qualities: SourceQuality[]): SourceQuality[] {
  const n = qualities.length;
  if (n === 0) return [];
  
  const playerIndices = Array.from({ length: n }, (_, i) => i);
  const shapleyValues: number[] = new Array(n).fill(0);
  
  // For each player, calculate their Shapley value
  for (let i = 0; i < n; i++) {
    let phi = 0;
    
    // Consider all coalitions not containing player i
    const otherPlayers = playerIndices.filter(j => j !== i);
    
    for (const S of subsets(otherPlayers)) {
      const sSize = S.length;
      const withI = [...S, i].sort((a, b) => a - b);
      
      // Marginal contribution of i to coalition S
      const marginalContrib = coalitionValue(qualities, withI) - coalitionValue(qualities, S);
      
      // Weight by permutation count
      const weight = (factorial(sSize) * factorial(n - sSize - 1)) / factorial(n);
      
      phi += weight * marginalContrib;
    }
    
    shapleyValues[i] = phi;
  }
  
  // Update qualities with Shapley values
  return qualities.map((q, i) => ({
    ...q,
    shapleyValue: shapleyValues[i],
  }));
}

/**
 * Calculate expected value for each source based on global ratings
 */
export function calculateExpectedValues(
  qualities: SourceQuality[],
  globalRatings: Record<string, { rating: number; winRate: number }>
): SourceQuality[] {
  return qualities.map(q => {
    const globalData = globalRatings[q.sourceSlug];
    if (!globalData) {
      return { ...q, expectedValue: q.overallScore };
    }
    
    // Expected value combines local quality assessment with global performance
    // Normalized rating: 1500 is average (0.5), 1700 would be ~0.7, etc.
    const normalizedRating = (globalData.rating - 1200) / 600; // 0-1 scale roughly
    const clampedRating = Math.max(0, Math.min(1, normalizedRating));
    
    // Win rate is already 0-100, convert to 0-1
    const normalizedWinRate = globalData.winRate / 100;
    
    // Expected value: weighted combination
    const expectedValue = (
      q.overallScore * 0.4 +      // Local quality assessment
      clampedRating * 0.35 +       // Global Glicko rating
      normalizedWinRate * 0.25     // Historical win rate
    );
    
    return { ...q, expectedValue };
  });
}

/**
 * Perform full quality assessment for a set of sources
 */
export function assessQuality(
  sourceContents: { sourceId: string; sourceName: string; sourceSlug: string; content: string }[],
  globalRatings?: Record<string, { rating: number; winRate: number }>
): QualityAssessment {
  // Calculate metrics for each source
  let qualities: SourceQuality[] = sourceContents.map(sc => {
    const metrics = estimateQualityMetrics(sc.content, sc.sourceName);
    const overallScore = calculateOverallScore(metrics);
    return {
      sourceId: sc.sourceId,
      sourceName: sc.sourceName,
      sourceSlug: sc.sourceSlug,
      metrics,
      overallScore,
      shapleyValue: 0,
      expectedValue: overallScore,
    };
  });
  
  // Calculate Shapley values
  qualities = calculateShapleyValues(qualities);
  
  // Calculate expected values if global ratings provided
  if (globalRatings) {
    qualities = calculateExpectedValues(qualities, globalRatings);
  }
  
  // Calculate coalition value (all sources together)
  const coalitionVal = coalitionValue(qualities, qualities.map((_, i) => i));
  
  return {
    sources: qualities,
    coalitionValue: coalitionVal,
    timestamp: new Date(),
  };
}

/**
 * Format quality score as percentage
 */
export function formatQualityScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get quality tier label
 */
export function getQualityTier(score: number): { label: string; color: string } {
  if (score >= 0.9) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 0.75) return { label: 'Good', color: 'text-green-400' };
  if (score >= 0.6) return { label: 'Fair', color: 'text-yellow-400' };
  if (score >= 0.4) return { label: 'Basic', color: 'text-orange-400' };
  return { label: 'Limited', color: 'text-red-400' };
}

/**
 * Format Shapley value for display
 */
export function formatShapleyValue(value: number): string {
  if (value >= 0) {
    return `+${(value * 100).toFixed(1)}%`;
  }
  return `${(value * 100).toFixed(1)}%`;
}
