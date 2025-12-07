<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { isSupabaseConfigured } from '$lib/supabaseClient';
  import { userStore } from '$lib/stores/user';
  
  let mounted = false;
  
  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/arena', label: 'Arena', icon: '⚔️' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { href: '/blend', label: 'Blender', icon: '🧪' },
    { href: '/preferences', label: 'Preferences', icon: '📊' },
  ];
  
  onMount(() => {
    mounted = true;
    userStore.init();
  });
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
  <!-- Navigation -->
  <nav class="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo -->
        <a href="/" class="flex items-center gap-3 group">
          <div class="relative">
            <div class="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div class="relative text-2xl">📚</div>
          </div>
          <span class="text-xl font-bold bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">
            Knowledge Arena
          </span>
        </a>

        <!-- Nav Links -->
        <div class="hidden sm:flex items-center gap-1">
          {#each navItems as item}
            <a
              href={item.href}
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all
                {$page.url.pathname === item.href 
                  ? 'bg-slate-800 text-amber-300' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'}"
            >
              <span class="mr-2">{item.icon}</span>
              {item.label}
            </a>
          {/each}
        </div>

        <!-- Mobile menu button -->
        <button class="sm:hidden p-2 rounded-lg hover:bg-slate-800">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      
      <!-- Connection Status Banner -->
      {#if mounted && !isSupabaseConfigured}
        <div class="bg-amber-500/10 border-t border-amber-500/20 px-4 py-2">
          <p class="text-xs text-amber-400 text-center">
            ⚠️ Database not connected. Create a <code class="bg-slate-800 px-1 rounded">.env</code> file with your Supabase credentials.
            <a href="https://supabase.com/dashboard" target="_blank" class="underline hover:text-amber-300">Get credentials →</a>
          </p>
        </div>
      {/if}
    </div>
  </nav>

  <!-- Mobile nav (simplified) -->
  <div class="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl">
    <div class="flex justify-around py-2">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all
            {$page.url.pathname === item.href 
              ? 'text-amber-300' 
              : 'text-slate-500 hover:text-slate-300'}"
        >
          <span class="text-xl">{item.icon}</span>
          <span class="text-xs">{item.label}</span>
        </a>
      {/each}
    </div>
  </div>

  <!-- Main content -->
  <main class="pt-16 pb-20 sm:pb-0">
    <slot />
  </main>
</div>

<style>
  :global(body) {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
</style>
