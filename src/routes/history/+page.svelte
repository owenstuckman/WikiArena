<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import { getSourceLogo, getSourceColor, type SourceSlug } from '$lib/services/content';

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

  interface SourceStats {
    name: string;
    slug: string;
    wins: number;
    losses: number;
    ties: number;
    total: number;
    winRate: number;
  }

  interface UserStats {
    totalVotes: number;
    sourcesCompared: Set<string>;
    favoriteSource: string | null;
    avgTimeToVote: number;
    votesThisWeek: number;
    sourceStats: Record<string, SourceStats>;
  }

  let showAuthModal = false;
  let votes: VoteRecord[] = [];
  let stats: UserStats = {
    totalVotes: 0,
    sourcesCompared: new Set(),
    favoriteSource: null,
    avgTimeToVote: 0,
    votesThisWeek: 0,
    sourceStats: {},
  };
  let loading = true;
  let error: string | null = null;
  let hasLoadedOnce = false;
  let showAllVotes = false;
  let visibleVotesCount = 20;

  onMount(async () => {
    await authStore.init();
    loading = false;
  });

  // React to auth changes - only load once user is fully authenticated
  $: if (browser && $isAuthenticated && $currentUser && !hasLoadedOnce) {
    hasLoadedOnce = true;
    loadVoteHistory();
  }
  
  // Reset when user logs out
  $: if (browser && !$isAuthenticated) {
    hasLoadedOnce = false;
    votes = [];
    stats = {
      totalVotes: 0,
      sourcesCompared: new Set(),
      favoriteSource: null,
      avgTimeToVote: 0,
      votesThisWeek: 0,
      sourceStats: {},
    };
  }

  function handleAuthSuccess() {
    hasLoadedOnce = false;
  }

  async function loadVoteHistory() {
    if (!isSupabaseConfigured || !$currentUser?.id) {
      return;
    }

    loading = true;
    error = null;

    try {
      // Get ALL votes for the current user (no limit)
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
        .order('created_at', { ascending: false });

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
    const sourceWins: Record<string, { name: string; slug: string; wins: number; losses: number; ties: number }> = {};
    let totalTime = 0;
    let timeCount = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    stats.sourcesCompared = new Set();
    stats.votesThisWeek = 0;

    for (const vote of votes) {
      const sourceA = vote.match?.source_a;
      const sourceB = vote.match?.source_b;
      
      // Initialize source tracking
      if (sourceA?.slug && !sourceWins[sourceA.slug]) {
        sourceWins[sourceA.slug] = { name: sourceA.name, slug: sourceA.slug, wins: 0, losses: 0, ties: 0 };
      }
      if (sourceB?.slug && !sourceWins[sourceB.slug]) {
        sourceWins[sourceB.slug] = { name: sourceB.name, slug: sourceB.slug, wins: 0, losses: 0, ties: 0 };
      }

      // Track sources
      if (sourceA?.slug) stats.sourcesCompared.add(sourceA.slug);
      if (sourceB?.slug) stats.sourcesCompared.add(sourceB.slug);

      // Track wins/losses
      if (vote.winner === 'a' && sourceA?.slug) {
        sourceWins[sourceA.slug].wins++;
        if (sourceB?.slug) sourceWins[sourceB.slug].losses++;
      } else if (vote.winner === 'b' && sourceB?.slug) {
        sourceWins[sourceB.slug].wins++;
        if (sourceA?.slug) sourceWins[sourceA.slug].losses++;
      } else if (vote.winner === 'tie') {
        if (sourceA?.slug) sourceWins[sourceA.slug].ties++;
        if (sourceB?.slug) sourceWins[sourceB.slug].ties++;
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
    
    // Calculate source stats with win rates
    stats.sourceStats = {};
    for (const [slug, data] of Object.entries(sourceWins)) {
      const total = data.wins + data.losses + data.ties;
      stats.sourceStats[slug] = {
        ...data,
        total,
        winRate: total > 0 ? Math.round((data.wins / total) * 100) : 0,
      };
    }
    
    // Find favorite source (highest win count)
    let maxWins = 0;
    for (const [slug, data] of Object.entries(stats.sourceStats)) {
      if (data.wins > maxWins) {
        maxWins = data.wins;
        stats.favoriteSource = data.name;
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

  function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  function getLogo(slug: string | undefined, fallback: string): string {
    return getSourceLogo((slug || fallback) as SourceSlug);
  }
  
  function getColor(slug: string | undefined, fallback: string): string {
    return getSourceColor((slug || fallback) as SourceSlug);
  }

  function loadMoreVotes() {
    visibleVotesCount += 20;
  }

  $: visibleVotes = showAllVotes ? votes : votes.slice(0, visibleVotesCount);
  $: hasMoreVotes = !showAllVotes && votes.length > visibleVotesCount;
  
  // Sort source stats by win rate
  $: sortedSourceStats = Object.values(stats.sourceStats).sort((a, b) => b.winRate - a.winRate);
</script>

<svelte:head>
  <title>Vote History - WikiArena</title>
</svelte:head>

<AuthModal bind:open={showAuthModal} on:success={handleAuthSuccess} />

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Vote History</h1>
    <p class="text-slate-400 text-sm">Track your comparisons and see your source preferences</p>
  </div>

  {#if !$isAuthenticated}
    <!-- Sign In Prompt -->
    <div class="arena-card text-center py-12">
      <div class="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <h2 class="text-xl font-semibold mb-2">Sign in to view your history</h2>
      <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">
        Create an account to track your votes, see your preferences, and maintain your comparison history across devices.
      </p>
      <button
        class="vote-btn vote-btn-primary"
        on:click={() => showAuthModal = true}
      >
        Sign In or Create Account
      </button>
      
      <p class="text-xs text-slate-500 mt-6">
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
      <div class="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h2 class="text-lg font-semibold mb-2">Failed to load history</h2>
      <p class="text-slate-400 text-sm mb-4">{error}</p>
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

    <!-- Source Preferences -->
    {#if sortedSourceStats.length > 0}
      <div class="arena-card mb-8">
        <h2 class="text-lg font-semibold mb-4">Your Source Preferences</h2>
        <div class="space-y-4">
          {#each sortedSourceStats as source, index}
            <div class="flex items-center gap-4">
              <!-- Rank indicator -->
              <div class="flex-shrink-0 w-8 text-center">
                <span class="text-sm font-bold {index === 0 ? 'text-amber-400' : 'text-slate-500'}">#{index + 1}</span>
              </div>
              
              <!-- Source logo and name -->
              <div class="flex items-center gap-2 w-40">
                <img 
                  src={getLogo(source.slug, 'wikipedia')} 
                  alt={source.name}
                  class="w-6 h-6 object-contain"
                />
                <span class="font-medium truncate {getColor(source.slug, 'wikipedia')}">{source.name}</span>
              </div>
              
              <!-- Win rate bar -->
              <div class="flex-1">
                <div class="h-6 bg-slate-800 rounded-full overflow-hidden relative">
                  <!-- Wins -->
                  <div 
                    class="h-full bg-emerald-500/80 absolute left-0 transition-all"
                    style="width: {source.total > 0 ? (source.wins / source.total) * 100 : 0}%"
                  ></div>
                  <!-- Ties -->
                  <div 
                    class="h-full bg-slate-500/80 absolute transition-all"
                    style="left: {source.total > 0 ? (source.wins / source.total) * 100 : 0}%; width: {source.total > 0 ? (source.ties / source.total) * 100 : 0}%"
                  ></div>
                  <!-- Text overlay -->
                  <div class="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    <span class="text-emerald-300">{source.wins}W</span>
                    <span class="mx-1 text-slate-400">·</span>
                    <span class="text-red-300">{source.losses}L</span>
                    <span class="mx-1 text-slate-400">·</span>
                    <span class="text-slate-300">{source.ties}T</span>
                  </div>
                </div>
              </div>
              
              <!-- Win rate percentage -->
              <div class="w-16 text-right">
                <span class="text-lg font-bold {source.winRate >= 50 ? 'text-emerald-400' : 'text-slate-400'}">{source.winRate}%</span>
              </div>
            </div>
          {/each}
        </div>
        
        <!-- Legend -->
        <div class="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-center gap-6 text-xs text-slate-500">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded bg-emerald-500/80"></div>
            <span>Wins</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded bg-slate-500/80"></div>
            <span>Ties</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded bg-slate-800"></div>
            <span>Losses</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Vote History List -->
    <div class="arena-card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">
          All Votes
          <span class="text-sm font-normal text-slate-500">({votes.length} total)</span>
        </h2>
        <button 
          class="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"
          on:click={() => { hasLoadedOnce = false; loadVoteHistory(); }}
          disabled={loading}
        >
          <svg class="w-4 h-4 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      
      {#if votes.length === 0}
        <div class="text-center py-8 text-slate-400">
          <p>No votes yet. Head to the Arena to start comparing!</p>
          <a href="/arena" class="vote-btn vote-btn-primary mt-4 inline-block">
            Go to Arena
          </a>
        </div>
      {:else}
        <div class="space-y-2">
          {#each visibleVotes as vote}
            <div class="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 transition-colors">
              <div class="flex items-center justify-between">
                <!-- Topic and result -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm truncate">{vote.match?.topic_query || 'Unknown Topic'}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-1 text-xs">
                    <img 
                      src={getLogo(vote.match?.source_a?.slug, 'wikipedia')} 
                      alt=""
                      class="w-4 h-4 object-contain"
                    />
                    <span class="{vote.winner === 'a' ? 'text-emerald-400 font-semibold' : 'text-slate-500'}">
                      {vote.match?.source_a?.name || 'A'}
                    </span>
                    <span class="text-slate-600">vs</span>
                    <img 
                      src={getLogo(vote.match?.source_b?.slug, 'grokipedia')} 
                      alt=""
                      class="w-4 h-4 object-contain"
                    />
                    <span class="{vote.winner === 'b' ? 'text-emerald-400 font-semibold' : 'text-slate-500'}">
                      {vote.match?.source_b?.name || 'B'}
                    </span>
                    {#if vote.winner === 'tie'}
                      <span class="px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-300">Tie</span>
                    {:else if vote.winner === 'both_bad'}
                      <span class="px-1.5 py-0.5 bg-red-500/20 rounded text-red-400">Both Bad</span>
                    {/if}
                  </div>
                </div>
                
                <!-- Date -->
                <div class="text-right text-xs text-slate-500 flex-shrink-0 ml-4">
                  <div>{formatShortDate(vote.created_at)}</div>
                  {#if vote.time_to_vote_ms}
                    <div class="text-slate-600">{Math.round(vote.time_to_vote_ms / 1000)}s</div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
        
        <!-- Load More Button -->
        {#if hasMoreVotes}
          <div class="mt-4 text-center">
            <button 
              class="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
              on:click={loadMoreVotes}
            >
              Load More ({votes.length - visibleVotesCount} remaining)
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
