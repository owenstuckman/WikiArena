<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore, authError, authLoading } from '$lib/stores/auth';
  import { isSupabaseConfigured } from '$lib/supabaseClient';
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let mode: 'signin' | 'signup' | 'reset' = 'signin';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let message = '';
  
  function close() {
    open = false;
    email = '';
    password = '';
    confirmPassword = '';
    message = '';
    authStore.clearError();
    dispatch('close');
  }
  
  async function handleSubmit() {
    message = '';
    
    if (mode === 'signup' && password !== confirmPassword) {
      message = 'Passwords do not match';
      return;
    }
    
    if (mode === 'signin') {
      const result = await authStore.signIn(email, password);
      if (!result.error) {
        close();
        dispatch('success');
      }
    } else if (mode === 'signup') {
      const result = await authStore.signUp(email, password);
      if (!result.error) {
        if (result.needsConfirmation) {
          message = 'Check your email to confirm your account';
          mode = 'signin';
        } else {
          close();
          dispatch('success');
        }
      }
    } else if (mode === 'reset') {
      const result = await authStore.resetPassword(email);
      if (!result.error) {
        message = 'Check your email for password reset instructions';
        mode = 'signin';
      }
    }
  }
  
  function switchMode(newMode: 'signin' | 'signup' | 'reset') {
    mode = newMode;
    message = '';
    authStore.clearError();
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click={close}
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="-1"
  >
    <!-- Modal -->
    <div 
      class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold">
          {#if mode === 'signin'}
            Sign In
          {:else if mode === 'signup'}
            Create Account
          {:else}
            Reset Password
          {/if}
        </h2>
        <button 
          class="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          on:click={close}
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {#if !isSupabaseConfigured}
        <div class="text-center py-8">
          <div class="text-4xl mb-4">⚠️</div>
          <p class="text-slate-400 mb-4">
            Database not configured. Authentication requires a Supabase connection.
          </p>
          <p class="text-sm text-slate-500">
            Add your Supabase credentials to the .env file to enable authentication.
          </p>
        </div>
      {:else}
        <!-- Form -->
        <form on:submit|preventDefault={handleSubmit} class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>
          
          {#if mode !== 'reset'}
            <div>
              <label for="password" class="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                bind:value={password}
                required
                minlength="6"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          {/if}
          
          {#if mode === 'signup'}
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                bind:value={confirmPassword}
                required
                minlength="6"
                class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          {/if}
          
          <!-- Error/Message -->
          {#if $authError}
            <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {$authError}
            </div>
          {/if}
          
          {#if message}
            <div class="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              {message}
            </div>
          {/if}
          
          <!-- Submit Button -->
          <button
            type="submit"
            disabled={$authLoading}
            class="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if $authLoading}
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            {:else if mode === 'signin'}
              Sign In
            {:else if mode === 'signup'}
              Create Account
            {:else}
              Send Reset Email
            {/if}
          </button>
        </form>
        
        <!-- Mode Switches -->
        <div class="mt-6 pt-6 border-t border-slate-800 text-center text-sm">
          {#if mode === 'signin'}
            <p class="text-slate-400">
              Don't have an account?
              <button 
                class="text-amber-400 hover:text-amber-300 font-medium ml-1"
                on:click={() => switchMode('signup')}
              >
                Sign up
              </button>
            </p>
            <button 
              class="text-slate-500 hover:text-slate-400 mt-2"
              on:click={() => switchMode('reset')}
            >
              Forgot password?
            </button>
          {:else if mode === 'signup'}
            <p class="text-slate-400">
              Already have an account?
              <button 
                class="text-amber-400 hover:text-amber-300 font-medium ml-1"
                on:click={() => switchMode('signin')}
              >
                Sign in
              </button>
            </p>
          {:else}
            <button 
              class="text-amber-400 hover:text-amber-300 font-medium"
              on:click={() => switchMode('signin')}
            >
              Back to sign in
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
