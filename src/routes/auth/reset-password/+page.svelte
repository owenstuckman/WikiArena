<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
  
  // Accept SvelteKit props to suppress warnings
  export let data: Record<string, unknown> = {};
  import { authStore } from '$lib/stores/auth';
  
  let newPassword = '';
  let confirmPassword = '';
  let error = '';
  let success = false;
  let loading = false;
  let ready = false;
  
  onMount(async () => {
    if (!browser) return;
    
    // Check if we have a valid session from the reset link
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        ready = true;
      } else {
        error = 'Invalid or expired reset link. Please request a new password reset.';
      }
    } else {
      error = 'Database not configured';
    }
  });
  
  async function handleResetPassword() {
    error = '';
    
    if (newPassword.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    loading = true;
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (updateError) throw updateError;
      
      success = true;
      
      // Redirect to home after a delay
      setTimeout(() => {
        goto('/');
      }, 3000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to reset password';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - WikiArena</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-12">
  <div class="w-full max-w-md">
    <div class="arena-card">
      <!-- Header -->
      <div class="text-center mb-6">
        <div class="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-slate-900 text-xl mb-4">
          W
        </div>
        <h1 class="text-xl font-bold">Reset Your Password</h1>
        <p class="text-sm text-slate-400 mt-1">Enter your new password below</p>
      </div>
      
      {#if success}
        <!-- Success State -->
        <div class="text-center py-6">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-emerald-400 mb-2">Password Updated!</h2>
          <p class="text-sm text-slate-400">Your password has been successfully reset. Redirecting you to the home page...</p>
        </div>
        
      {:else if ready}
        <!-- Reset Form -->
        <form on:submit|preventDefault={handleResetPassword} class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">New Password</label>
            <input
              type="password"
              bind:value={newPassword}
              placeholder="Enter new password"
              class="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg
                placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
              required
              minlength="6"
            />
          </div>
          
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">Confirm Password</label>
            <input
              type="password"
              bind:value={confirmPassword}
              placeholder="Confirm new password"
              class="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg
                placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
              required
              minlength="6"
            />
          </div>
          
          {#if error}
            <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p class="text-sm text-red-400">{error}</p>
            </div>
          {/if}
          
          <button
            type="submit"
            class="w-full py-2.5 bg-amber-500 text-slate-900 rounded-lg font-medium
              hover:bg-amber-400 transition-colors disabled:opacity-50"
            disabled={loading || !newPassword || !confirmPassword}
          >
            {#if loading}
              <span class="inline-flex items-center gap-2">
                <div class="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                Updating...
              </span>
            {:else}
              Reset Password
            {/if}
          </button>
        </form>
        
      {:else if error}
        <!-- Error State -->
        <div class="text-center py-6">
          <div class="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p class="text-sm text-red-400 mb-4">{error}</p>
          <a href="/" class="text-sm text-amber-400 hover:text-amber-300">
            Return to Home
          </a>
        </div>
        
      {:else}
        <!-- Loading State -->
        <div class="flex flex-col items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent mb-4"></div>
          <p class="text-sm text-slate-400">Verifying reset link...</p>
        </div>
      {/if}
    </div>
    
    <!-- Back Link -->
    <div class="text-center mt-4">
      <a href="/" class="text-sm text-slate-500 hover:text-slate-300">
        ← Back to WikiArena
      </a>
    </div>
  </div>
</div>
