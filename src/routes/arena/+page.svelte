<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
  import { getWikipediaContent } from '$lib/services/wikipedia';
  import { calculateMatchOutcome, createRating } from '$lib/services/glicko2';
  import { DEMO_SOURCES, DEMO_TOPICS, getDemoContent } from '$lib/services/demo';
  import type { Source, Topic, VoteWinner } from '$lib/types/database';

  // Types
  type MatchPhase = 'idle' | 'loading' | 'comparing' | 'voting' | 'revealing' | 'complete';

  interface ArenaMatch {
    id: string;
    topic: string;
    topicSlug: string;
    leftContent: string;
    rightContent: string;
    sourceA: Source;
    sourceB: Source;
    sourceAPosition: number;
  }

  interface VoteResult {
    winner: VoteWinner;
    sourceA: Source;
    sourceB: Source;
    ratingChangeA: number;
    ratingChangeB: number;
    newRatingA: number;
    newRatingB: number;
  }

  // State
  let phase: MatchPhase = 'idle';
  let currentMatch: ArenaMatch | null = null;
  let voteResult: VoteResult | null = null;
  let selectedSide: 'a' | 'b' | null = null;
  let error: string | null = null;
  let matchCount = 0;
  let voteStartTime: number = 0;

  // Sources and topics
  let sources: Source[] = [];
  let topics: Topic[] = [];

  onMount(async () => {
    await loadSourcesAndTopics();
    await loadMatch();
  });

  async function loadSourcesAndTopics() {
    if (isSupabaseConfigured && supabase) {
      try {
        const [sourcesRes, topicsRes] = await Promise.all([
          supabase.from('sources').select('*').eq('is_active', true),
          supabase.from('topics').select('*').eq('is_active', true),
        ]);

        if (sourcesRes.data && sourcesRes.data.length >= 2) {
          sources = sourcesRes.data;
        } else {
          sources = DEMO_SOURCES;
        }

        if (topicsRes.data && topicsRes.data.length > 0) {
          topics = topicsRes.data;
        } else {
          topics = DEMO_TOPICS;
        }
      } catch (e) {
        console.warn('Failed to load from Supabase, using demo data:', e);
        sources = DEMO_SOURCES;
        topics = DEMO_TOPICS;
      }
    } else {
      sources = DEMO_SOURCES;
      topics = DEMO_TOPICS;
    }
  }

  async function loadMatch() {
    phase = 'loading';
    error = null;
    voteResult = null;
    selectedSide = null;

    try {
      if (sources.length < 2 || topics.length === 0) {
        await loadSourcesAndTopics();
      }

      const topic = topics[Math.floor(Math.random() * topics.length)];
      const shuffledSources = [...sources].sort(() => Math.random() - 0.5);
      const sourceA = shuffledSources[0];
      const sourceB = shuffledSources[1];
      const sourceAPosition = Math.random() > 0.5 ? 1 : 2;

      let contentA: string;
      let contentB: string;

      // Fetch Wikipedia content for Wikipedia source
      if (sourceA.slug === 'wikipedia') {
        try {
          contentA = await getWikipediaContent(topic.title);
        } catch {
          contentA = getDemoContent(topic.slug, 'wikipedia');
        }
      } else {
        contentA = getDemoContent(topic.slug, sourceA.slug);
      }

      if (sourceB.slug === 'wikipedia') {
        try {
          contentB = await getWikipediaContent(topic.title);
        } catch {
          contentB = getDemoContent(topic.slug, 'wikipedia');
        }
      } else {
        contentB = getDemoContent(topic.slug, sourceB.slug);
      }

      currentMatch = {
        id: `match-${Date.now()}`,
        topic: topic.title,
        topicSlug: topic.slug,
        leftContent: sourceAPosition === 1 ? contentA : contentB,
        rightContent: sourceAPosition === 1 ? contentB : contentA,
        sourceA,
        sourceB,
        sourceAPosition,
      };

      voteStartTime = Date.now();
      phase = 'comparing';

    } catch (e) {
      console.error('Failed to load match:', e);
      error = e instanceof Error ? e.message : 'Failed to load match';
      phase = 'idle';
    }
  }

  function selectSide(side: 'a' | 'b') {
    if (phase === 'comparing') {
      selectedSide = selectedSide === side ? null : side;
    }
  }

  async function submitVote(winner: VoteWinner) {
    if (!currentMatch || phase !== 'comparing') return;

    phase = 'voting';
    const timeToVote = Date.now() - voteStartTime;

    try {
      const match = currentMatch;

      // Determine actual winner based on display position
      let actualWinnerSource: 'sourceA' | 'sourceB' | 'tie' = 'tie';
      
      if (winner === 'a') {
        actualWinnerSource = match.sourceAPosition === 1 ? 'sourceA' : 'sourceB';
      } else if (winner === 'b') {
        actualWinnerSource = match.sourceAPosition === 1 ? 'sourceB' : 'sourceA';
      }

      // Calculate Glicko-2 rating changes
      const glickoWinner: 'a' | 'b' | 'tie' = 
        actualWinnerSource === 'sourceA' ? 'a' : 
        actualWinnerSource === 'sourceB' ? 'b' : 'tie';

      const ratingA = createRating(match.sourceA.rating, match.sourceA.rating_deviation, match.sourceA.volatility);
      const ratingB = createRating(match.sourceB.rating, match.sourceB.rating_deviation, match.sourceB.volatility);
      
      const outcome = calculateMatchOutcome(ratingA, ratingB, glickoWinner);

      // Save to Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const sessionId = getSessionId();

          // Create match record
          const { data: matchData } = await supabase
            .from('matches')
            .insert({
              topic_query: match.topic,
              source_a_id: match.sourceA.id,
              source_b_id: match.sourceB.id,
              source_a_content: match.sourceAPosition === 1 ? match.leftContent : match.rightContent,
              source_b_content: match.sourceAPosition === 1 ? match.rightContent : match.leftContent,
              source_a_position: match.sourceAPosition,
              status: 'completed',
            })
            .select()
            .single();

          if (matchData) {
            // Record vote
            await supabase.from('votes').insert({
              match_id: matchData.id,
              session_id: sessionId,
              winner: actualWinnerSource === 'sourceA' ? 'a' : actualWinnerSource === 'sourceB' ? 'b' : winner,
              source_a_rating_before: match.sourceA.rating,
              source_a_rating_after: outcome.newRatingA.mu,
              source_b_rating_before: match.sourceB.rating,
              source_b_rating_after: outcome.newRatingB.mu,
              time_to_vote_ms: timeToVote,
            });

            // Update source ratings
            await Promise.all([
              supabase.from('sources').update({
                rating: outcome.newRatingA.mu,
                rating_deviation: outcome.newRatingA.phi,
                volatility: outcome.newRatingA.sigma,
                total_matches: match.sourceA.total_matches + 1,
                total_wins: match.sourceA.total_wins + (actualWinnerSource === 'sourceA' ? 1 : 0),
                total_losses: match.sourceA.total_losses + (actualWinnerSource === 'sourceB' ? 1 : 0),
                total_ties: match.sourceA.total_ties + (actualWinnerSource === 'tie' ? 1 : 0),
              }).eq('id', match.sourceA.id),
              
              supabase.from('sources').update({
                rating: outcome.newRatingB.mu,
                rating_deviation: outcome.newRatingB.phi,
                volatility: outcome.newRatingB.sigma,
                total_matches: match.sourceB.total_matches + 1,
                total_wins: match.sourceB.total_wins + (actualWinnerSource === 'sourceB' ? 1 : 0),
                total_losses: match.sourceB.total_losses + (actualWinnerSource === 'sourceA' ? 1 : 0),
                total_ties: match.sourceB.total_ties + (actualWinnerSource === 'tie' ? 1 : 0),
              }).eq('id', match.sourceB.id),
            ]);
          }
        } catch (e) {
          console.warn('Failed to save to Supabase:', e);
        }
      }

      // Set vote result for display
      voteResult = {
        winner,
        sourceA: match.sourceA,
        sourceB: match.sourceB,
        ratingChangeA: outcome.changeA,
        ratingChangeB: outcome.changeB,
        newRatingA: outcome.newRatingA.mu,
        newRatingB: outcome.newRatingB.mu,
      };

      matchCount++;
      phase = 'revealing';

      // Auto-transition to complete
      setTimeout(() => {
        phase = 'complete';
      }, 2000);

    } catch (e) {
      console.error('Failed to submit vote:', e);
      error = e instanceof Error ? e.message : 'Failed to submit vote';
      phase = 'comparing';
    }
  }

  function nextMatch() {
    loadMatch();
  }

  function formatRatingChange(change: number): string {
    const rounded = Math.round(change);
    return rounded >= 0 ? `+${rounded}` : `${rounded}`;
  }

  function getSourceEmoji(slug: string): string {
    return slug === 'wikipedia' ? '📚' : '🤖';
  }
