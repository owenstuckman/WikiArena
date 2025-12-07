# FAQ Verification Checklist

This document verifies that every claim made in the FAQ is accurate and shows where in the codebase it's implemented.

---

## Rating System Section

### 1. "Glicko-2 is a rating system created by Professor Mark Glickman"
**Status:** ✅ TRUE  
**Source:** External fact - Mark Glickman's paper at http://www.glicko.net/glicko/glicko2.pdf  
**Code Reference:** `src/lib/services/glicko2.ts` line 2-3 comments reference the paper

### 2. "We track three values: Rating, Rating Deviation, Volatility"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 27-31
```typescript
export interface Rating {
  mu: number;      // Rating (Glicko scale: ~1500)
  phi: number;     // Rating deviation (uncertainty)
  sigma: number;   // Volatility
}
```

### 3. "Every source starts at 1500"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 21-25
```typescript
export const DEFAULTS = {
  rating: 1500,
  ratingDeviation: 350,
  volatility: 0.06,
} as const;
```

### 4. "Rating Deviation starts at 350"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `DEFAULTS.ratingDeviation: 350`

### 5. "More votes = more confidence (lower RD)"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 200-206  
The `updateRating` function reduces phi (RD) after each match via:
```typescript
const phiPrime = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / v));
```

### 6. "Winning against a top-rated source is worth more"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 73-75  
The `expectedScore` function calculates expected outcome based on rating difference:
```typescript
function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}
```
Upsets (beating higher-rated opponent) result in larger rating changes.

### 7. "Ties cause smaller changes than wins/losses"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 276-289
```typescript
case 'tie':
  scoreA = 0.5;
  scoreB = 0.5;
  break;
```
The 0.5 score results in smaller delta than 1.0 (win) or 0.0 (loss).

### 8. "200-point gap = ~75% win probability"
**Status:** ✅ TRUE (approximately)  
**Code Reference:** `src/lib/services/glicko2.ts` `predictOutcome` function (lines 225-230)  
With mu1=1600, mu2=1400, the math works out to approximately 0.75-0.76 probability.

---

## Fairness Section

### 9. "Sources are hidden until after you vote"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/arena/+page.svelte` lines 529-565
- During comparison phase, sources shown as "Source A" and "Source B"
- Line 536: `<span class="text-lg font-semibold text-blue-400">Source A</span>`
- Line 524: `<p class="text-xs text-slate-500 mt-2">Sources are hidden until you vote</p>`

### 10. "Topics are randomized"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/topics.ts`
- `getRandomTopic()` function selects random topics from Wikipedia
- `getRandomCuratedTopic()` selects from curated list randomly

### 11. "You can search for specific topics"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/arena/+page.svelte` lines 97-123  
`handleSearch()` function calls Wikipedia API to search topics

### 12. "We track category ratings (Accuracy, Readability, Depth, Objectivity)"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/types/database.ts` lines 3-6
```typescript
export type RatingCategory = 'overall' | 'accuracy' | 'readability' | 'comprehensiveness' | 'objectivity';
```
Also in `src/routes/leaderboard/+page.svelte` with category tabs.

### 13. "All sources start with the same base quality scores"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` line 86
```typescript
const baseAccuracy = 0.7;
```
All sources use the same base accuracy of 0.7 (70%).

---

## Quality Metrics Section

### 14. "Accuracy weight is 30%"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 35-41
```typescript
const METRIC_WEIGHTS = {
  accuracy: 0.30,
  readability: 0.20,
  depth: 0.25,
  objectivity: 0.15,
  citations: 0.10,
};
```

### 15. "Depth weight is 25%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `depth: 0.25`

### 16. "Readability weight is 20%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `readability: 0.20`

### 17. "Objectivity weight is 15%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `objectivity: 0.15`

### 18. "Citations weight is 10%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `citations: 0.10`

### 19. "Accuracy starts at 70% for all sources, with bonuses for citations and structure"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 86-91
```typescript
const baseAccuracy = 0.7;
const citationBonus = citations * 0.15; // Up to +0.15 for citations
const structureBonus = Math.min(0.1, (headingCount / 10) * 0.1); // Up to +0.1 for structure
const accuracy = baseAccuracy + citationBonus + structureBonus;
```

### 20. "Readability measures sentence length (optimal 15-20 words)"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 71-73
```typescript
const readability = Math.max(0, Math.min(1, 1 - Math.abs(avgWordsPerSentence - 17.5) / 25));
```

### 21. "Objectivity detects opinion words like 'best', 'terrible', 'obviously', 'absolutely'"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 94-95
```typescript
const opinionWords = (content.match(/\b(best|worst|amazing|terrible|obviously|clearly|everyone knows|undoubtedly|certainly|definitely|absolutely)\b/gi) || []).length;
```

### 22. "Shapley values measure each source's marginal contribution"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 168-215  
`calculateShapleyValues()` function implements the Shapley formula with coalitions.

### 23. "Expected Value = 40% quality + 35% rating + 25% win rate"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 224-237
```typescript
const expectedValue = (
  q.overallScore * 0.4 +      // Local quality assessment
  clampedRating * 0.35 +       // Global Glicko rating
  normalizedWinRate * 0.25     // Historical win rate
);
```

---

## General Section

### 24. "Wikipedia: Community-edited encyclopedia"
**Status:** ✅ TRUE  
**External Fact:** Wikipedia is a community-edited encyclopedia.

### 25. "Encyclopedia Britannica: Expert-written, professionally edited"
**Status:** ✅ TRUE  
**External Fact:** Britannica uses expert authors and editorial review.

### 26. "Grokipedia: AI-generated content from xAI"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/content.ts` references xAI/Grok for content generation.

### 27. "Citizendium: Expert-guided encyclopedia"
**Status:** ✅ TRUE  
**External Fact:** Citizendium was founded by Wikipedia co-founder Larry Sanger with expert-guided editing.
**Code Reference:** `src/lib/services/content.ts` - `fetchCitizendiumContent()` function

### 28. "New World Encyclopedia: Encyclopedia with editorial oversight"
**Status:** ✅ TRUE  
**External Fact:** New World Encyclopedia has editorial oversight and review processes.
**Code Reference:** `src/lib/services/content.ts` - `fetchNewWorldContent()` function

### 29. "Votes are anonymous - we never show who voted for what"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/history/+page.svelte` only shows the current user's own votes.  
Leaderboard shows aggregate data, never individual votes.

### 30. "Anonymous session ID for non-signed-up users"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/supabaseClient.ts` lines 28-44
```typescript
export function getSessionId(): string {
  if (!browser) return 'server';
  let sessionId = localStorage.getItem('wikiarena_session_id');
  if (!sessionId) {
    sessionId = 'session_' + crypto.randomUUID();
    localStorage.setItem('wikiarena_session_id', sessionId);
  }
  return sessionId;
}
```

---

## Summary

| Section | Claims | Verified | Status |
|---------|--------|----------|--------|
| Rating System | 8 | 8 | ✅ All verified |
| Fairness | 5 | 5 | ✅ All verified |
| Quality Metrics | 10 | 10 | ✅ All verified |
| General | 7 | 7 | ✅ All verified |
| **Total** | **30** | **30** | ✅ **100% verified** |

All FAQ claims are accurate and implemented in the codebase.
