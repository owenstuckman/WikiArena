<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { isSupabaseConfigured } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import ProfileDropdown from '$lib/components/ProfileDropdown.svelte';
  
  // Accept SvelteKit props to suppress warnings
  export let data: Record<string, unknown> = {};
  
  let mounted = false;
  let showAuthModal = false;
  let mobileMenuOpen = false;
  let profileDropdownOpen = false;
  
  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/arena', label: 'Arena' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/blend', label: 'Blender' },
    { href: '/history', label: 'History' },
    { href: '/faq', label: 'FAQ' },
  ];
  
  onMount(async () => {
    mounted = true;
    if (browser) {
      await authStore.init();
    }
  });
</script>

<AuthModal bind:open={showAuthModal} />

<div class="min-h-screen bg-slate-950 text-slate-100">
  <!-- Navigation -->
  <nav class="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-14 items-center justify-between">
        <!-- Logo -->
        <a href="/" class="flex items-center gap-2 group">
          <img 
            src="/logo.png" 
            alt="WikiArena" 
            class="w-9 h-9 object-contain"
          />
          <span class="text-lg font-semibold text-slate-100">
            WikiArena
          </span>
        </a>

        <!-- Nav Links -->
        <div class="hidden md:flex items-center gap-1">
          {#each navItems as item}
            <a
              href={item.href}
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-all
                {$page.url.pathname === item.href 
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
            >
              {item.label}
            </a>
          {/each}
        </div>

        <!-- Auth Section -->
        <div class="hidden sm:flex items-center gap-2">
          {#if $isAuthenticated}
            <ProfileDropdown bind:open={profileDropdownOpen} />
          {:else}
            <button
              class="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              on:click={() => showAuthModal = true}
            >
              Sign in
            </button>
            <button
              class="px-3 py-1.5 text-sm font-medium bg-amber-500 text-slate-900 rounded-md hover:bg-amber-400 transition-colors"
              on:click={() => showAuthModal = true}
            >
              Sign up
            </button>
          {/if}
        </div>

        <!-- Mobile menu button -->
        <button 
          class="md:hidden p-2 rounded-md hover:bg-slate-800 text-slate-400"
          on:click={() => mobileMenuOpen = !mobileMenuOpen}
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {#if mobileMenuOpen}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            {/if}
          </svg>
        </button>
      </div>
      
      <!-- Connection Status Banner -->
      {#if mounted && !isSupabaseConfigured}
        <div class="bg-amber-500/10 border-t border-amber-500/20 px-4 py-1.5">
          <p class="text-xs text-amber-400/80 text-center">
            Demo Mode — Database not connected
          </p>
        </div>
      {/if}
    </div>
  </nav>

  <!-- Mobile nav dropdown -->
  {#if mobileMenuOpen}
    <div class="md:hidden fixed top-14 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800">
      <div class="px-4 py-3 space-y-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="block px-3 py-2 rounded-md text-sm transition-all
              {$page.url.pathname === item.href 
                ? 'bg-slate-800 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
            on:click={() => mobileMenuOpen = false}
          >
            {item.label}
          </a>
        {/each}
        
        <div class="pt-2 mt-2 border-t border-slate-800">
          {#if $isAuthenticated}
            <!-- Mobile Profile Section -->
            <div class="px-3 py-2 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-900 font-semibold text-sm">
                {($currentUser?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-200 truncate">
                  {$currentUser?.email?.split('@')[0]}
                </div>
                <div class="text-xs text-slate-500 truncate">
                  {$currentUser?.email}
                </div>
              </div>
            </div>
            
            <a
              href="/history"
              class="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white"
              on:click={() => mobileMenuOpen = false}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Vote History
            </a>
            
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300"
              on:click={() => { authStore.signOut(); mobileMenuOpen = false; }}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          {:else}
            <button
              class="w-full text-left px-3 py-2 text-sm text-amber-400 hover:text-amber-300"
              on:click={() => { showAuthModal = true; mobileMenuOpen = false; }}
            >
              Sign in / Sign up
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Main content -->
  <main class="pt-14 min-h-screen">
    <slot />
  </main>
  
  <!-- Footer -->
  <footer class="border-t border-slate-800/50">
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-slate-500 text-sm">
          <div class="w-5 h-5 rounded bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-slate-900 text-xs">W</div>
          <span>WikiArena</span>
        </div>
        <div class="text-xs text-slate-600">
          Compare knowledge sources with Glicko-2 ratings
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
</style>
