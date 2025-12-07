<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { leaderboardStore, isLeaderboardLoading } from '$lib/stores/leaderboard';
  import { getSourceLogo, getSourceColor, type SourceSlug } from '$lib/services/content';
  
  // Accept SvelteKit props to suppress warnings
  export let data: Record<string, unknown> = {};

  // Sort method
  type SortMethod = 'rating' | 'wins' | 'win_rate' | 'matches';
  let sortMethod: SortMethod = 'rating';

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

  // Format Glicko-2 rating for display
  function formatRating(rating: number): string {
    return Math.round(rating).toString();
  }

  // Get confidence level based on rating deviation
  function getConfidence(rd: number): { label: string; color: string; percent: number } {
    // RD of 350 = very uncertain (new), RD of 50 = very confident
    // Lower RD = higher confidence
    const maxRD = 350;
    const minRD = 50;
    const normalized = Math.max(0, Math.min(100, ((maxRD - rd) / (maxRD - minRD)) * 100));
    
    if (rd <= 75) return { label: 'Very High', color: 'text-emerald-400', percent: normalized };
    if (rd <= 100) return { label: 'High', color: 'text-green-400', percent: normalized };
    if (rd <= 150) return { label: 'Medium', color: 'text-amber-400', percent: normalized };
    if (rd <= 250) return { label: 'Low', color: 'text-orange-400', percent: normalized };
    return { label: 'Very Low', color: 'text-red-400', percent: normalized };
  }

  // Get rating tier for styling
  function getRatingTier(rating: number): { label: string; color: string; bg: string } {
    if (rating >= 1800) return { label: 'Master', color: 'text-amber-400', bg: 'bg-amber-500/20' };
    if (rating >= 1650) return { label: 'Expert', color: 'text-purple-400', bg: 'bg-purple-500/20' };
    if (rating >= 1550) return { label: 'Advanced', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (rating >= 1450) return { label: 'Intermediate', color: 'text-cyan-400', bg: 'bg-cyan-500/20' };
    return { label: 'Developing', color: 'text-slate-400', bg: 'bg-slate-500/20' };
  }

  // Sort entries by selected method
  $: sortedEntries = [...$leaderboardStore.entries].sort((a, b) => {
    if (sortMethod === 'rating') {
      // Sort by Glicko-2 rating (higher = better)
      // Consider RD as tiebreaker (lower RD = more confident = better)
      if (Math.abs(b.rating - a.rating) > 10) {
        return b.rating - a.rating;
      }
      return a.rating_deviation - b.rating_deviation;
    } else if (sortMethod === 'wins') {
      // Sort by total wins, then by win rate
      if (b.total_wins !== a.total_wins) {
        return b.total_wins - a.total_wins;
      }
      return b.win_rate - a.win_rate;
    } else if (sortMethod === 'win_rate') {
      // Sort by win rate (only if enough matches), then by total wins
      const aHasEnoughMatches = a.total_matches >= 5;
      const bHasEnoughMatches = b.total_matches >= 5;
      
      if (aHasEnoughMatches && !bHasEnoughMatches) return -1;
      if (!aHasEnoughMatches && bHasEnoughMatches) return 1;
      
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

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Leaderboard</h1>
    <p class="text-slate-400 text-sm">Global rankings based on community votes using Glicko-2 rating system</p>
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
  <div class="mb-6 flex justify-center gap-2 flex-wrap">
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all
        {sortMethod === 'rating' 
          ? 'bg-amber-500 text-slate-900' 
          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
      on:click={() => sortMethod = 'rating'}
    >
      Glicko-2 Rating
    </button>
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
        {@const ratingTier = getRatingTier(entry.rating)}
        {@const confidence = getConfidence(entry.rating_deviation)}
        <div 
          class="leaderboard-row {rank <= 3 ? 'leaderboard-row-top' : ''}"
          style="animation-delay: {index * 50}ms"
        >
          <!-- Rank -->
          <div class="flex-shrink-0 w-12 text-center">
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
                <div class="flex items-center gap-2 text-sm">
                  <span class="px-2 py-0.5 rounded text-xs {ratingTier.color} {ratingTier.bg}">{ratingTier.label}</span>
                  <span class="text-slate-500">{entry.total_matches} matches</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="flex items-center gap-3 sm:gap-6">
            <!-- Glicko-2 Rating -->
            <div class="text-center min-w-[70px]">
              <div class="text-2xl font-bold text-gradient">{formatRating(entry.rating)}</div>
              <div class="text-xs text-slate-500">Rating</div>
            </div>

            <!-- Confidence / RD -->
            <div class="hidden md:block text-center min-w-[80px]">
              <div class="text-sm font-semibold {confidence.color}">{confidence.label}</div>
              <div class="text-xs text-slate-500">±{Math.round(entry.rating_deviation)} RD</div>
            </div>

            <!-- Win/Loss/Tie - Desktop -->
            <div class="hidden lg:flex items-center gap-3 text-sm">
              <div class="text-center">
                <div class="text-xl font-bold text-emerald-400">{entry.total_wins}</div>
                <div class="text-slate-500 text-xs">Wins</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-semibold text-red-400">{entry.total_losses}</div>
                <div class="text-slate-500 text-xs">Losses</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-semibold text-slate-400">{entry.total_ties}</div>
                <div class="text-slate-500 text-xs">Ties</div>
              </div>
            </div>
            
            <!-- Mobile: compact W/L -->
            <div class="lg:hidden text-center min-w-[50px]">
              <div class="text-lg font-bold text-emerald-400">{entry.total_wins}W</div>
              <div class="text-xs text-slate-500">{entry.total_losses}L</div>
            </div>

            <!-- Win Rate -->
            <div class="text-center min-w-[55px]">
              <div class="text-xl font-bold {entry.win_rate >= 50 ? 'text-emerald-400' : entry.win_rate >= 40 ? 'text-amber-400' : 'text-red-400'}">
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
        <h3 class="font-semibold mb-4 text-sm text-slate-300">Understanding the Metrics</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <!-- Glicko-2 Explanation -->
          <div class="space-y-3">
            <h4 class="text-amber-400 font-semibold">Glicko-2 Rating System</h4>
            <p class="text-slate-400 text-xs leading-relaxed">
              Glicko-2 is an advanced rating system (used by chess.com, Lichess, etc.) that considers not just wins/losses, 
              but also the strength of opponents and how much we can trust a rating.
            </p>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-amber-400 font-mono text-xs">Rating</span>
                <span class="text-slate-500 text-xs">— Skill estimate (starts at 1500)</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-amber-400 font-mono text-xs">RD</span>
                <span class="text-slate-500 text-xs">— Rating Deviation (uncertainty, lower = more confident)</span>
              </div>
            </div>
          </div>

          <!-- Confidence Tiers -->
          <div class="space-y-3">
            <h4 class="text-amber-400 font-semibold">Confidence Levels</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-emerald-400">●</span>
                <span class="text-slate-400">Very High (RD ≤ 75)</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-green-400">●</span>
                <span class="text-slate-400">High (RD ≤ 100)</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-amber-400">●</span>
                <span class="text-slate-400">Medium (RD ≤ 150)</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-orange-400">●</span>
                <span class="text-slate-400">Low (RD ≤ 250)</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-red-400">●</span>
                <span class="text-slate-400">Very Low (RD > 250)</span>
              </div>
            </div>
          </div>

          <!-- Win Stats -->
          <div class="space-y-3">
            <h4 class="text-emerald-400 font-semibold">Win/Loss Stats</h4>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 font-semibold">Wins</span>
                <span class="text-slate-400 text-xs">— Times chosen as better by voters</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-red-400 font-semibold">Losses</span>
                <span class="text-slate-400 text-xs">— Times the opponent was chosen</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-semibold">Ties</span>
                <span class="text-slate-400 text-xs">— "Both Good" or "Both Bad" votes</span>
              </div>
            </div>
          </div>

          <!-- Rating Tiers -->
          <div class="space-y-3">
            <h4 class="text-purple-400 font-semibold">Rating Tiers</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-amber-400 bg-amber-500/20">Master</span>
                <span class="text-slate-500">1800+</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-purple-400 bg-purple-500/20">Expert</span>
                <span class="text-slate-500">1650+</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-blue-400 bg-blue-500/20">Advanced</span>
                <span class="text-slate-500">1550+</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-cyan-400 bg-cyan-500/20">Intermediate</span>
                <span class="text-slate-500">1450+</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-slate-400 bg-slate-500/20">Developing</span>
                <span class="text-slate-500">&lt;1450</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .leaderboard-row {
    @apply flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50;
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