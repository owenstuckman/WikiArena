<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { leaderboardStore, isLeaderboardLoading } from '$lib/stores/leaderboard';
  import { getSourceLogo, getSourceColor, type SourceSlug } from '$lib/services/content';
  
  // Accept SvelteKit props to suppress warnings
  export let data: Record<string, unknown> = {};

  // Sort method
  type SortMethod = 'wins' | 'win_rate' | 'matches';
  let sortMethod: SortMethod = 'wins';

  onMount(async () => {
    await leaderboardStore.load();
    leaderboardStore.subscribeRealtime();
  });

  onDestroy(() => {
    leaderboardStore.unsubscribeRealtime();
  });

  function getLogo(slug: string): string {
    return getSourceLogo(slug as SourceSlug);
  }
  
  function getColor(slug: string): string {
    return getSourceColor(slug as SourceSlug);
  }

  // Sort entries by selected method - prioritizing actual performance
  $: sortedEntries = [...$leaderboardStore.entries].sort((a, b) => {
    if (sortMethod === 'wins') {
      // Sort by total wins, then by win rate
      if (b.total_wins !== a.total_wins) {
        return b.total_wins - a.total_wins;
      }
      return b.win_rate - a.win_rate;
    } else if (sortMethod === 'win_rate') {
      // Sort by win rate (only if enough matches), then by total wins
      const aHasEnoughMatches = a.total_matches >= 5;
      const bHasEnoughMatches = b.total_matches >= 5;
      
      // Sources with enough matches come first
      if (aHasEnoughMatches && !bHasEnoughMatches) return -1;
      if (!aHasEnoughMatches && bHasEnoughMatches) return 1;
      
      // Both have enough matches or both don't
      if (b.win_rate !== a.win_rate) {
        return b.win_rate - a.win_rate;
      }
      return b.total_wins - a.total_wins;
    } else {
      // Sort by total matches
      return b.total_matches - a.total_matches;
    }
  });

  function getRankBadge(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }
</script>

<svelte:head>
  <title>Leaderboard - WikiArena</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Leaderboard</h1>
    <p class="text-slate-400 text-sm">Global rankings based on community votes</p>
    {#if $leaderboardStore.lastUpdated}
      <p class="text-xs text-slate-500 mt-2">
        Last updated: {$leaderboardStore.lastUpdated.toLocaleTimeString()}
        <span class="inline-flex items-center ml-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="ml-1">Live</span>
        </span>
      </p>
    {/if}
  </div>

  <!-- Sort Options -->
  <div class="mb-6 flex justify-center gap-2">
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all
        {sortMethod === 'wins' 
          ? 'bg-amber-500 text-slate-900' 
          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
      on:click={() => sortMethod = 'wins'}
    >
      Total Wins
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all
        {sortMethod === 'win_rate' 
          ? 'bg-amber-500 text-slate-900' 
          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
      on:click={() => sortMethod = 'win_rate'}
    >
      Win Rate
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all
        {sortMethod === 'matches' 
          ? 'bg-amber-500 text-slate-900' 
          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
      on:click={() => sortMethod = 'matches'}
    >
      Total Matches
    </button>
  </div>

  <!-- Loading State -->
  {#if $isLeaderboardLoading}
    <div class="space-y-4">
      {#each [1, 2, 3, 4, 5] as _}
        <div class="leaderboard-row">
          <div class="skeleton h-10 w-10 rounded-full"></div>
          <div class="flex-1">
            <div class="skeleton h-5 w-32 mb-2"></div>
            <div class="skeleton h-4 w-24"></div>
          </div>
          <div class="skeleton h-8 w-20"></div>
        </div>
      {/each}
    </div>

  <!-- Error State -->
  {:else if $leaderboardStore.error}
    <div class="arena-card text-center">
      <div class="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h2 class="text-lg font-semibold mb-2">Failed to load leaderboard</h2>
      <p class="text-slate-400 text-sm mb-6">{$leaderboardStore.error}</p>
      <button 
        class="vote-btn vote-btn-primary"
        on:click={() => leaderboardStore.load()}
      >
        Try Again
      </button>
    </div>

  <!-- Leaderboard -->
  {:else}
    <div class="space-y-3">
      {#each sortedEntries as entry, index (entry.id)}
        {@const rank = index + 1}
        <div 
          class="leaderboard-row {rank <= 3 ? 'leaderboard-row-top' : ''}"
          style="animation-delay: {index * 50}ms"
        >
          <!-- Rank -->
          <div class="flex-shrink-0 w-14 text-center">
            <span class="text-xl font-bold {rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500'}">
              {getRankBadge(rank)}
            </span>
          </div>

          <!-- Source Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-white/10 p-1.5 flex items-center justify-center flex-shrink-0">
                <img 
                  src={getLogo(entry.slug)} 
                  alt={entry.name}
                  class="max-w-full max-h-full object-contain"
                />
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-lg truncate {getColor(entry.slug)}">{entry.name}</h3>
                <p class="text-sm text-slate-500">
                  {entry.total_matches} matches played
                </p>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-4 sm:gap-8">
            <!-- Win/Loss/Tie -->
            <div class="hidden sm:flex items-center gap-4 text-sm">
              <div class="text-center">
                <div class="text-2xl font-bold text-emerald-400">{entry.total_wins}</div>
                <div class="text-slate-500 text-xs">Wins</div>
              </div>
              <div class="text-center">
                <div class="text-xl font-semibold text-red-400">{entry.total_losses}</div>
                <div class="text-slate-500 text-xs">Losses</div>
              </div>
              <div class="text-center">
                <div class="text-xl font-semibold text-slate-400">{entry.total_ties}</div>
                <div class="text-slate-500 text-xs">Ties</div>
              </div>
            </div>
            
            <!-- Mobile: compact stats -->
            <div class="sm:hidden text-center">
              <div class="text-lg font-bold text-emerald-400">{entry.total_wins}W</div>
              <div class="text-xs text-slate-500">{entry.total_losses}L · {entry.total_ties}T</div>
            </div>

            <!-- Win Rate -->
            <div class="text-right min-w-[60px]">
              <div class="text-2xl font-bold text-gradient">
                {entry.win_rate}%
              </div>
              <div class="text-xs text-slate-500">
                Win Rate
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Empty State -->
    {#if sortedEntries.length === 0}
      <div class="arena-card text-center py-12">
        <div class="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <h2 class="text-lg font-semibold mb-2">No rankings yet</h2>
        <p class="text-slate-400 text-sm mb-6">Be the first to vote and establish the rankings!</p>
        <a href="/arena" class="vote-btn vote-btn-primary">
          Enter the Arena
        </a>
      </div>
    {/if}

    <!-- Legend -->
    {#if sortedEntries.length > 0}
      <div class="mt-8 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
        <h3 class="font-semibold mb-3 text-sm text-slate-400">How Rankings Work</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span class="text-emerald-400 font-semibold">Wins</span>
            <span class="text-slate-400"> — Total times this source was chosen as better</span>
          </div>
          <div>
            <span class="text-red-400 font-semibold">Losses</span>
            <span class="text-slate-400"> — Total times the other source was chosen</span>
          </div>
          <div>
            <span class="text-amber-400 font-semibold">Win Rate</span>
            <span class="text-slate-400"> — Percentage of matches won (wins ÷ total matches)</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .leaderboard-row {
    @apply flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50;
    animation: fadeInUp 0.5s ease-out forwards;
    opacity: 0;
  }

  .leaderboard-row-top {
    @apply border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .skeleton {
    @apply bg-slate-700/50 animate-pulse rounded;
  }
</style>