</script>

<svelte:head>
  <title>Arena - Knowledge Arena</title>
  <meta name="description" content="Compare knowledge sources head-to-head in the arena" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2">⚔️ The Arena</h1>
    <p class="text-slate-400">Compare two knowledge sources. Which explanation do you prefer?</p>
    {#if !isSupabaseConfigured}
      <p class="text-xs text-amber-500 mt-2">Demo Mode • Votes won't be saved</p>
    {/if}
  </div>

  {#if error}
    <div class="max-w-md mx-auto">
      <div class="arena-card text-center">
        <div class="text-4xl mb-4">😵</div>
        <h2 class="text-xl font-semibold mb-2">Something went wrong</h2>
        <p class="text-slate-400 mb-6">{error}</p>
        <button class="vote-btn vote-btn-primary" on:click={loadMatch}>
          Try Again
        </button>
      </div>
    </div>

  {:else if phase === 'loading'}
    <div class="space-y-6 animate-pulse">
      <div class="text-center">
        <div class="inline-block h-8 w-64 bg-slate-800 rounded-full"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {#each [1, 2] as _}
          <div class="arena-card">
            <div class="h-6 w-32 bg-slate-800 rounded mb-4"></div>
            <div class="space-y-3">
              <div class="h-4 w-full bg-slate-800 rounded"></div>
              <div class="h-4 w-full bg-slate-800 rounded"></div>
              <div class="h-4 w-3/4 bg-slate-800 rounded"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

  {:else if phase === 'comparing' && currentMatch}
    <div class="space-y-6">
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="text-amber-500">📚</span>
          <span class="font-medium">{currentMatch.topic}</span>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <button
          class="arena-card text-left cursor-pointer transition-all duration-200 hover:border-slate-600/50
            {selectedSide === 'a' ? 'ring-2 ring-amber-500/50 border-amber-500/50' : ''}"
          on:click={() => selectSide('a')}
        >
          <div class="flex items-center justify-between mb-4">
            <span class="text-lg font-semibold text-amber-400">Source A</span>
            {#if selectedSide === 'a'}
              <span class="text-sm text-amber-500">✓ Selected</span>
            {/if}
          </div>
          <div class="prose prose-invert prose-sm max-w-none">
            <p class="text-slate-300 whitespace-pre-wrap leading-relaxed">{currentMatch.leftContent}</p>
          </div>
        </button>

        <button
          class="arena-card text-left cursor-pointer transition-all duration-200 hover:border-slate-600/50
            {selectedSide === 'b' ? 'ring-2 ring-amber-500/50 border-amber-500/50' : ''}"
          on:click={() => selectSide('b')}
        >
          <div class="flex items-center justify-between mb-4">
            <span class="text-lg font-semibold text-amber-400">Source B</span>
            {#if selectedSide === 'b'}
              <span class="text-sm text-amber-500">✓ Selected</span>
            {/if}
          </div>
          <div class="prose prose-invert prose-sm max-w-none">
            <p class="text-slate-300 whitespace-pre-wrap leading-relaxed">{currentMatch.rightContent}</p>
          </div>
        </button>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <button class="vote-btn vote-btn-primary w-full sm:w-auto" on:click={() => submitVote('a')}>
          👈 A is Better
        </button>
        <button class="vote-btn vote-btn-secondary w-full sm:w-auto" on:click={() => submitVote('tie')}>
          🤝 It's a Tie
        </button>
        <button class="vote-btn vote-btn-primary w-full sm:w-auto" on:click={() => submitVote('b')}>
          B is Better 👉
        </button>
      </div>

      <div class="text-center">
        <button class="text-sm text-slate-500 hover:text-slate-300 transition-colors" on:click={() => submitVote('both_bad')}>
          😕 Both are bad
        </button>
      </div>
    </div>

  {:else if phase === 'voting'}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
      <p class="text-slate-400">Recording your vote...</p>
    </div>

  {:else if (phase === 'revealing' || phase === 'complete') && currentMatch && voteResult}
    {@const leftSource = currentMatch.sourceAPosition === 1 ? voteResult.sourceA : voteResult.sourceB}
    {@const leftChange = currentMatch.sourceAPosition === 1 ? voteResult.ratingChangeA : voteResult.ratingChangeB}
    {@const leftNewRating = currentMatch.sourceAPosition === 1 ? voteResult.newRatingA : voteResult.newRatingB}
    {@const leftOldRating = currentMatch.sourceAPosition === 1 ? voteResult.sourceA.rating : voteResult.sourceB.rating}
    {@const rightSource = currentMatch.sourceAPosition === 1 ? voteResult.sourceB : voteResult.sourceA}
    {@const rightChange = currentMatch.sourceAPosition === 1 ? voteResult.ratingChangeB : voteResult.ratingChangeA}
    {@const rightNewRating = currentMatch.sourceAPosition === 1 ? voteResult.newRatingB : voteResult.newRatingA}
    {@const rightOldRating = currentMatch.sourceAPosition === 1 ? voteResult.sourceB.rating : voteResult.sourceA.rating}
    
    <div class="space-y-6">
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="text-amber-500">📚</span>
          <span class="font-medium">{currentMatch.topic}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{getSourceEmoji(leftSource.slug)}</span>
              <div>
                <div class="font-semibold text-lg">{leftSource.name}</div>
                <div class="text-sm text-slate-500">Source A</div>
              </div>
            </div>
            <div class="rating-badge {leftChange >= 0 ? 'rating-badge-positive' : 'rating-badge-negative'}">
              {formatRatingChange(leftChange)}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            Rating: {Math.round(leftOldRating)} → <span class="font-semibold text-slate-200">{Math.round(leftNewRating)}</span>
          </div>
        </div>

        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{getSourceEmoji(rightSource.slug)}</span>
              <div>
                <div class="font-semibold text-lg">{rightSource.name}</div>
                <div class="text-sm text-slate-500">Source B</div>
              </div>
            </div>
            <div class="rating-badge {rightChange >= 0 ? 'rating-badge-positive' : 'rating-badge-negative'}">
              {formatRatingChange(rightChange)}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            Rating: {Math.round(rightOldRating)} → <span class="font-semibold text-slate-200">{Math.round(rightNewRating)}</span>
          </div>
        </div>
      </div>

      <div class="text-center">
        <p class="text-slate-400 mb-6">
          You voted: 
          <span class="font-semibold text-amber-400">
            {#if voteResult.winner === 'a'}
              Source A ({leftSource.name})
            {:else if voteResult.winner === 'b'}
              Source B ({rightSource.name})
            {:else if voteResult.winner === 'tie'}
              Tie
            {:else}
              Both Bad
            {/if}
          </span>
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button class="vote-btn vote-btn-primary" on:click={nextMatch}>
            Next Match →
          </button>
          <a href="/leaderboard" class="vote-btn vote-btn-secondary">
            View Leaderboard
          </a>
        </div>
      </div>

      <div class="text-center text-sm text-slate-500">
        Matches completed this session: {matchCount}
      </div>
    </div>

  {:else}
    <div class="text-center py-20">
      <div class="text-6xl mb-6">⚔️</div>
      <h2 class="text-2xl font-bold mb-4">Ready to Compare?</h2>
      <p class="text-slate-400 mb-8">Click below to start comparing knowledge sources</p>
      <button class="vote-btn vote-btn-primary" on:click={loadMatch}>
        Start Arena
      </button>
    </div>
  {/if}
</div>

<style>
  .prose p {
    margin: 0;
  }
</style>
