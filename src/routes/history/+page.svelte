<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import { getSourceEmoji, type SourceSlug } from '$lib/services/content';

  interface VoteRecord {
    id: string;
    created_at: string;
    winner: string;
    time_to_vote_ms: number | null;
    source_a_rating_before: number;
    source_a_rating_after: number;
    source_b_rating_before: number;
    source_b_rating_after: number;
    match: {
      topic_query: string;
      source_a: { name: string; slug: string };
      source_b: { name: string; slug: string };
    };
  }

  interface UserStats {
    totalVotes: number;
    sourcesCompared: Set<string>;
    favoriteSource: string | null;
    avgTimeToVote: number;
    votesThisWeek: number;
  }

  let showAuthModal = false;
  let votes: VoteRecord[] = [];
  let stats: UserStats = {
    totalVotes: 0,
    sourcesCompared: new Set(),
    favoriteSource: null,
    avgTimeToVote: 0,
    votesThisWeek: 0,
  };
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    await authStore.init();
    if ($isAuthenticated) {
      await loadVoteHistory();
    }
    loading = false;
  });

  // React to auth changes
  $: if (browser && $isAuthenticated && !loading) {
    loadVoteHistory();
  }

  async function loadVoteHistory() {
    if (!isSupabaseConfigured || !$currentUser) return;

    loading = true;
    error = null;

    try {
      // Get votes for the current user
      const { data, error: fetchError } = await supabase
        .from('votes')
        .select(`
          id,
          created_at,
          winner,
          time_to_vote_ms,
          source_a_rating_before,
          source_a_rating_after,
          source_b_rating_before,
          source_b_rating_after,
          match:matches (
            topic_query,
            source_a:sources!matches_source_a_id_fkey (name, slug),
            source_b:sources!matches_source_b_id_fkey (name, slug)
          )
        `)
        .eq('user_id', $currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      votes = (data || []) as unknown as VoteRecord[];
      calculateStats();
    } catch (e) {
      console.error('Error loading vote history:', e);
      error = e instanceof Error ? e.message : 'Failed to load history';
    } finally {
      loading = false;
    }
  }

  function calculateStats() {
    const sourceWins: Record<string, number> = {};
    let totalTime = 0;
    let timeCount = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    stats.sourcesCompared = new Set();
    stats.votesThisWeek = 0;

    for (const vote of votes) {
      // Track sources
      if (vote.match?.source_a?.slug) {
        stats.sourcesCompared.add(vote.match.source_a.slug);
      }
      if (vote.match?.source_b?.slug) {
        stats.sourcesCompared.add(vote.match.source_b.slug);
      }

      // Track wins
      if (vote.winner === 'a' && vote.match?.source_a?.name) {
        sourceWins[vote.match.source_a.name] = (sourceWins[vote.match.source_a.name] || 0) + 1;
      } else if (vote.winner === 'b' && vote.match?.source_b?.name) {
        sourceWins[vote.match.source_b.name] = (sourceWins[vote.match.source_b.name] || 0) + 1;
      }

      // Track time
      if (vote.time_to_vote_ms) {
        totalTime += vote.time_to_vote_ms;
        timeCount++;
      }

      // Count this week
      if (new Date(vote.created_at) > oneWeekAgo) {
        stats.votesThisWeek++;
      }
    }

    stats.totalVotes = votes.length;
    stats.avgTimeToVote = timeCount > 0 ? Math.round(totalTime / timeCount / 1000) : 0;
    
    // Find favorite source
    let maxWins = 0;
    for (const [source, wins] of Object.entries(sourceWins)) {
      if (wins > maxWins) {
        maxWins = wins;
        stats.favoriteSource = source;
      }
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getWinnerDisplay(vote: VoteRecord): string {
    if (vote.winner === 'a') return vote.match?.source_a?.name || 'Source A';
    if (vote.winner === 'b') return vote.match?.source_b?.name || 'Source B';
    if (vote.winner === 'tie') return 'Tie';
    return 'Both Bad';
  }

  function getRatingChange(vote: VoteRecord, side: 'a' | 'b'): number {
    if (side === 'a') {
      return Math.round(vote.source_a_rating_after - vote.source_a_rating_before);
    }
    return Math.round(vote.source_b_rating_after - vote.source_b_rating_before);
  }

  // Helper to avoid TypeScript 'as' in template
  function getEmoji(slug: string | undefined, fallback: string): string {
    return getSourceEmoji((slug || fallback) as SourceSlug);
  }
</script>

<svelte:head>
  <title>Vote History - Knowledge Arena</title>
</svelte:head>

<AuthModal bind:open={showAuthModal} on:success={loadVoteHistory} />

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2">📊 Vote History</h1>
    <p class="text-slate-400">Track your comparisons and see your impact on the leaderboard</p>
  </div>

  {#if !$isAuthenticated}
    <!-- Sign In Prompt -->
    <div class="arena-card text-center py-12">
      <div class="text-6xl mb-4">🔐</div>
      <h2 class="text-2xl font-semibold mb-2">Sign in to view your history</h2>
      <p class="text-slate-400 mb-6 max-w-md mx-auto">
        Create an account to track your votes, see your preferences, and maintain your comparison history across devices.
      </p>
      <button
        class="vote-btn vote-btn-primary"
        on:click={() => showAuthModal = true}
      >
        Sign In or Create Account
      </button>
      
      <p class="text-sm text-slate-500 mt-6">
        You can still vote without an account - your votes count toward the global leaderboard!
      </p>
    </div>

  {:else if loading}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
      <p class="text-slate-400">Loading your history...</p>
    </div>

  {:else if error}
    <div class="arena-card text-center py-12">
      <div class="text-4xl mb-4">😕</div>
      <h2 class="text-xl font-semibold mb-2">Failed to load history</h2>
      <p class="text-slate-400 mb-4">{error}</p>
      <button class="vote-btn vote-btn-secondary" on:click={loadVoteHistory}>
        Try Again
      </button>
    </div>

  {:else}
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-amber-400">{stats.totalVotes}</div>
        <div class="text-sm text-slate-400">Total Votes</div>
      </div>
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-purple-400">{stats.sourcesCompared.size}</div>
        <div class="text-sm text-slate-400">Sources Compared</div>
      </div>
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-emerald-400">{stats.votesThisWeek}</div>
        <div class="text-sm text-slate-400">This Week</div>
      </div>
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-blue-400">{stats.avgTimeToVote}s</div>
        <div class="text-sm text-slate-400">Avg Decision Time</div>
      </div>
    </div>

    {#if stats.favoriteSource}
      <div class="arena-card mb-8">
        <div class="flex items-center gap-3">
          <span class="text-2xl">❤️</span>
          <div>
            <div class="text-sm text-slate-400">Your Favorite Source</div>
            <div class="text-lg font-semibold">{stats.favoriteSource}</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Vote History List -->
    <div class="arena-card">
      <h2 class="text-xl font-semibold mb-4">Recent Votes</h2>
      
      {#if votes.length === 0}
        <div class="text-center py-8 text-slate-400">
          <p>No votes yet. Head to the Arena to start comparing!</p>
          <a href="/arena" class="vote-btn vote-btn-primary mt-4 inline-block">
            Go to Arena
          </a>
        </div>
      {:else}
        <div class="space-y-4">
          {#each votes as vote}
            <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">{vote.match?.topic_query || 'Unknown Topic'}</span>
                <span class="text-xs text-slate-500">{formatDate(vote.created_at)}</span>
              </div>
              
              <div class="flex items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <span>{getEmoji(vote.match?.source_a?.slug, 'wikipedia')}</span>
                  <span class="{vote.winner === 'a' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}">
                    {vote.match?.source_a?.name || 'Source A'}
                  </span>
                  <span class="text-xs {getRatingChange(vote, 'a') >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ({getRatingChange(vote, 'a') >= 0 ? '+' : ''}{getRatingChange(vote, 'a')})
                  </span>
                </div>
                
                <span class="text-slate-600">vs</span>
                
                <div class="flex items-center gap-2">
                  <span>{getEmoji(vote.match?.source_b?.slug, 'grokipedia')}</span>
                  <span class="{vote.winner === 'b' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}">
                    {vote.match?.source_b?.name || 'Source B'}
                  </span>
                  <span class="text-xs {getRatingChange(vote, 'b') >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ({getRatingChange(vote, 'b') >= 0 ? '+' : ''}{getRatingChange(vote, 'b')})
                  </span>
                </div>
              </div>
              
              <div class="mt-2 text-xs text-slate-500">
                Winner: <span class="text-slate-300">{getWinnerDisplay(vote)}</span>
                {#if vote.time_to_vote_ms}
                  • Decided in {Math.round(vote.time_to_vote_ms / 1000)}s
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
