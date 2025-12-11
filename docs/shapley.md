# Shapley Values in WikiArena

## Overview

Shapley values, derived from cooperative game theory, provide a principled way to attribute the "value" or contribution of each knowledge source to a blended result. In WikiArena, this can be used to:

1. **Attribution**: Determine how much each source contributed to a synthesized article
2. **Fair weighting**: Automatically balance source influence based on actual contribution
3. **Quality assessment**: Identify which sources add the most value for different topics
4. **User preferences**: Learn which sources align best with individual user preferences

## Mathematical Foundation

The Shapley value for player *i* in a cooperative game is:

```
φᵢ(v) = Σ [|S|!(n-|S|-1)!/n!] × [v(S ∪ {i}) - v(S)]
        S⊆N\{i}
```

Where:
- `N` is the set of all players (knowledge sources)
- `S` is a subset of players not including `i`
- `v(S)` is the value function (coalition's worth)
- `n` is the total number of players

In plain terms: We calculate how much value source *i* adds, averaged over all possible orderings of sources.

## Application to WikiArena

### 1. Blender Attribution

When blending multiple sources, Shapley values can determine each source's contribution to the final article.

```typescript
// Conceptual implementation
interface ShapleyResult {
  sourceId: string;
  shapleyValue: number;  // Contribution score 0-1
  marginValue: number;   // Marginal contribution
}

async function calculateBlendShapley(
  topic: string,
  sources: Source[],
  evaluator: (content: string) => Promise<number>
): Promise<ShapleyResult[]> {
  const n = sources.length;
  const results: Record<string, number> = {};
  
  // Initialize
  sources.forEach(s => results[s.id] = 0);
  
  // For each permutation of sources
  for (const perm of permutations(sources)) {
    let currentCoalition: Source[] = [];
    let prevValue = 0;
    
    for (const source of perm) {
      currentCoalition.push(source);
      const blendedContent = await blend(topic, currentCoalition);
      const currentValue = await evaluator(blendedContent);
      
      // Marginal contribution
      const marginal = currentValue - prevValue;
      results[source.id] += marginal;
      prevValue = currentValue;
    }
  }
  
  // Average over all permutations
  const numPerms = factorial(n);
  return sources.map(s => ({
    sourceId: s.id,
    shapleyValue: results[s.id] / numPerms,
    marginValue: results[s.id] / numPerms
  }));
}
```

### 2. Value Functions

The key challenge is defining the value function `v(S)`. Options include:

#### A. Comprehensiveness Score
```typescript
function comprehensivenessValue(content: string): number {
  const factors = {
    length: Math.min(content.length / 5000, 1),
    sections: (content.match(/^##/gm) || []).length / 10,
    facts: countFactualClaims(content) / 50,
    citations: (content.match(/\[\d+\]/g) || []).length / 20
  };
  return Object.values(factors).reduce((a, b) => a + b) / 4;
}
```

#### B. LLM-Based Quality Score
```typescript
async function llmQualityValue(content: string): Promise<number> {
  const response = await grok.evaluate({
    prompt: `Rate this encyclopedia content 0-10 for:
      - Accuracy
      - Clarity  
      - Completeness
      - Objectivity
      Return only a single number.`,
    content
  });
  return parseFloat(response) / 10;
}
```

#### C. User Preference Score
```typescript
function userPreferenceValue(
  content: string, 
  userHistory: VoteRecord[]
): number {
  // Use user's past voting patterns to predict preference
  const styleVector = extractStyleFeatures(content);
  const userPrefs = calculateUserPreferences(userHistory);
  return cosineSimilarity(styleVector, userPrefs);
}
```

### 3. Efficient Approximation

Computing exact Shapley values requires `n!` evaluations. For practical use, we employ Monte Carlo approximation:

```typescript
async function approximateShapley(
  topic: string,
  sources: Source[],
  evaluator: (content: string) => Promise<number>,
  samples: number = 1000
): Promise<ShapleyResult[]> {
  const n = sources.length;
  const results: Record<string, number[]> = {};
  
  sources.forEach(s => results[s.id] = []);
  
  for (let i = 0; i < samples; i++) {
    // Random permutation
    const perm = shuffle([...sources]);
    let coalition: Source[] = [];
    let prevValue = 0;
    
    for (const source of perm) {
      coalition.push(source);
      const content = await blend(topic, coalition);
      const value = await evaluator(content);
      
      results[source.id].push(value - prevValue);
      prevValue = value;
    }
  }
  
  // Return mean and confidence interval
  return sources.map(s => ({
    sourceId: s.id,
    shapleyValue: mean(results[s.id]),
    marginValue: mean(results[s.id]),
    confidence: stdDev(results[s.id]) / Math.sqrt(samples)
  }));
}
```

## Integration Points

### 1. Blender UI Enhancement

Display Shapley-based attribution in the blender results:

```svelte
{#if shapleyResults}
  <div class="attribution-bar">
    {#each shapleyResults as result}
      <div 
        class="source-contribution"
        style="width: {result.shapleyValue * 100}%"
        title="{result.sourceName}: {(result.shapleyValue * 100).toFixed(1)}%"
      >
        <img src={getSourceLogo(result.sourceSlug)} alt="" />
      </div>
    {/each}
  </div>
{/if}
```

### 2. Automatic Weight Optimization

Use Shapley values to suggest optimal blending weights:

```typescript
async function optimizeWeights(
  topic: string,
  sources: Source[],
  targetMetric: 'quality' | 'comprehensiveness' | 'user_preference'
): Promise<Record<string, number>> {
  const shapley = await approximateShapley(topic, sources, evaluators[targetMetric]);
  
  // Normalize to weights
  const total = shapley.reduce((sum, s) => sum + Math.max(0, s.shapleyValue), 0);
  
  const weights: Record<string, number> = {};
  shapley.forEach(s => {
    weights[s.sourceId] = Math.max(0, s.shapleyValue) / total;
  });
  
  return weights;
}
```

### 3. Source Quality Tracking

Track Shapley values over time to build source quality profiles:

```sql
CREATE TABLE shapley_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id),
  source_id UUID REFERENCES sources(id),
  shapley_value DECIMAL(5,4),
  value_function VARCHAR(50),
  sample_size INTEGER,
  confidence DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for aggregation queries
CREATE INDEX idx_shapley_source ON shapley_scores(source_id, value_function);

-- View for average Shapley by source
CREATE VIEW source_shapley_avg AS
SELECT 
  source_id,
  value_function,
  AVG(shapley_value) as avg_shapley,
  STDDEV(shapley_value) as shapley_stddev,
  COUNT(*) as sample_count
FROM shapley_scores
GROUP BY source_id, value_function;
```

### 4. Topic-Specific Source Recommendations

Recommend sources based on their Shapley contribution for similar topics:

```typescript
async function recommendSources(
  topic: string,
  availableSources: Source[],
  topK: number = 3
): Promise<Source[]> {
  // Find similar topics
  const similarTopics = await findSimilarTopics(topic, 20);
  
  // Get average Shapley values for each source on similar topics
  const scores = await db.query(`
    SELECT 
      source_id,
      AVG(shapley_value) as avg_contribution
    FROM shapley_scores
    WHERE topic_id IN ($1)
    AND value_function = 'quality'
    GROUP BY source_id
    ORDER BY avg_contribution DESC
    LIMIT $2
  `, [similarTopics.map(t => t.id), topK]);
  
  return scores.map(s => 
    availableSources.find(src => src.id === s.source_id)
  ).filter(Boolean);
}
```

## User-Facing Features

### 1. Contribution Breakdown

After blending, show users how much each source contributed:

```
┌─────────────────────────────────────────────┐
│ Source Contributions                         │
├─────────────────────────────────────────────┤
│ Wikipedia      ████████████░░░░░░ 45.2%     │
│ Grokipedia     ██████████░░░░░░░░ 38.7%     │
│ Britannica     ████░░░░░░░░░░░░░░ 16.1%     │
└─────────────────────────────────────────────┘
```

### 2. Personal Source Affinity

Show users which sources best match their preferences:

```
Your Source Affinity (based on voting history):
1. Wikipedia     - 72% match
2. Britannica    - 65% match  
3. Grokipedia    - 58% match
```

### 3. Topic-Source Fit

Indicate which sources excel for the current topic:

```
Best sources for "Quantum Computing":
⭐ Grokipedia    - Strong for technical topics
⭐ Wikipedia     - Good general coverage
○  Britannica    - Limited coverage
```

## Implementation Phases

### Phase 1: Basic Attribution (MVP)
- [ ] Implement Monte Carlo Shapley approximation
- [ ] Add comprehensiveness value function
- [ ] Display contribution bar in blender results

### Phase 2: Quality Integration
- [ ] Integrate LLM-based quality scoring
- [ ] Store Shapley scores in database
- [ ] Build source quality profiles

### Phase 3: Personalization
- [ ] Implement user preference value function
- [ ] Show personal source affinity
- [ ] Auto-optimize weights based on preferences

### Phase 4: Advanced Features
- [ ] Topic-specific recommendations
- [ ] Real-time contribution updates
- [ ] A/B testing for value functions

## Performance Considerations

1. **Caching**: Cache Shapley values for popular topics
2. **Batching**: Compute Shapley for multiple topics in parallel
3. **Approximation quality**: 100-500 samples typically sufficient
4. **Lazy computation**: Only compute when user requests attribution

## References

- Shapley, L.S. (1953). "A Value for n-Person Games"
- Lundberg & Lee (2017). "A Unified Approach to Interpreting Model Predictions" (SHAP)
- Ghorbani & Zou (2019). "Data Shapley: Equitable Valuation of Data for Machine Learning"
