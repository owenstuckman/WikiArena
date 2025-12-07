<script lang="ts">
  import { onMount } from 'svelte';
  import { leaderboardStore } from '$lib/stores/leaderboard';
  
  let stats = {
    totalVotes: 0,
    totalSources: 0,
    topSource: null as { name: string; rating: number } | null,
  };

  onMount(async () => {
    await leaderboardStore.load();
    
    leaderboardStore.subscribe(state => {
      if (state.entries.length > 0) {
        stats.totalSources = state.entries.length;
        stats.topSource = {
          name: state.entries[0].name,
          rating: Math.round(state.entries[0].rating),
        };
        stats.totalVotes = state.entries.reduce((sum, e) => sum + e.total_matches, 0);
      }
    });
  });
</script>

<svelte:head>
  <title>WikiArena - Compare Knowledge Sources</title>
  <meta name="description" content="Compare Wikipedia, Grokipedia, and other knowledge sources. Vote for your preferred information style and see global rankings." />
</svelte:head>

<div class="min-h-screen">
  <!-- Hero Section -->
  <section class="relative overflow-hidden">
    <!-- Background Effects -->
    <div class="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent"></div>
    <div class="absolute top-20 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
    <div class="absolute top-40 right-1/4 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      <div class="text-center">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50 mb-6">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span class="text-sm text-slate-400">Glicko-2 Rating System</span>
        </div>

        <!-- Title -->
        <h1 class="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
          <span class="text-gradient">WikiArena</span>
        </h1>
        
        <p class="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          Compare knowledge sources head-to-head. Vote for your preference.
          <span class="text-slate-300">Shape the global leaderboard.</span>
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/arena" class="vote-btn vote-btn-primary">
            Enter the Arena
          </a>
          <a href="/leaderboard" class="vote-btn vote-btn-secondary">
            View Leaderboard
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Section -->
  <section class="py-12 border-y border-slate-800/50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="text-center">
          <div class="text-3xl font-bold text-gradient mb-1">
            {stats.totalVotes.toLocaleString()}
          </div>
          <div class="text-sm text-slate-500">Total Comparisons</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-gradient mb-1">
            {stats.totalSources}
          </div>
          <div class="text-sm text-slate-500">Knowledge Sources</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-gradient mb-1">
            {stats.topSource?.name || '—'}
          </div>
          <div class="text-sm text-slate-500">
            Current Leader
            {#if stats.topSource}
              <span class="text-amber-500/80">({stats.topSource.rating})</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="py-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-bold text-center mb-12 text-slate-200">How It Works</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="arena-card text-center">
          <div class="w-10 h-10 mx-auto mb-4 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">
            1
          </div>
          <h3 class="font-semibold mb-2">Read & Compare</h3>
          <p class="text-slate-400 text-sm">
            See the same topic explained by two sources, displayed anonymously side-by-side.
          </p>
        </div>

        <div class="arena-card text-center">
          <div class="w-10 h-10 mx-auto mb-4 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">
            2
          </div>
          <h3 class="font-semibold mb-2">Vote Your Preference</h3>
          <p class="text-slate-400 text-sm">
            Choose which explanation you prefer, or mark as tie. Your vote impacts global ratings.
          </p>
        </div>

        <div class="arena-card text-center">
          <div class="w-10 h-10 mx-auto mb-4 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">
            3
          </div>
          <h3 class="font-semibold mb-2">See the Impact</h3>
          <p class="text-slate-400 text-sm">
            Watch ratings update in real-time using Glicko-2. Track trends on the leaderboard.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Preview -->
  <section class="py-16 bg-gradient-to-b from-slate-900/50 to-transparent">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 class="text-2xl font-bold mb-6 text-slate-200">Beyond Simple Voting</h2>
          <div class="space-y-4">
            <div class="flex gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-medium mb-0.5 text-slate-200">Personal Preferences</h3>
                <p class="text-slate-400 text-sm">Track your voting history and discover which sources match your learning style.</p>
              </div>
            </div>
            <div class="flex gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-medium mb-0.5 text-slate-200">Knowledge Blender</h3>
                <p class="text-slate-400 text-sm">Blend multiple sources together based on your preferences using AI.</p>
              </div>
            </div>
            <div class="flex gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-medium mb-0.5 text-slate-200">Truth Seeker</h3>
                <p class="text-slate-400 text-sm">Cross-reference facts across sources to identify the most accurate information.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="relative">
          <!-- Decorative card preview -->
          <div class="arena-card">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-500 text-sm">Topic: Artificial Intelligence</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Trending</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <div class="text-amber-500 text-sm font-medium mb-2">Source A</div>
                <div class="space-y-2">
                  <div class="h-2 bg-slate-700/50 rounded w-full"></div>
                  <div class="h-2 bg-slate-700/50 rounded w-4/5"></div>
                  <div class="h-2 bg-slate-700/50 rounded w-3/4"></div>
                </div>
              </div>
              <div class="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <div class="text-amber-500 text-sm font-medium mb-2">Source B</div>
                <div class="space-y-2">
                  <div class="h-2 bg-slate-700/50 rounded w-full"></div>
                  <div class="h-2 bg-slate-700/50 rounded w-3/5"></div>
                  <div class="h-2 bg-slate-700/50 rounded w-4/5"></div>
                </div>
              </div>
            </div>
            <div class="flex justify-center gap-2 mt-4">
              <button class="text-xs px-3 py-1.5 rounded-md bg-slate-700 text-slate-300">A is Better</button>
              <button class="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-400">Tie</button>
              <button class="text-xs px-3 py-1.5 rounded-md bg-slate-700 text-slate-300">B is Better</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-16">
    <div class="max-w-3xl mx-auto px-4 text-center">
      <h2 class="text-2xl font-bold mb-4 text-slate-200">Ready to Compare?</h2>
      <p class="text-slate-400 mb-6 text-sm">
        Join the community comparing and rating the world's knowledge sources.
      </p>
      <a href="/arena" class="vote-btn vote-btn-primary inline-block">
        Start Comparing
      </a>
    </div>
  </section>
</div>
