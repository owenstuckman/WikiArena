# Quality Metrics & Categories

This document explains how WikiArena calculates quality scores for knowledge sources.

## Overview

WikiArena uses two complementary systems:
1. **User Voting (Glicko-2)** - Crowdsourced preferences via blind comparisons
2. **Automated Quality Assessment** - Algorithmic analysis of content characteristics

## Quality Metrics

Each piece of content is analyzed across 5 dimensions:

### 1. Accuracy (30% weight)

**What it measures:** How factually reliable the content is likely to be.

**How it's calculated:**
- All sources start with the same base score: 70%
- Bonus for citation presence: up to +15% for well-cited content
- Bonus for structure: up to +10% for content with good heading organization
- Maximum possible: 95%

**Formula:**
```
baseAccuracy = 0.70
citationBonus = citations × 0.15    // 0 to 0.15
structureBonus = min(0.1, headings/10 × 0.1)  // 0 to 0.10
accuracy = baseAccuracy + citationBonus + structureBonus
```

**Why this weight:** Accuracy is the most critical factor for knowledge sources. Misinformation is worse than poor formatting.

**Why same base for all sources:** All sources are evaluated purely on content characteristics, not brand reputation. This ensures fairness — let the content speak for itself.

---

### 2. Depth/Comprehensiveness (25% weight)

**What it measures:** How thoroughly the topic is covered.

**How it's calculated:**
- Content length factor (60%): `min(1, wordCount / 2000)`
  - 2000+ words = full score
  - Shorter content scores proportionally less
- Structure factor (40%): `min(1, (headings + paragraphs) / 15)`
  - Well-organized content with sections scores higher

**Formula:**
```
depth = (lengthScore × 0.6) + (structureScore × 0.4)
```

**Why this weight:** Comprehensive coverage is valuable, but overly long content isn't always better.

---

### 3. Readability (20% weight)

**What it measures:** How easy the content is to understand.

**How it's calculated:**
- Based on average words per sentence
- Optimal range: 15-20 words/sentence
- Penalty for deviating from optimal (both too long AND too short)

**Formula:**
```
deviation = abs(avgWordsPerSentence - 17.5)
readability = max(0, 1 - deviation / 25)
```

**Score interpretation:**
- 15-20 words/sentence → 90-100%
- 10 or 25 words/sentence → ~70%
- 5 or 30 words/sentence → ~50%
- <5 or >35 words/sentence → below 30%

**Why this weight:** Readable content serves more users, but shouldn't outweigh accuracy.

---

### 4. Objectivity (15% weight)

**What it measures:** How neutral and unbiased the content appears.

**How it's calculated:**
- Scans for opinion/bias indicators:
  - Superlatives: "best", "worst", "amazing", "terrible"
  - Certainty markers: "obviously", "clearly", "everyone knows"
- Penalizes based on frequency relative to content length

**Formula:**
```
opinionDensity = opinionWords / sentenceCount
objectivity = max(0.5, 1 - opinionDensity × 2)
```

**Why this weight:** Encyclopedic content should be neutral, but some subjectivity is acceptable in certain contexts.

**Limitations:** Can't detect subtle bias, framing effects, or lies of omission.

---

### 5. Citations (10% weight)

**What it measures:** How well-sourced the claims are.

**How it's calculated:**
- Counts markdown links `[text](url)`
- Compares to expected links based on content length
- Expected: ~1 link per 200 words

**Formula:**
```
expectedLinks = wordCount / 200
citations = min(1, actualLinks / expectedLinks)
```

**Why this weight:** Citations indicate verifiability, but link quantity doesn't guarantee quality.

---

## Overall Quality Score

The weighted combination of all metrics:

```
overallScore = 
  accuracy × 0.30 +
  depth × 0.25 +
  readability × 0.20 +
  objectivity × 0.15 +
  citations × 0.10
```

### Quality Tiers

| Score | Tier | Color |
|-------|------|-------|
| 90%+ | Excellent | Emerald |
| 75-89% | Good | Green |
| 60-74% | Fair | Yellow |
| 40-59% | Basic | Orange |
| <40% | Limited | Red |

---

## Shapley Values

### What Are Shapley Values?

Shapley values come from cooperative game theory. They answer: "How much does each player contribute to the team's success?"

In WikiArena, we ask: "How much unique value does each source add to the combined knowledge?"

### How They're Calculated

1. Consider all possible "coalitions" (combinations of sources)
2. For each source, calculate its marginal contribution to each coalition
3. Average across all coalitions, weighted by coalition size

**Simplified example with 2 sources:**
- Wikipedia alone: 70% quality
- Britannica alone: 75% quality
- Both together: 82% quality

Marginal contributions:
- Wikipedia adds to empty set: 70%
- Wikipedia adds to {Britannica}: 82% - 75% = 7%
- Average: (70% + 7%) / 2 = 38.5%

- Britannica adds to empty set: 75%
- Britannica adds to {Wikipedia}: 82% - 70% = 12%
- Average: (75% + 12%) / 2 = 43.5%

**Interpretation:**
- Positive Shapley value → Source adds unique information
- Higher value → More irreplaceable contribution
- Similar values → Sources are complementary
- One high, one low → One source dominates

