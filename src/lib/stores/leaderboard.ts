import { writable, derived } from 'svelte/store';
import { getSupabase } from '$lib/services/supabase';
import type { LeaderboardEntry, Source } from '$lib/types/database';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  filter: {
    category: string | null;
    timeRange: 'all' | 'week' | 'month';
  };
}

const initialState: LeaderboardState = {
  entries: [],
  loading: false,
  error: null,
  lastUpdated: null,
  filter: {
    category: null,
    timeRange: 'all',
  },
};

function createLeaderboardStore() {
  const { subscribe, set, update } = writable<LeaderboardState>(initialState);

  let realtimeSubscription: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;

  return {
    subscribe,

    /**
     * Fetch leaderboard data
     */
    async load() {
      update(s => ({ ...s, loading: true, error: null }));

      try {
        const supabase = getSupabase();

        // Use the database function for leaderboard
        const { data, error } = await supabase.rpc('get_leaderboard');

        if (error) {
          throw new Error(error.message);
        }

        update(s => ({
          ...s,
          entries: data || [],
          loading: false,
          lastUpdated: new Date(),
        }));

      } catch (error) {
        update(s => ({
          ...s,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load leaderboard',
        }));
      }
    },

    /**
     * Subscribe to real-time leaderboard updates
     */
    subscribeRealtime() {
      const supabase = getSupabase();

      // Clean up existing subscription
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
      }

      realtimeSubscription = supabase
        .channel('leaderboard-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sources',
          },
          (payload) => {
            // Update the specific entry
            update(s => {
              const updatedSource = payload.new as Source;
              const entries = s.entries.map(entry => {
                if (entry.id === updatedSource.id) {
                  return {
                    ...entry,
                    rating: updatedSource.rating,
                    rating_deviation: updatedSource.rating_deviation,
                    total_matches: updatedSource.total_matches,
                    total_wins: updatedSource.total_wins,
                    total_losses: updatedSource.total_losses,
                    total_ties: updatedSource.total_ties,
                    win_rate: updatedSource.total_matches > 0
                      ? Math.round((updatedSource.total_wins / updatedSource.total_matches) * 1000) / 10
                      : 0,
                  };
                }
                return entry;
              });

              // Re-sort by rating
              entries.sort((a, b) => b.rating - a.rating);

              return {
                ...s,
                entries,
                lastUpdated: new Date(),
              };
            });
          }
        )
        .subscribe();
    },

    /**
     * Unsubscribe from real-time updates
     */
    unsubscribeRealtime() {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        realtimeSubscription = null;
      }
    },

    /**
     * Set filter
     */
    setFilter(filter: Partial<LeaderboardState['filter']>) {
      update(s => ({
        ...s,
        filter: { ...s.filter, ...filter },
      }));
    },

    /**
     * Reset store
     */
    reset() {
      this.unsubscribeRealtime();
      set(initialState);
    },
  };
}

export const leaderboardStore = createLeaderboardStore();

// Derived stores
export const topSource = derived(
  leaderboardStore,
  $lb => $lb.entries[0] || null
);

export const isLeaderboardLoading = derived(
  leaderboardStore,
  $lb => $lb.loading
);

/**
 * Get head-to-head statistics between two sources
 */
export async function getHeadToHead(sourceAId: string, sourceBId: string) {
  const supabase = getSupabase();

  const { data: matches, error } = await supabase
    .from('votes')
    .select(`
      winner,
      match:matches!inner(
        source_a_id,
        source_b_id
      )
    `)
    .or(`and(source_a_id.eq.${sourceAId},source_b_id.eq.${sourceBId}),and(source_a_id.eq.${sourceBId},source_b_id.eq.${sourceAId})`, { foreignTable: 'matches' });

  if (error || !matches) {
    return { winsA: 0, winsB: 0, ties: 0, total: 0 };
  }

  let winsA = 0;
  let winsB = 0;
  let ties = 0;

  for (const vote of matches) {
    const match = vote.match as any;
    const isSourceAFirst = match.source_a_id === sourceAId;

    if (vote.winner === 'tie' || vote.winner === 'both_bad') {
      ties++;
    } else if (vote.winner === 'a') {
      if (isSourceAFirst) winsA++;
      else winsB++;
    } else if (vote.winner === 'b') {
      if (isSourceAFirst) winsB++;
      else winsA++;
    }
  }

  return {
    winsA,
    winsB,
    ties,
    total: matches.length,
  };
}
