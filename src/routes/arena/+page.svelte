<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { matchStore, isLoading, canVote, hasError } from '$lib/stores/match';
  import type { VoteWinner } from '$lib/types/database';
  
  let selectedSide: 'a' | 'b' | null = null;

  onMount(() => {
    matchStore.loadMatch();
  });

  onDestroy(() => {
    matchStore.reset();
  });

  function selectSide(side: 'a' | 'b') {
    if ($canVote) {
      selectedSide = selectedSide === side ? null : side;
    }
  }

  async function submitVote(winner: VoteWinner) {
    await matchStore.submitVote(winner);
    selectedSide = null;
  }

  function nextMatch() {
    matchStore.loadMatch();
  }

  // Format rating change for display
  function formatChange(change: number): string {
    const rounded = Math.round(change);
    return rounded >= 0 ? `+${rounded}` : `${rounded}`;
  }
</script>

<svelte:head>
  <title>Arena - Knowledge Arena</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2">⚔️ The Arena</h1>
    <p class="text-slate-400">Compare two knowledge sources. Which explanation do you prefer?</p>
  </div>

  <!-- Error State -->
  {#if $hasError}
    <div class="max-w-md mx-auto">
      <div class="arena-card text-center">
        <div class="text-4xl mb-4">😵</div>
        <h2 class="text-xl font-semibold mb-2">Something went wrong</h2>
        <p class="text-slate-400 mb-6">{$matchStore.error}</p>
        <button 
          class="vote-btn vote-btn-primary"
          on:click={() => matchStore.loadMatch()}
        >
          Try Again
        </button>
      </div>
    </div>
  
  <!-- Loading State -->
  {:else if $isLoading}
    <div class="space-y-6">
      <!-- Topic skeleton -->
      <div class="text-center">
        <div class="skeleton h-8 w-64 mx-auto mb-2"></div>
        <div class="skeleton h-5 w-48 mx-auto"></div>
      </div>
      
      <!-- Cards skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {#each [1, 2] as _}
          <div class="arena-card">
            <div class="skeleton h-6 w-32 mb-4"></div>
            <div class="space-y-3">
              <div class="skeleton h-4 w-full"></div>
              <div class="skeleton h-4 w-full"></div>
              <div class="skeleton h-4 w-3/4"></div>
              <div class="skeleton h-4 w-full"></div>
              <div class="skeleton h-4 w-5/6"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

  <!-- Comparison State -->
  {:else if $matchStore.currentMatch && $matchStore.phase === 'comparing'}
    <div class="space-y-6 animate-fade-in-up">
      <!-- Topic -->
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="text-amber-500">📚</span>
          <span class="font-medium">{$matchStore.currentMatch.topic}</span>
        </div>
      </div>
      
      <!-- Comparison Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Source A (Left) -->
        <button
          class="arena-card text-left cursor-pointer transition-all
            {selectedSide === 'a' ? 'arena-card-selected' : ''}"
          on:click={() => selectSide('a')}
        >
          <div class="flex items-center justify-between mb-4">
            <span class="text-lg font-semibold text-amber-400">Source A</span>
            {#if selectedSide === 'a'}
              <span class="text-sm text-amber-500 flex items-center gap-1">
                ✓ Selected
              </span>
            {/if}
          </div>
          <div class="prose prose-invert prose-sm max-w-none">
            <p class="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {$matchStore.currentMatch.leftContent}
            </p>
          </div>
        </button>

        <!-- Source B (Right) -->
        <button
          class="arena-card text-left cursor-pointer transition-all
            {selectedSide === 'b' ? 'arena-card-selected' : ''}"
          on:click={() => selectSide('b')}
        >
          <div class="flex items-center justify-between mb-4">
            <span class="text-lg font-semibold text-amber-400">Source B</span>
            {#if selectedSide === 'b'}
              <span class="text-sm text-amber-500 flex items-center gap-1">
                ✓ Selected
              </span>
            {/if}
          </div>
          <div class="prose prose-invert prose-sm max-w-none">
            <p class="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {$matchStore.currentMatch.rightContent}
            </p>
          </div>
        </button>
      </div>

      <!-- Vote Buttons -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <button
          class="vote-btn vote-btn-primary w-full sm:w-auto"
          disabled={!$canVote}
          on:click={() => submitVote('a')}
        >
          👈 A is Better
        </button>
        
        <button
          class="vote-btn vote-btn-secondary w-full sm:w-auto"
          disabled={!$canVote}
          on:click={() => submitVote('tie')}
        >
          🤝 It's a Tie
        </button>
        
        <button
          class="vote-btn vote-btn-primary w-full sm:w-auto"
          disabled={!$canVote}
          on:click={() => submitVote('b')}
        >
          B is Better 👉
        </button>
      </div>

      <div class="text-center">
        <button
          class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          on:click={() => submitVote('both_bad')}
        >
          😕 Both are bad
        </button>
      </div>
    </div>

  <!-- Revealing / Complete State -->
  {:else if $matchStore.voteResult && ($matchStore.phase === 'revealing' || $matchStore.phase === 'complete')}
    {@const result = $matchStore.voteResult}
    {@const match = $matchStore.currentMatch}
    
    <div class="space-y-6 animate-fade-in-up">
      <!-- Topic -->
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="text-amber-500">📚</span>
          <span class="font-medium">{match?.topic}</span>
        </div>
      </div>

      <!-- Revealed Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Source A -->
        {@const sourceADisplay = match?.sourceAPosition === 1 ? result.reveal.sourceA : result.reveal.sourceB}
        {@const sourceARatings = match?.sourceAPosition === 1 ? result.ratings.sourceA : result.ratings.sourceB}
        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📖</span>
              <div>
                <div class="font-semibold text-lg">{sourceADisplay.name}</div>
                <div class="text-sm text-slate-500">Source A</div>
              </div>
            </div>
            <div class="rating-badge {sourceARatings.change >= 0 ? 'rating-badge-positive' : 'rating-badge-negative'}">
              {formatChange(sourceARatings.change)}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            Rating: {Math.round(sourceARatings.before)} → 
            <span class="font-semibold text-slate-200">{Math.round(sourceARatings.after)}</span>
          </div>
        </div>

        <!-- Source B -->
        {@const sourceBDisplay = match?.sourceAPosition === 1 ? result.reveal.sourceB : result.reveal.sourceA}
        {@const sourceBRatings = match?.sourceAPosition === 1 ? result.ratings.sourceB : result.ratings.sourceA}
        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📖</span>
              <div>
                <div class="font-semibold text-lg">{sourceBDisplay.name}</div>
                <div class="text-sm text-slate-500">Source B</div>
              </div>
            </div>
            <div class="rating-badge {sourceBRatings.change >= 0 ? 'rating-badge-positive' : 'rating-badge-negative'}">
              {formatChange(sourceBRatings.change)}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            Rating: {Math.round(sourceBRatings.before)} → 
            <span class="font-semibold text-slate-200">{Math.round(sourceBRatings.after)}</span>
          </div>
        </div>
      </div>

      <!-- Vote Summary -->
      <div class="text-center">
        <p class="text-slate-400 mb-6">
          You voted: 
          <span class="font-semibold text-amber-400">
            {#if result.vote.winner === 'a'}
              Source A ({match?.sourceAPosition === 1 ? result.reveal.sourceA.name : result.reveal.sourceB.name})
            {:else if result.vote.winner === 'b'}
              Source B ({match?.sourceAPosition === 1 ? result.reveal.sourceB.name : result.reveal.sourceA.name})
            {:else if result.vote.winner === 'tie'}
              Tie
            {:else}
              Both Bad
            {/if}
          </span>
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            class="vote-btn vote-btn-primary"
            on:click={nextMatch}
          >
            Next Match →
          </button>
          <a href="/leaderboard" class="vote-btn vote-btn-secondary">
            View Leaderboard
          </a>
        </div>
      </div>

      <!-- Stats -->
      <div class="text-center text-sm text-slate-500">
        Matches completed this session: {$matchStore.matchCount}
      </div>
    </div>

  <!-- Voting State (Loading indicator) -->
  {:else if $matchStore.phase === 'voting'}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
      <p class="text-slate-400">Recording your vote...</p>
    </div>
  {/if}
</div>

<style>
  .prose p {
    margin: 0;
  }
</style>
