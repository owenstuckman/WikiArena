<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
  import { userStore, totalUserVotes } from '$lib/stores/user';
  import { DEMO_SOURCES } from '$lib/services/demo';
  import type { Source } from '$lib/types/database';

  let sources: Source[] = [];
  let sourceStats: Record<string, { wins: number; losses: number; ties: number }> = {};
  let loading = true;

  onMount(async () => {
    await userStore.init();
    await userStore.loadUserData();
    await loadSourceStats();
    loading = false;
  });

  async function loadSourceStats() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sourcesData } = await supabase
          .from('sources')
          .select('*')
          .eq('is_active', true);
        
        if (sourcesData && sourcesData.length > 0) {
          sources = sourcesData;
        } else {
          sources = DEMO_SOURCES;
        }
      } catch {
        sources = DEMO_SOURCES;
      }
    } else {
      sources = DEMO_SOURCES;
    }

    // Calculate stats from vote history
    const stats: Record<string, { wins: number; losses: number; ties: number }> = {};
    
    for (const source of sources) {
      stats[source.id] = { wins: 0, losses: 0, ties: 0 };
    }

    sourceStats = stats;
  }

  function getPreferenceScore(sourceId: string): number {
    const stat = sourceStats[sourceId];
    if (!stat) return 0;
    const total = stat.wins + stat.losses + stat.ties;
    if (total === 0) return 0;
    return Math.round(((stat.wins + stat.ties * 0.5) / total) * 100);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getWinnerLabel(winner: string): string {
    switch (winner) {
      case 'a': return 'Source A';
      case 'b': return 'Source B';
      case 'tie': return 'Tie';
      case 'both_bad': return 'Both Bad';
      default: return winner;
    }
  }
</script>

<svelte:head>
  <title>Preferences - Knowledge Arena</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2">📊 Your Preferences</h1>
    <p class="text-slate-400">Track your voting patterns and source preferences</p>
  </div>

  {#if loading}
    <div class="space-y-6">
      <div class="arena-card">
        <div class="skeleton h-8 w-48 mb-4"></div>
        <div class="grid grid-cols-3 gap-4">
          <div class="skeleton h-20"></div>
          <div class="skeleton h-20"></div>
          <div class="skeleton h-20"></div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="arena-card text-center">
        <div class="text-4xl font-bold text-gradient mb-2">
          {$totalUserVotes}
        </div>
        <div class="text-slate-400">Total Votes</div>
      </div>
      
      <div class="arena-card text-center">
        <div class="text-4xl font-bold text-gradient mb-2">
          {sources.length}
        </div>
        <div class="text-slate-400">Sources Compared</div>
      </div>
      
      <div class="arena-card text-center">
        <div class="text-4xl font-bold text-gradient mb-2">
          {$userStore.isAuthenticated ? '✓' : 'Anonymous'}
        </div>
        <div class="text-slate-400">Account Status</div>
      </div>
    </div>

    <!-- Source Preferences -->
    <div class="arena-card mb-8">
      <h2 class="text-xl font-semibold mb-6">Source Preferences</h2>
      
      {#if sources.length === 0}
        <div class="text-center py-8 text-slate-400">
          <p>No sources available. Start voting in the Arena to build your preferences!</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each sources as source (source.id)}
            <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                {source.slug === 'wikipedia' ? '📚' : '🤖'}
              </div>
              <div class="flex-1">
                <div class="font-semibold">{source.name}</div>
                <div class="text-sm text-slate-500">{source.description}</div>
              </div>
              <div class="text-right">
                <div class="text-lg font-bold text-amber-400">
                  {Math.round(source.rating)}
                </div>
                <div class="text-xs text-slate-500">Global Rating</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Vote History -->
    <div class="arena-card">
      <h2 class="text-xl font-semibold mb-6">Recent Votes</h2>
      
      {#if $userStore.voteHistory.length === 0}
        <div class="text-center py-12">
          <div class="text-4xl mb-4">🗳️</div>
          <p class="text-slate-400 mb-4">No votes yet</p>
          <a href="/arena" class="vote-btn vote-btn-primary">
            Start Voting
          </a>
        </div>
      {:else}
        <div class="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {#each $userStore.voteHistory.slice(0, 20) as vote (vote.id)}
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm
                  {vote.winner === 'a' ? 'bg-blue-500/20 text-blue-400' : 
                   vote.winner === 'b' ? 'bg-purple-500/20 text-purple-400' : 
                   'bg-slate-500/20 text-slate-400'}">
                  {vote.winner === 'a' ? 'A' : vote.winner === 'b' ? 'B' : '='}
                </div>
                <div>
                  <div class="text-sm font-medium">{getWinnerLabel(vote.winner)}</div>
                  <div class="text-xs text-slate-500">{formatDate(vote.created_at)}</div>
                </div>
              </div>
              
              {#if vote.time_to_vote_ms}
                <div class="text-xs text-slate-500">
                  {Math.round(vote.time_to_vote_ms / 1000)}s
                </div>
              {/if}
            </div>
          {/each}
        </div>
        
        {#if $userStore.voteHistory.length > 20}
          <div class="text-center mt-4 text-sm text-slate-500">
            Showing 20 of {$userStore.voteHistory.length} votes
          </div>
        {/if}
      {/if}
    </div>

    <!-- Account Section -->
    {#if !$userStore.isAuthenticated}
      <div class="arena-card mt-8">
        <h2 class="text-xl font-semibold mb-4">Create an Account</h2>
        <p class="text-slate-400 mb-6">
          Sign up to sync your preferences across devices and unlock additional features.
        </p>
        <div class="flex gap-4">
          <button class="vote-btn vote-btn-primary" disabled>
            Coming Soon
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
