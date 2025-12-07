# Knowledge Arena - Development Roadmap

## Overview

This document outlines the sprint-by-sprint development plan for Knowledge Arena, including technical tasks, acceptance criteria, and dependencies.

---

## Sprint 0: Project Setup (Week 0.5)

### Goals
- Initialize project structure
- Set up development environment
- Configure Supabase project

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Initialize SvelteKit project with TypeScript | P0 | 1h | Dev |
| Set up TailwindCSS + custom theme | P0 | 2h | Dev |
| Create Supabase project | P0 | 0.5h | Dev |
| Configure Supabase CLI for local dev | P0 | 1h | Dev |
| Set up environment variables | P0 | 0.5h | Dev |
| Initialize Git repo + CI/CD pipeline | P0 | 1h | Dev |
| Create initial database migrations | P0 | 2h | Dev |
| Seed database with initial sources | P1 | 1h | Dev |

### Deliverables
- [ ] SvelteKit project running locally
- [ ] Supabase project created with schema
- [ ] GitHub repo with basic CI
- [ ] README with setup instructions

### Commands

```bash
# Initialize SvelteKit
npm create svelte@latest knowledge-arena
cd knowledge-arena
npm install

# Add dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Supabase CLI
npm install -D supabase
npx supabase init
npx supabase link --project-ref <ref>
npx supabase db push
```

---

## Sprint 1: Core Arena MVP (Week 1-2)

### Goals
- Implement basic arena comparison UI
- Integrate Wikipedia API
- Build voting mechanism

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Create Arena page layout | P0 | 4h | Dev |
| Build ComparisonCard component | P0 | 4h | Dev |
| Build VoteButtons component | P0 | 2h | Dev |
| Implement Wikipedia API service | P0 | 4h | Dev |
| Create match store + state management | P0 | 3h | Dev |
| Build create-match Edge Function | P0 | 4h | Dev |
| Build submit-vote Edge Function | P0 | 4h | Dev |
| Implement reveal animation | P1 | 3h | Dev |
| Add loading states + error handling | P1 | 2h | Dev |
| Basic mobile responsiveness | P1 | 2h | Dev |

### Acceptance Criteria
- [ ] User can view two anonymous source responses side-by-side
- [ ] User can vote A/B/Tie/Both Bad
- [ ] After voting, sources are revealed
- [ ] Match and vote records are stored in database
- [ ] Wikipedia API successfully returns content

### Technical Notes
- Start with Wikipedia only (Grok added Sprint 2)
- Use local topic list initially (dynamic topics Sprint 3)
- Anonymous sessions via sessionStorage UUID

---

## Sprint 2: Glicko-2 + Leaderboard (Week 2-3)

### Goals
- Implement full Glicko-2 rating system
- Build global leaderboard UI
- Add Grokipedia source

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Implement Glicko-2 algorithm in TypeScript | P0 | 6h | Dev |
| Unit tests for Glicko-2 calculations | P0 | 3h | Dev |
| Update submit-vote to use Glicko-2 | P0 | 2h | Dev |
| Create rating_history recording | P0 | 2h | Dev |
| Build LeaderboardTable component | P0 | 4h | Dev |
| Build RatingBadge component | P1 | 2h | Dev |
| Build TrendIndicator component | P1 | 2h | Dev |
| Implement xAI Grok API service | P0 | 4h | Dev |
| Add Grokipedia as second source | P0 | 2h | Dev |
| Realtime leaderboard updates | P2 | 3h | Dev |

### Acceptance Criteria
- [ ] Ratings update correctly after each vote
- [ ] Leaderboard displays all sources ranked by rating
- [ ] Rating confidence intervals shown
- [ ] Win/loss counts accurate
- [ ] Grok API returns meaningful content
- [ ] Both sources available in arena rotation

### Glicko-2 Test Cases
```typescript
// Test 1: New source beats established source
// Expected: Large rating gain for winner

// Test 2: Even match (similar ratings)
// Expected: Moderate rating changes

// Test 3: Tie between mismatched ratings
// Expected: Lower-rated gains, higher-rated loses slightly

// Test 4: Rating deviation decreases over time
// Expected: RD trends toward minimum after many matches
```

---

## Sprint 3: User Accounts + Preferences (Week 4-5)

### Goals
- Implement Supabase Auth
- Track personal voting history
- Build preference profiles

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Integrate Supabase Auth | P0 | 4h | Dev |
| Build Sign Up / Sign In UI | P0 | 4h | Dev |
| Create user profile page | P0 | 4h | Dev |
| Implement vote history view | P0 | 3h | Dev |
| Build preference aggregation logic | P0 | 4h | Dev |
| Create UserPreference store | P0 | 2h | Dev |
| Build preference visualization | P1 | 4h | Dev |
| Add "consensus alignment" score | P2 | 3h | Dev |
| Email verification flow | P2 | 2h | Dev |
| Social auth (Google, GitHub) | P3 | 2h | Dev |

### Acceptance Criteria
- [ ] Users can create accounts
- [ ] Logged-in votes linked to user_id
- [ ] Users can view their vote history
- [ ] Personal source rankings calculated from votes
- [ ] Preferences update after each vote

### Data Model

```typescript
interface UserPreference {
  sourceId: string;
  wins: number;
  losses: number;
  ties: number;
  preferenceScore: number; // Calculated: (wins - losses) / total
}
```

