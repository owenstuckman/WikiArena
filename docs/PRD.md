# Knowledge Arena - Product Requirements Document

## Executive Summary

Knowledge Arena is a crowdsourced evaluation platform that allows users to compare and rate knowledge sources (Wikipedia, Grokipedia, and others) through blind side-by-side comparisons. Using the Glicko-2 rating system, the platform generates global leaderboards showing which knowledge sources provide the most preferred information presentation, and tracks individual user preferences to enable personalized knowledge blending.

## Problem Statement

Users have multiple sources of encyclopedic knowledge (Wikipedia, Grokipedia, AI-generated summaries), but no objective way to determine which source best serves their needs. Different users may prefer different styles of information presentation, and there's no system to:

1. Crowdsource preferences at scale
2. Track individual user preferences
3. Blend sources together based on preferences
4. Verify factual accuracy across sources

## Product Vision

"**The Arena for Knowledge**" - A platform where knowledge sources compete head-to-head, users vote with their preferences, and everyone benefits from aggregated wisdom about which sources excel.

---

## Core Features

### 1. Arena Comparisons (MVP)

**Description:** Users are presented with the same topic/query answered by two different knowledge sources (blind). They select which response they prefer.

**User Flow:**
1. User visits Arena
2. System selects a random topic
3. Two knowledge sources respond (anonymized as Source A / Source B)
4. User reads both responses
5. User votes: "A is better", "B is better", "Tie", or "Both Bad"
6. Sources are revealed with updated ratings
7. User can continue or view leaderboard

**Technical Requirements:**
- Fetch content from multiple knowledge APIs (Wikipedia, Grok/xAI API)
- Randomize source ordering to prevent position bias
- Store vote with metadata (topic, sources, user, timestamp)
- Update Glicko-2 ratings after each vote

### 2. Global Leaderboard

**Description:** Real-time ranking of all knowledge sources based on Glicko-2 ratings.

**Display Elements:**
- Rank position
- Source name & logo
- Glicko-2 rating (with confidence interval)
- Win rate percentage
- Total matches
- Rating trend (↑↓→)

**Features:**
- Filter by topic category
- Filter by time period
- View head-to-head statistics
- Historical rating charts

### 3. Personal Preferences

**Description:** Track individual user voting patterns to build a personal preference profile.

**Profile Elements:**
- User's personal source rankings
- Preference breakdown by category
- Voting history
- Alignment score (how much user agrees with global consensus)

### 4. Knowledge Blender (Powered by Grok)

**Description:** Generate custom responses that blend multiple sources according to user preferences.

**User Flow:**
1. User enters a query
2. System fetches responses from all sources
3. Grok analyzes and blends based on user's preference weights
4. User receives synthesized response with source attribution
5. Optional: User provides custom formatting prompt

**Configuration Options:**
- Blend weights per source (auto from preferences or manual)
- Output format (concise, detailed, academic, casual)
- Custom system prompt for formatting
- Source citation style

### 5. Truth Seeker (Accuracy Verification)

**Description:** Cross-reference claims across sources to identify factual consistency and flag potential inaccuracies.

**Features:**
- Highlight claims present in all sources (high confidence)
- Flag claims only in one source (needs verification)
- Show contradictions between sources
- Link to primary sources when available
- Aggregate accuracy scores per source over time

---

## Technical Architecture

### Frontend: SvelteKit

- **Why Svelte:** Reactive UI without virtual DOM overhead, excellent DX, built-in animations
- **Routing:** File-based routing via SvelteKit
- **State:** Svelte stores for client state, Supabase realtime for server state

### Backend: Supabase

- **Database:** PostgreSQL for all persistent data
- **Auth:** Supabase Auth (anonymous sessions + optional sign-up)
- **Edge Functions:** Deno-based functions for API calls and rating calculations
- **Realtime:** Live leaderboard updates via Supabase Realtime

### Rating System: Glicko-2

- More accurate than Elo for systems with varying activity levels
- Accounts for rating volatility
- Better handling of returning competitors
- Parameters: τ (tau) = 0.5, initial rating = 1500, RD = 350

### External APIs

- **Wikipedia API:** MediaWiki REST API for article content
- **xAI Grok API:** For Grokipedia content and blending engine
- **Future:** Britannica, Perplexity, etc.

---

## Data Models

### Core Entities

```
Source
├── id (UUID)
├── name (string)
├── slug (string)
├── api_config (jsonb)
├── rating (float) [default: 1500]
├── rating_deviation (float) [default: 350]
├── volatility (float) [default: 0.06]
├── created_at (timestamp)
└── updated_at (timestamp)

Match
├── id (UUID)
├── topic (string)
├── source_a_id (FK → Source)
├── source_b_id (FK → Source)
├── source_a_content (text)
├── source_b_content (text)
├── created_at (timestamp)
└── expires_at (timestamp)

Vote
├── id (UUID)
├── match_id (FK → Match)
├── user_id (UUID, nullable for anon)
├── session_id (UUID)
├── winner ('a' | 'b' | 'tie' | 'both_bad')
├── rating_change_a (float)
├── rating_change_b (float)
├── created_at (timestamp)
└── metadata (jsonb)

UserPreference
├── id (UUID)
├── user_id (UUID)
├── source_id (FK → Source)
├── preference_score (float)
├── vote_count (int)
├── category (string, nullable)
└── updated_at (timestamp)

BlendConfig
├── id (UUID)
├── user_id (UUID)
├── name (string)
├── weights (jsonb)
├── format_prompt (text)
├── is_default (boolean)
└── created_at (timestamp)
```

---

## Milestones & Roadmap

### Phase 1: MVP (Weeks 1-3)
- [ ] Basic arena UI with side-by-side comparison
- [ ] Wikipedia + Grokipedia integration
- [ ] Glicko-2 rating system
- [ ] Simple global leaderboard
- [ ] Anonymous voting (session-based)

### Phase 2: User Accounts (Weeks 4-5)
- [ ] Supabase Auth integration
- [ ] Personal voting history
- [ ] Personal preference tracking
- [ ] User dashboard

### Phase 3: Knowledge Blender (Weeks 6-7)
- [ ] Grok API integration for blending
- [ ] Custom blend configurations
- [ ] Format prompt system
- [ ] Blend history

### Phase 4: Truth Seeker (Weeks 8-9)
- [ ] Claim extraction
- [ ] Cross-source verification
- [ ] Accuracy scoring
- [ ] Contradiction highlighting

### Phase 5: Polish & Scale (Weeks 10-12)
- [ ] Additional knowledge sources
- [ ] Category-based ratings
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Public API

---

## Success Metrics

### Engagement
- Daily Active Users (DAU)
- Votes per session
- Return rate
- Time on site

### Quality
- Vote completion rate
- Tie rate (indicates source quality parity)
- Rating stability (convergence indicates accuracy)

### Growth
- Total votes cast
- Unique topics compared
- User sign-up conversion

---

## Open Questions

1. **Content caching:** How long to cache fetched content? Balance freshness vs. API costs
2. **Topic selection:** Random vs. trending vs. user-suggested?
3. **Abuse prevention:** How to handle vote manipulation?
4. **Source fairness:** How to handle sources with different content coverage?
5. **Legal:** Any copyright concerns with displaying source content?

---

## Appendix

### Glicko-2 Algorithm Reference
See: http://www.glicko.net/glicko/glicko2.pdf

### API Documentation Links
- Wikipedia: https://www.mediawiki.org/wiki/API:Main_page
- xAI Grok: https://docs.x.ai/
