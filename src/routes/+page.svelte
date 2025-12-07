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
  <title>Knowledge Arena - Compare Knowledge Sources</title>
  <meta name="description" content="Compare Wikipedia, Grokipedia, and other knowledge sources. Vote for your preferred information style and see global rankings." />
</svelte:head>

<div class="min-h-screen">
  <!-- Hero Section -->
  <section class="relative overflow-hidden">
    <!-- Background Effects -->
    <div class="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent"></div>
    <div class="absolute top-20 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
    <div class="absolute top-40 right-1/4 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl"></div>
    
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
      <div class="text-center">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-8">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span class="text-sm text-slate-400">Powered by Glicko-2 Rating System</span>
        </div>

        <!-- Title -->
        <h1 class="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
          <span class="text-gradient">Knowledge Arena</span>
        </h1>
        
        <p class="text-xl sm:text-2xl text-slate-400 max-w-2xl mx-auto mb-12">
          Compare knowledge sources head-to-head. Vote for your preferred information style. 
          <span class="text-slate-300">Shape the global leaderboard.</span>
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/arena" class="vote-btn vote-btn-primary">
            ⚔️ Enter the Arena
          </a>
          <a href="/leaderboard" class="vote-btn vote-btn-secondary">
            🏆 View Leaderboard
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Section -->
  <section class="py-16 border-y border-slate-800/50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div class="text-center">
          <div class="text-4xl font-bold text-gradient mb-2">
            {stats.totalVotes.toLocaleString()}
          </div>
          <div class="text-slate-500">Total Comparisons</div>
        </div>
        <div class="text-center">
          <div class="text-4xl font-bold text-gradient mb-2">
            {stats.totalSources}
          </div>
          <div class="text-slate-500">Knowledge Sources</div>
        </div>
        <div class="text-center">
          <div class="text-4xl font-bold text-gradient mb-2">
            {stats.topSource?.name || '—'}
          </div>
          <div class="text-slate-500">
            Current Leader 
            {#if stats.topSource}
              <span class="text-amber-500">({stats.topSource.rating})</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-3xl font-bold text-center mb-16">How It Works</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Step 1 -->
        <div class="arena-card text-center group">
          <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
            📖
          </div>
          <h3 class="text-xl font-semibold mb-3">1. Read & Compare</h3>
          <p class="text-slate-400">
            See the same topic explained by two different knowledge sources, displayed anonymously side-by-side.
          </p>
        </div>

        <!-- Step 2 -->
        <div class="arena-card text-center group">
          <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
            🗳️
          </div>
          <h3 class="text-xl font-semibold mb-3">2. Vote Your Preference</h3>
          <p class="text-slate-400">
            Choose which explanation you prefer, or mark as tie. Your vote impacts the global ratings.
          </p>
        </div>

        <!-- Step 3 -->
        <div class="arena-card text-center group">
          <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
            📊
          </div>
          <h3 class="text-xl font-semibold mb-3">3. See the Impact</h3>
          <p class="text-slate-400">
            Watch ratings update in real-time using the Glicko-2 system. Track trends on the leaderboard.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Preview -->
  <section class="py-20 bg-gradient-to-b from-slate-900/50 to-transparent">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 class="text-3xl font-bold mb-6">
            Beyond Simple Voting
          </h2>
          <div class="space-y-6">
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                🎯
              </div>
              <div>
                <h3 class="font-semibold mb-1">Personal Preferences</h3>
                <p class="text-slate-400 text-sm">Track your voting history and discover which sources match your learning style.</p>
              </div>
            </div>
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                🧪
              </div>
              <div>
                <h3 class="font-semibold mb-1">Knowledge Blender</h3>
                <p class="text-slate-400 text-sm">Blend multiple sources together based on your preferences using AI.</p>
              </div>
            </div>
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                🔍
              </div>
              <div>
                <h3 class="font-semibold mb-1">Truth Seeker</h3>
                <p class="text-slate-400 text-sm">Cross-reference facts across sources to identify the most accurate information.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="relative">
          <!-- Decorative card preview -->
          <div class="arena-card glow-amber">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-500 text-sm">Topic: Artificial Intelligence</span>
              <span class="rating-badge">🔥 Trending</span>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <div class="text-amber-500 font-semibold mb-2">Source A</div>
                <div class="h-24 bg-slate-700/30 rounded animate-pulse"></div>
              </div>
              <div class="p-4 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <div class="text-amber-500 font-semibold mb-2">Source B</div>
                <div class="h-24 bg-slate-700/30 rounded animate-pulse"></div>
              </div>
            </div>
            <div class="flex justify-center gap-4 mt-6">
              <button class="vote-btn vote-btn-primary text-sm py-2 px-4">A is Better</button>
              <button class="vote-btn vote-btn-secondary text-sm py-2 px-4">Tie</button>
              <button class="vote-btn vote-btn-primary text-sm py-2 px-4">B is Better</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-20">
    <div class="max-w-3xl mx-auto px-4 text-center">
      <h2 class="text-3xl font-bold mb-6">Ready to Judge?</h2>
      <p class="text-slate-400 mb-8">
        Join thousands of knowledge enthusiasts comparing and rating the world's best information sources.
      </p>
      <a href="/arena" class="vote-btn vote-btn-primary inline-block">
        Start Comparing →
      </a>
    </div>
  </section>
</div>