### Coalition Value

When sources are combined, we calculate synergy:
- Base: weighted average of individual scores
- Bonus: small synergy for combining sources (+5% per additional source)
- Uniqueness bonus: sources with different strengths add more value

---

## Expected Value

Predicts how well a source should perform based on all available data.

### Components

1. **Local Quality (40%)** - The algorithmic quality score for this specific content
2. **Global Rating (35%)** - The source's Glicko-2 rating from all user votes
3. **Historical Win Rate (25%)** - How often this source wins comparisons

### Formula

```
normalizedRating = (glickoRating - 1200) / 600  // Maps ~1200-1800 to 0-1
expectedValue = 
  qualityScore × 0.40 +
  normalizedRating × 0.35 +
  winRate × 0.25
```

### Use Cases

- **Expected > Actual Quality**: Source has good reputation but this article is weak
- **Actual > Expected**: This article is better than the source's average
- **High Expected, Low Votes**: Users may be prioritizing different factors

---

## Category-Based Ratings

Users can vote on specific quality dimensions. Each category maintains its own independent Glicko-2 rating system.

### How Category Ratings Work

| Category | User Prompt | What Users Evaluate |
|----------|-------------|---------------------|
| **Overall** | "Which is better overall?" | General preference, holistic quality |
| **Accuracy** | "Which seems more factually correct?" | Trustworthiness, correctness, verifiability |
| **Readability** | "Which is easier to understand?" | Clarity, flow, accessibility |
| **Comprehensiveness** | "Which covers the topic more thoroughly?" | Depth, breadth, completeness |
| **Objectivity** | "Which is more neutral/unbiased?" | Balance, lack of opinion, multiple perspectives |

### Category Rating Algorithm

Each source maintains **5 separate Glicko-2 ratings**:

```
Source: Wikipedia
├── Overall:          1580 (RD: 45)
├── Accuracy:         1620 (RD: 52)
├── Readability:      1490 (RD: 48)
├── Comprehensiveness: 1650 (RD: 41)
└── Objectivity:      1540 (RD: 55)
```

When a user votes in a specific category:
1. Only that category's ratings update
2. Other categories remain unchanged
3. Each category converges independently

### Why Separate Categories?

Different sources excel in different areas:

- **Wikipedia** often scores high on **comprehensiveness** (extensive coverage)
- **Britannica** often scores high on **accuracy** (expert verification)
- **Grokipedia** may score high on **readability** (AI-optimized prose)

Separate ratings reveal these strengths:

```
Example Leaderboard by Category:

ACCURACY:
1. Britannica    1620
2. Wikipedia     1580
3. Grokipedia    1520

COMPREHENSIVENESS:
1. Wikipedia     1650
2. Grokipedia    1540
3. Britannica    1490

READABILITY:
1. Grokipedia    1590
2. Britannica    1560
3. Wikipedia     1510
```

### Category Selection During Voting

In the Arena, users can optionally specify which category they're judging:

1. **Default (Overall)**: Most comparisons use overall preference
2. **Category-specific**: Users can click "Rate by category" to judge a specific dimension
3. **Multi-category**: Advanced users can rate all 5 categories per comparison

### Database Schema for Categories

```sql
-- Each source has ratings per category
CREATE TABLE source_category_ratings (
  source_id UUID REFERENCES sources(id),
  category rating_category,
  rating FLOAT DEFAULT 1500,
  rating_deviation FLOAT DEFAULT 350,
  volatility FLOAT DEFAULT 0.06,
  PRIMARY KEY (source_id, category)
);

-- Votes can specify category
ALTER TABLE votes ADD COLUMN category rating_category DEFAULT 'overall';
```

### Aggregating Category Scores

The overall rating is **not** an average of categories. It's independently calculated from overall votes.

However, the UI may show a "composite score" for display purposes:

```
Composite = (
  Overall × 0.40 +
  Accuracy × 0.25 +
  Comprehensiveness × 0.20 +
  Readability × 0.10 +
  Objectivity × 0.05
)
```

This composite is for display only—actual rankings use the independent Glicko-2 ratings.

---

## Limitations & Future Improvements

### Current Limitations

1. **Accuracy is estimated from content signals** - We use citations and structure as proxies, not actual fact-checking
2. **No semantic analysis** - We count words, not meaning
3. **English-centric** - Readability formulas tuned for English
4. **Can't detect subtle issues** - Framing, omission, outdated info
5. **Link count ≠ link quality** - We count citations but don't verify them

### Planned Improvements

1. **AI-powered fact-checking** - Cross-reference claims against trusted sources
2. **Semantic similarity** - Detect redundancy between sources
3. **Freshness scoring** - Penalize outdated information
4. **Domain-specific models** - Different criteria for science vs. history vs. pop culture
5. **Citation quality analysis** - Verify links point to authoritative sources

---

## Technical Implementation

See `/src/lib/services/shapley.ts` for the full implementation.

Key functions:
- `estimateQualityMetrics()` - Analyzes content
- `calculateOverallScore()` - Weighted combination
- `calculateShapleyValues()` - Fair attribution
- `calculateExpectedValues()` - Prediction based on history
- `assessQuality()` - Full assessment pipeline
