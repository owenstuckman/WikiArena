import { writable, derived, get } from 'svelte/store';
import { getSupabase, getSessionId } from '$lib/services/supabase';
import { calculateMatchOutcome, createRating } from '$lib/services/glicko2';
import type { ArenaMatch, VoteResult, Source, VoteWinner } from '$lib/types/database';

// Match phases
export type MatchPhase = 'idle' | 'loading' | 'comparing' | 'voting' | 'revealing' | 'complete';

interface MatchState {
  currentMatch: ArenaMatch | null;
  phase: MatchPhase;
  error: string | null;
  voteResult: VoteResult | null;
  voteStartTime: number | null;
  matchCount: number;
}

const initialState: MatchState = {
  currentMatch: null,
  phase: 'idle',
  error: null,
  voteResult: null,
  voteStartTime: null,
  matchCount: 0,
};

function createMatchStore() {
  const { subscribe, set, update } = writable<MatchState>(initialState);

  return {
    subscribe,

    /**
     * Load a new match from the server
     */
    async loadMatch() {
      update(s => ({ ...s, phase: 'loading', error: null, voteResult: null }));

      try {
        const supabase = getSupabase();

        // Get active sources
        const { data: sources, error: sourcesError } = await supabase
          .from('sources')
          .select('*')
          .eq('is_active', true);

        if (sourcesError || !sources || sources.length < 2) {
          throw new Error('Not enough active sources available');
        }

        // Get a random topic (prefer less used ones)
        const { data: topics, error: topicsError } = await supabase
          .from('topics')
          .select('*')
          .eq('is_active', true)
          .order('usage_count', { ascending: true })
          .limit(10);

        if (topicsError || !topics || topics.length === 0) {
          throw new Error('No topics available');
        }

        // Select random topic from least-used
        const topic = topics[Math.floor(Math.random() * topics.length)];

        // Select two random sources
        const shuffled = [...sources].sort(() => Math.random() - 0.5);
        const [sourceA, sourceB] = shuffled.slice(0, 2);

        // Randomize display position
        const sourceAPosition = Math.random() > 0.5 ? 1 : 2;

        // Fetch content from both sources (this would call external APIs)
        // For now, we'll use placeholder content - real implementation would call Wikipedia/Grok APIs
        const [contentA, contentB] = await Promise.all([
          fetchSourceContent(sourceA, topic.title),
          fetchSourceContent(sourceB, topic.title),
        ]);

        // Create match record
        const { data: match, error: matchError } = await supabase
          .from('matches')
          .insert({
            topic_id: topic.id,
            topic_query: topic.title,
            source_a_id: sourceA.id,
            source_b_id: sourceB.id,
            source_a_content: contentA,
            source_b_content: contentB,
            source_a_position: sourceAPosition,
            content_fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (matchError || !match) {
          throw new Error('Failed to create match');
        }

        // Increment topic usage
        await supabase.rpc('increment_topic_usage', { p_topic_id: topic.id });

        // Construct arena match (content in display order)
        const arenaMatch: ArenaMatch = {
          id: match.id,
          topic: topic.title,
          leftContent: sourceAPosition === 1 ? contentA : contentB,
          rightContent: sourceAPosition === 1 ? contentB : contentA,
          sourceAPosition,
          // Hidden until reveal
          sourceA,
          sourceB,
        };

        update(s => ({
          ...s,
          currentMatch: arenaMatch,
          phase: 'comparing',
          voteStartTime: Date.now(),
        }));

      } catch (error) {
        update(s => ({
          ...s,
          phase: 'idle',
          error: error instanceof Error ? error.message : 'Failed to load match',
        }));
      }
    },

    /**
     * Submit a vote for the current match
     */
    async submitVote(winner: VoteWinner) {
      const state = get({ subscribe });
      if (!state.currentMatch || state.phase !== 'comparing') return;

      update(s => ({ ...s, phase: 'voting' }));

      try {
        const supabase = getSupabase();
        const sessionId = getSessionId();
        const match = state.currentMatch;

        // Calculate time to vote
        const timeToVote = state.voteStartTime 
          ? Date.now() - state.voteStartTime 
          : null;

        // Get current source ratings
        const { data: sourceAData } = await supabase
          .from('sources')
          .select('*')
          .eq('id', match.sourceA!.id)
          .single();

        const { data: sourceBData } = await supabase
          .from('sources')
          .select('*')
          .eq('id', match.sourceB!.id)
          .single();

        if (!sourceAData || !sourceBData) {
          throw new Error('Failed to fetch source data');
        }

        // Convert winner to actual winner (accounting for position)
        let actualWinner: 'a' | 'b' | 'tie' | 'both_bad' = winner;
        if (winner === 'a' || winner === 'b') {
          // 'a' means left side, 'b' means right side
          // Source A is at position sourceAPosition
          if (match.sourceAPosition === 1) {
            // Source A is on left
            actualWinner = winner; // a=left=sourceA, b=right=sourceB
          } else {
            // Source A is on right
            actualWinner = winner === 'a' ? 'b' : 'a'; // Swap
          }
        }

        // Calculate new ratings
        const ratingA = createRating(
          sourceAData.rating,
          sourceAData.rating_deviation,
          sourceAData.volatility
        );
        const ratingB = createRating(
          sourceBData.rating,
          sourceBData.rating_deviation,
          sourceBData.volatility
        );

        let glickoWinner: 'a' | 'b' | 'tie' = 
          actualWinner === 'both_bad' ? 'tie' : actualWinner;

        const { newRatingA, newRatingB, changeA, changeB } = 
          calculateMatchOutcome(ratingA, ratingB, glickoWinner);

        // Record vote
        const { data: vote, error: voteError } = await supabase
          .from('votes')
          .insert({
            match_id: match.id,
            session_id: sessionId,
            winner: actualWinner,
            source_a_rating_before: sourceAData.rating,
            source_a_rating_after: newRatingA.mu,
            source_b_rating_before: sourceBData.rating,
            source_b_rating_after: newRatingB.mu,
            time_to_vote_ms: timeToVote,
          })
          .select()
          .single();

        if (voteError) {
          throw new Error('Failed to record vote');
        }

        // Update source ratings
        const updatePromises = [
          supabase
            .from('sources')
            .update({
              rating: newRatingA.mu,
              rating_deviation: newRatingA.phi,
              volatility: newRatingA.sigma,
              total_matches: sourceAData.total_matches + 1,
              total_wins: sourceAData.total_wins + (actualWinner === 'a' ? 1 : 0),
              total_losses: sourceAData.total_losses + (actualWinner === 'b' ? 1 : 0),
              total_ties: sourceAData.total_ties + (actualWinner === 'tie' || actualWinner === 'both_bad' ? 1 : 0),
            })
            .eq('id', sourceAData.id),
          supabase
            .from('sources')
            .update({
              rating: newRatingB.mu,
              rating_deviation: newRatingB.phi,
              volatility: newRatingB.sigma,
              total_matches: sourceBData.total_matches + 1,
              total_wins: sourceBData.total_wins + (actualWinner === 'b' ? 1 : 0),
              total_losses: sourceBData.total_losses + (actualWinner === 'a' ? 1 : 0),
              total_ties: sourceBData.total_ties + (actualWinner === 'tie' || actualWinner === 'both_bad' ? 1 : 0),
            })
            .eq('id', sourceBData.id),
          // Record rating history
          supabase.from('rating_history').insert([
            {
              source_id: sourceAData.id,
              rating: newRatingA.mu,
              rating_deviation: newRatingA.phi,
              volatility: newRatingA.sigma,
            },
            {
              source_id: sourceBData.id,
              rating: newRatingB.mu,
              rating_deviation: newRatingB.phi,
              volatility: newRatingB.sigma,
            },
          ]),
          // Mark match as completed
          supabase
            .from('matches')
            .update({ status: 'completed' })
            .eq('id', match.id),
        ];

        await Promise.all(updatePromises);

        // Create vote result
        const voteResult: VoteResult = {
          vote: vote!,
          ratings: {
            sourceA: {
              before: sourceAData.rating,
              after: newRatingA.mu,
              change: changeA,
            },
            sourceB: {
              before: sourceBData.rating,
              after: newRatingB.mu,
              change: changeB,
            },
          },
          reveal: {
            sourceA: sourceAData,
            sourceB: sourceBData,
          },
        };

        update(s => ({
          ...s,
          phase: 'revealing',
          voteResult,
          matchCount: s.matchCount + 1,
        }));

        // Auto-transition to complete after reveal animation
        setTimeout(() => {
          update(s => ({ ...s, phase: 'complete' }));
        }, 2000);

      } catch (error) {
        update(s => ({
          ...s,
          phase: 'comparing', // Allow retry
          error: error instanceof Error ? error.message : 'Failed to submit vote',
        }));
      }
    },

    /**
     * Reset store for a new match
     */
    reset() {
      set(initialState);
    },

    /**
     * Clear error
     */
    clearError() {
      update(s => ({ ...s, error: null }));
    },
  };
}

/**
 * Fetch content from a source
 * This is a placeholder - real implementation would call external APIs
 */
async function fetchSourceContent(source: Source, topic: string): Promise<string> {
  // In real implementation, this would call:
  // - Wikipedia REST API
  // - Grok/xAI API
  // For now, return placeholder that identifies the source
  
  switch (source.slug) {
    case 'wikipedia':
      return await fetchWikipediaContent(topic);
    case 'grokipedia':
      return await fetchGrokContent(topic);
    default:
      return `Content about "${topic}" from ${source.name}. This is placeholder content that would be fetched from the actual API.`;
  }
}

/**
 * Fetch Wikipedia content (placeholder)
 */
async function fetchWikipediaContent(topic: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(topic.replace(/ /g, '_'));
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    );
    
    if (!response.ok) {
      return `Wikipedia article about "${topic}" is not available.`;
    }
    
    const data = await response.json();
    return data.extract || `No Wikipedia summary found for "${topic}".`;
  } catch {
    return `Failed to fetch Wikipedia content for "${topic}".`;
  }
}

/**
 * Fetch Grok content (placeholder - needs xAI API key)
 */
async function fetchGrokContent(topic: string): Promise<string> {
  // This would call the xAI API in production
  // For now, return a placeholder that simulates AI-generated content
  return `**Grokipedia on ${topic}**

This is a simulated response from Grok about "${topic}". In a production environment, this would be fetched from the xAI API with real-time, AI-generated content.

The response would typically include comprehensive, conversational information about the topic, with Grok's characteristic style of being informative yet accessible.

Key aspects covered would include definitions, historical context, current relevance, and interesting facts about ${topic}.`;
}

export const matchStore = createMatchStore();

// Derived stores
export const isLoading = derived(matchStore, $match => $match.phase === 'loading');
export const canVote = derived(matchStore, $match => $match.phase === 'comparing');
export const hasError = derived(matchStore, $match => $match.error !== null);