---

## Sprint 4: Knowledge Blender (Week 6-7)

### Goals
- Build Grok-powered blending engine
- Create blend configuration UI
- Implement custom formatting prompts

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Design Blend UI/UX | P0 | 2h | Dev |
| Build BlendForm component | P0 | 4h | Dev |
| Build WeightSliders component | P0 | 3h | Dev |
| Create blend Edge Function | P0 | 6h | Dev |
| Implement auto-weights from preferences | P0 | 3h | Dev |
| Build BlendResult component | P0 | 3h | Dev |
| Add custom format prompt input | P1 | 2h | Dev |
| Create blend_configs CRUD | P1 | 4h | Dev |
| Blend preset templates | P2 | 2h | Dev |
| Blend history + saving | P2 | 3h | Dev |

### Acceptance Criteria
- [ ] User can enter a query and get blended response
- [ ] Weight sliders control source influence
- [ ] Auto-weights derived from user preferences
- [ ] Custom format prompts applied to output
- [ ] Users can save/load blend configurations

### Blend Algorithm

```typescript
// Pseudo-code for blending logic
async function blend(query: string, config: BlendConfig) {
  // 1. Fetch from all sources in parallel
  const responses = await Promise.all(
    sources.map(s => fetchContent(s, query))
  );

  // 2. Construct Grok prompt with weights
  const systemPrompt = buildBlendPrompt(config.weights, config.formatPrompt);

  // 3. Call Grok to synthesize
  const blended = await callGrok(systemPrompt, responses);

  // 4. Return with source attribution
  return { blended, sources: responses };
}
```

---

## Sprint 5: Truth Seeker (Week 8-9)

### Goals
- Implement claim extraction
- Build cross-source verification
- Create accuracy visualization

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Design Truth Seeker UI | P0 | 2h | Dev |
| Implement claim extraction (Grok) | P0 | 6h | Dev |
| Build cross-reference matching | P0 | 6h | Dev |
| Create confidence scoring | P0 | 4h | Dev |
| Build TruthResult component | P0 | 4h | Dev |
| Highlight contradictions UI | P1 | 4h | Dev |
| Link to primary sources | P2 | 3h | Dev |
| Aggregate accuracy tracking | P2 | 4h | Dev |

### Acceptance Criteria
- [ ] Claims extracted from each source
- [ ] Claims matched across sources
- [ ] Confidence levels displayed (all agree, most agree, disputed)
- [ ] Contradictions highlighted with both versions
- [ ] Per-source accuracy scores tracked over time

### Claim Confidence Levels

```typescript
type ClaimConfidence = 
  | 'high'    // All sources agree
  | 'medium'  // Majority agree
  | 'low'     // Only one source
  | 'disputed'; // Sources contradict

interface ExtractedClaim {
  text: string;
  sources: string[];
  confidence: ClaimConfidence;
  contradiction?: {
    sourceA: string;
    claimA: string;
    sourceB: string;
    claimB: string;
  };
}
```

---

## Sprint 6: Polish + Scale (Week 10-12)

### Goals
- Performance optimization
- Additional knowledge sources
- Category-based ratings

### Tasks

| Task | Priority | Est. Hours | Owner |
|------|----------|------------|-------|
| Performance audit + optimization | P0 | 8h | Dev |
| Add caching layer | P0 | 4h | Dev |
| Implement rate limiting | P0 | 3h | Dev |
| Add Britannica API | P1 | 4h | Dev |
| Add Perplexity API | P1 | 4h | Dev |
| Category-based rating system | P1 | 6h | Dev |
| Advanced leaderboard filters | P1 | 4h | Dev |
| SEO optimization | P2 | 3h | Dev |
| Analytics integration | P2 | 2h | Dev |
| Load testing | P2 | 4h | Dev |

### Performance Targets
- Time to First Byte: < 200ms
- Largest Contentful Paint: < 1.5s
- First Input Delay: < 100ms
- Arena load time: < 2s with content

---

## Future Enhancements (Backlog)

### V2 Features
- [ ] Topic suggestions / voting
- [ ] Community-submitted topics
- [ ] Source comments / discussion
- [ ] Expert verification badges
- [ ] API for third-party integration
- [ ] Mobile apps (iOS/Android)
- [ ] Browser extension

### Gamification
- [ ] Daily streaks
- [ ] Achievement badges
- [ ] User levels based on votes
- [ ] Prediction accuracy scores

### Social Features
- [ ] Share comparison results
- [ ] Challenge friends to vote
- [ ] Source following
- [ ] Personalized recommendations

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API rate limits | High | Medium | Implement caching, rate limiting |
| Grok API downtime | High | Low | Fallback to cached, show status |
| Vote manipulation | Medium | Medium | Session limits, anomaly detection |
| Copyright concerns | High | Low | Legal review, fair use guidelines |
| Scale issues | Medium | Medium | Load testing, horizontal scaling |
| Low user engagement | High | Medium | Gamification, social features |

---

## Success Metrics

### Phase 1 (MVP)
- 100 daily active users
- 500+ votes per day
- < 5% error rate

### Phase 2 (Growth)
- 1,000 daily active users
- 5,000+ votes per day
- 20% user return rate

### Phase 3 (Scale)
- 10,000 daily active users
- 50,000+ votes per day
- 5+ knowledge sources ranked
