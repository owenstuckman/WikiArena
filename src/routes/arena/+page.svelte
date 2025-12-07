<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import { 
    searchWikipedia, 
    fetchContentFromSource, 
    getSourceLogo,
    getSourceColor,
    type SourceSlug,
    type SourceContent 
  } from '$lib/services/content';
  import { getRandomTopic, getRandomCuratedTopic } from '$lib/services/topics';
  import { calculateMatchOutcome, createRating } from '$lib/services/glicko2';
  import { 
    assessQuality, 
    formatQualityScore, 
    formatShapleyValue,
    getQualityTier,
    type QualityAssessment,
    type SourceQuality
  } from '$lib/services/shapley';
  import type { Source, VoteWinner } from '$lib/types/database';

  // Types
  type ArenaPhase = 'search' | 'loading' | 'comparing' | 'voting' | 'revealing' | 'complete';

  interface SourceDisplay {
    source: Source;
    content: SourceContent;
    position: 'left' | 'right';
  }

  interface VoteResult {
    winner: VoteWinner;
    leftSource: Source;
    rightSource: Source;
    leftRatingChange: number;
    rightRatingChange: number;
    leftNewRating: number;
    rightNewRating: number;
  }

  // State
  let phase: ArenaPhase = 'search';
  let searchQuery = '';
  let searchResults: { title: string; description: string }[] = [];
  let isSearching = false;
  let currentTopic = '';
  let sources: Source[] = [];
  let leftDisplay: SourceDisplay | null = null;
  let rightDisplay: SourceDisplay | null = null;
  let voteResult: VoteResult | null = null;
  let error: string | null = null;
  let matchCount = 0;
  let voteStartTime = 0;
  let showAuthModal = false;
  let contentExpanded = { left: false, right: false };
  let isLoadingRandomTopic = false;
  
  // Quality assessment
  let qualityAssessment: QualityAssessment | null = null;
  let leftQuality: SourceQuality | null = null;
  let rightQuality: SourceQuality | null = null;
  
  // Link toast
  let showLinkToast = false;
  let linkToastTimeout: ReturnType<typeof setTimeout>;

  // Content truncation settings
  const TRUNCATE_LENGTH = 2000;

  // Search debounce
  let searchTimeout: ReturnType<typeof setTimeout>;

  onMount(async () => {
    await authStore.init();
    await loadSources();
  });

  // Helper function to get logo URL (avoids TypeScript 'as' in template)
  function getLogo(slug: string): string {
    return getSourceLogo(slug as SourceSlug);
  }

  function getColor(slug: string): string {
    return getSourceColor(slug as SourceSlug);
  }

  async function loadSources() {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('sources')
        .select('*')
        .eq('is_active', true);
      if (data && data.length >= 2) {
        sources = data;
      }
    }
    
    // Fallback to demo sources if needed
    if (sources.length < 2) {
      sources = [
        { id: 'demo-wiki', name: 'Wikipedia', slug: 'wikipedia', description: 'The free encyclopedia', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-grok', name: 'Grokipedia', slug: 'grokipedia', description: 'AI-powered knowledge', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-brit', name: 'Encyclopedia Britannica', slug: 'britannica', description: 'Trusted since 1768', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
      ];
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      isSearching = true;
      try {
        searchResults = await searchWikipedia(searchQuery, 8);
      } catch (e) {
        console.error('Search error:', e);
        searchResults = [];
      }
      isSearching = false;
    }, 300);
  }

  async function selectTopic(topic: string) {
    currentTopic = topic;
    searchQuery = '';
    searchResults = [];
    await loadComparison(topic);
  }

  async function loadRandomTopic() {
    isLoadingRandomTopic = true;
    error = null;
    
    try {
      // Get a truly random topic from Wikipedia or curated list
      const topic = await getRandomTopic();
      currentTopic = topic;
      await loadComparison(topic);
    } catch (e) {
      console.error('Random topic error:', e);
      // Fall back to curated topic
      const fallbackTopic = getRandomCuratedTopic();
      currentTopic = fallbackTopic;
      await loadComparison(fallbackTopic);
    } finally {
      isLoadingRandomTopic = false;
    }
  }

  async function loadComparison(topic: string) {
    phase = 'loading';
    error = null;
    voteResult = null;
    contentExpanded = { left: false, right: false };

    try {
      // Shuffle sources and try to find two with valid content
      const shuffled = [...sources].sort(() => Math.random() - 0.5);
      const validSources: { source: typeof sources[0]; content: SourceContent }[] = [];
      
      // Try to fetch content from each source until we have 2 valid ones
      for (const source of shuffled) {
        if (validSources.length >= 2) break;
        
        try {
          const content = await fetchContentFromSource(topic, source.slug as SourceSlug);
          if (content && content.content && content.content.length > 100) {
            validSources.push({ source, content });
          }
        } catch (e) {
          console.warn(`Failed to fetch from ${source.name}:`, e);
        }
      }

      if (validSources.length < 2) {
        throw new Error('Could not find enough sources with content for this topic. Try a different topic.');
      }

      // Randomize positions
      const aOnLeft = Math.random() > 0.5;
      const [first, second] = validSources;
      
      leftDisplay = {
        source: aOnLeft ? first.source : second.source,
        content: aOnLeft ? first.content : second.content,
        position: 'left',
      };
      
      rightDisplay = {
        source: aOnLeft ? second.source : first.source,
        content: aOnLeft ? second.content : first.content,
        position: 'right',
      };

      voteStartTime = Date.now();
      phase = 'comparing';
    } catch (e) {
      console.error('Load comparison error:', e);
      error = e instanceof Error ? e.message : 'Failed to load comparison';
      phase = 'search';
    }
  }

  async function submitVote(winner: VoteWinner) {
    if (!leftDisplay || !rightDisplay || phase !== 'comparing') return;

    phase = 'voting';
    const timeToVote = Date.now() - voteStartTime;

    try {
      const leftSource = leftDisplay.source;
      const rightSource = rightDisplay.source;

      // Calculate Glicko-2 rating changes
      let glickoWinner: 'a' | 'b' | 'tie' = 'tie';
      if (winner === 'a') glickoWinner = 'a';
      else if (winner === 'b') glickoWinner = 'b';

      const ratingLeft = createRating(leftSource.rating, leftSource.rating_deviation, leftSource.volatility);
      const ratingRight = createRating(rightSource.rating, rightSource.rating_deviation, rightSource.volatility);
      const outcome = calculateMatchOutcome(ratingLeft, ratingRight, glickoWinner);

      // Submit to database using RPC function
      if (isSupabaseConfigured) {
        const sessionId = getSessionId();
        const userId = $currentUser?.id || null;

        const { data, error: rpcError } = await supabase.rpc('submit_vote', {
          p_topic_query: currentTopic,
          p_source_a_id: leftSource.id,
          p_source_b_id: rightSource.id,
          p_source_a_content: leftDisplay.content.content.substring(0, 5000),
          p_source_b_content: rightDisplay.content.content.substring(0, 5000),
          p_source_a_position: 1,
          p_winner: winner,
          p_session_id: sessionId,
          p_user_id: userId,
          p_time_to_vote_ms: timeToVote,
          p_new_rating_a: outcome.newRatingA.mu,
          p_new_rating_b: outcome.newRatingB.mu,
          p_new_rd_a: outcome.newRatingA.phi,
          p_new_rd_b: outcome.newRatingB.phi,
          p_new_vol_a: outcome.newRatingA.sigma,
          p_new_vol_b: outcome.newRatingB.sigma,
        });

        if (rpcError) {
          console.error('Vote submission error:', rpcError);
        }
      }

      // Set vote result
      voteResult = {
        winner,
        leftSource,
        rightSource,
        leftRatingChange: outcome.changeA,
        rightRatingChange: outcome.changeB,
        leftNewRating: outcome.newRatingA.mu,
        rightNewRating: outcome.newRatingB.mu,
      };

      matchCount++;
      phase = 'revealing';
      
      // Calculate quality metrics now that voting is complete
      calculateQualityMetrics();

      // Auto-transition to complete
      setTimeout(() => {
        phase = 'complete';
      }, 2000);
    } catch (e) {
      console.error('Vote error:', e);
      error = e instanceof Error ? e.message : 'Vote submission failed';
      phase = 'comparing';
    }
  }

  function formatRatingChange(change: number): string {
    const rounded = Math.round(change);
    return rounded >= 0 ? `+${rounded}` : `${rounded}`;
  }

  function getDisplayContent(content: string, expanded: boolean): string {
    if (expanded || content.length <= TRUNCATE_LENGTH) {
      return content;
    }
    let truncated = content.substring(0, TRUNCATE_LENGTH);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    const lastSentence = truncated.lastIndexOf('. ');
    
    if (lastParagraph > TRUNCATE_LENGTH * 0.7) {
      truncated = content.substring(0, lastParagraph);
    } else if (lastSentence > TRUNCATE_LENGTH * 0.7) {
      truncated = content.substring(0, lastSentence + 1);
    }
    
    return truncated + '\n\n...';
  }

  function startNewComparison() {
    phase = 'search';
    currentTopic = '';
    leftDisplay = null;
    rightDisplay = null;
    voteResult = null;
    qualityAssessment = null;
    leftQuality = null;
    rightQuality = null;
  }

  function handleLinkClick(e: CustomEvent<{ href: string }>) {
    // Show toast message
    clearTimeout(linkToastTimeout);
    showLinkToast = true;
    linkToastTimeout = setTimeout(() => {
      showLinkToast = false;
    }, 3000);
  }

  function calculateQualityMetrics() {
    if (!leftDisplay || !rightDisplay) return;
    
    // Get global ratings for expected value calculation
    const globalRatings: Record<string, { rating: number; winRate: number }> = {};
    for (const source of sources) {
      const winRate = source.total_matches > 0 
        ? (source.total_wins / source.total_matches) * 100 
        : 50;
      globalRatings[source.slug] = {
        rating: source.rating,
        winRate,
      };
    }
    
    // Assess quality
    qualityAssessment = assessQuality([
      {
        sourceId: leftDisplay.source.id,
        sourceName: leftDisplay.source.name,
        sourceSlug: leftDisplay.source.slug,
        content: leftDisplay.content.content,
      },
      {
        sourceId: rightDisplay.source.id,
        sourceName: rightDisplay.source.name,
        sourceSlug: rightDisplay.source.slug,
        content: rightDisplay.content.content,
      },
    ], globalRatings);
    
    // Assign to left/right
    leftQuality = qualityAssessment.sources.find(s => s.sourceId === leftDisplay!.source.id) || null;
    rightQuality = qualityAssessment.sources.find(s => s.sourceId === rightDisplay!.source.id) || null;
  }
</script>

<svelte:head>
  <title>Arena - WikiArena</title>
</svelte:head>

<AuthModal bind:open={showAuthModal} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">The Arena</h1>
    <p class="text-slate-400 text-sm">Compare knowledge sources head-to-head in a blind test</p>
    
    <!-- Auth Status -->
    <div class="mt-4 flex items-center justify-center gap-4">
      {#if $isAuthenticated}
        <span class="text-sm text-green-400">
          ✓ Signed in as {$currentUser?.email}
        </span>
        <button 
          class="text-sm text-slate-400 hover:text-slate-200"
          on:click={() => authStore.signOut()}
        >
          Sign out
        </button>
      {:else}
        <span class="text-sm text-slate-500">
          Voting as guest
        </span>
        <button 
          class="text-sm text-amber-400 hover:text-amber-300"
          on:click={() => showAuthModal = true}
        >
          Sign in to save history
        </button>
      {/if}
    </div>
  </div>

  <!-- Search Phase -->
  {#if phase === 'search'}
    <div class="max-w-2xl mx-auto">
      <div class="arena-card">
        <h2 class="text-xl font-semibold mb-4 text-center">Choose a Topic</h2>
        
        <!-- Search Input -->
        <div class="relative mb-4">
          <input
            type="text"
            bind:value={searchQuery}
            on:input={handleSearch}
            placeholder="Search for any topic..."
            class="w-full px-4 py-3 pl-12 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-lg"
          />
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {#if isSearching}
            <div class="absolute right-4 top-1/2 -translate-y-1/2">
              <div class="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            </div>
          {/if}
        </div>

        <!-- Search Results -->
        {#if searchResults.length > 0}
          <div class="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {#each searchResults as result}
              <button
                class="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                on:click={() => selectTopic(result.title)}
              >
                <div class="font-medium">{result.title}</div>
                {#if result.description}
                  <div class="text-sm text-slate-500 truncate">{result.description}</div>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Divider -->
        <div class="flex items-center gap-4 my-6">
          <div class="flex-1 border-t border-slate-700"></div>
          <span class="text-slate-500 text-sm">or</span>
          <div class="flex-1 border-t border-slate-700"></div>
        </div>

        <!-- Random Button -->
        <button
          class="w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          on:click={loadRandomTopic}
          disabled={isLoadingRandomTopic}
        >
          {#if isLoadingRandomTopic}
            <span class="inline-flex items-center gap-2">
              <div class="animate-spin h-5 w-5 border-2 border-slate-950 border-t-transparent rounded-full"></div>
              Finding a topic...
            </span>
          {:else}
            Random Topic
          {/if}
        </button>
        
        <p class="text-center text-xs text-slate-500 mt-3">
          Pulls from Wikipedia's entire catalog of articles
        </p>

        <!-- Stats -->
        {#if matchCount > 0}
          <p class="text-center text-sm text-slate-500 mt-4">
            {matchCount} comparison{matchCount !== 1 ? 's' : ''} completed this session
          </p>
        {/if}
      </div>
    </div>

  <!-- Loading Phase -->
  {:else if phase === 'loading'}
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="font-medium">{currentTopic}</span>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {#each [1, 2] as _}
          <div class="arena-card animate-pulse">
            <div class="h-6 w-32 bg-slate-800 rounded mb-4"></div>
            <div class="space-y-3">
              <div class="h-4 w-full bg-slate-800 rounded"></div>
              <div class="h-4 w-full bg-slate-800 rounded"></div>
              <div class="h-4 w-3/4 bg-slate-800 rounded"></div>
              <div class="h-4 w-full bg-slate-800 rounded"></div>
              <div class="h-4 w-5/6 bg-slate-800 rounded"></div>
              <div class="h-4 w-full bg-slate-800 rounded"></div>
              <div class="h-4 w-2/3 bg-slate-800 rounded"></div>
            </div>
          </div>
        {/each}
      </div>
      
      <p class="text-center text-slate-400 mt-8">
        Fetching content from knowledge sources...
      </p>
    </div>

  <!-- Comparing Phase - NO SOURCE IDENTIFICATION -->
  {:else if phase === 'comparing' && leftDisplay && rightDisplay}
    <div class="space-y-6">
      <!-- Topic Badge -->
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="font-medium">{currentTopic}</span>
        </div>
        <p class="text-xs text-slate-500 mt-2">Sources are hidden until you vote</p>
      </div>

      <!-- Content Cards - BLIND COMPARISON -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left Source (Anonymous) -->
        <div class="arena-card flex flex-col border-2 border-blue-500/30">
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
                A
              </div>
              <span class="text-lg font-semibold text-blue-400">Source A</span>
            </div>
          </div>
          
          <div class="flex-1 overflow-y-auto max-h-[60vh] scrollbar-thin">
            <Markdown 
              content={getDisplayContent(leftDisplay.content.content, contentExpanded.left)}
              disableLinks={true}
              on:linkclick={handleLinkClick}
            />
          </div>
          
          {#if leftDisplay.content.content.length > TRUNCATE_LENGTH}
            <button
              class="mt-4 pt-3 border-t border-slate-700/50 text-sm text-amber-400 hover:text-amber-300 text-center w-full"
              on:click={() => contentExpanded.left = !contentExpanded.left}
            >
              {contentExpanded.left ? '↑ Show less' : '↓ Show more'}
            </button>
          {/if}
        </div>

        <!-- Right Source (Anonymous) -->
        <div class="arena-card flex flex-col border-2 border-purple-500/30">
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
                B
              </div>
              <span class="text-lg font-semibold text-purple-400">Source B</span>
            </div>
          </div>
          
          <div class="flex-1 overflow-y-auto max-h-[60vh] scrollbar-thin">
            <Markdown 
              content={getDisplayContent(rightDisplay.content.content, contentExpanded.right)}
              disableLinks={true}
              on:linkclick={handleLinkClick}
            />
          </div>
          
          {#if rightDisplay.content.content.length > TRUNCATE_LENGTH}
            <button
              class="mt-4 pt-3 border-t border-slate-700/50 text-sm text-amber-400 hover:text-amber-300 text-center w-full"
              on:click={() => contentExpanded.right = !contentExpanded.right}
            >
              {contentExpanded.right ? '↑ Show less' : '↓ Show more'}
            </button>
          {/if}
        </div>
      </div>

      <!-- Vote Buttons -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <button
          class="vote-btn vote-btn-primary w-full sm:w-auto"
          on:click={() => submitVote('a')}
        >
          A is Better
        </button>
        
        <button
          class="vote-btn vote-btn-secondary w-full sm:w-auto"
          on:click={() => submitVote('tie')}
        >
          It's a Tie
        </button>
        
        <button
          class="vote-btn vote-btn-primary w-full sm:w-auto"
          on:click={() => submitVote('b')}
        >
          B is Better
        </button>
      </div>

      <div class="text-center">
        <button
          class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          on:click={() => submitVote('both_bad')}
        >
          Both are bad
        </button>
      </div>
    </div>

  <!-- Voting Phase -->
  {:else if phase === 'voting'}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
      <p class="text-slate-400">Recording your vote...</p>
    </div>

  <!-- Revealing/Complete Phase - SHOW SOURCE LOGOS -->
  {:else if (phase === 'revealing' || phase === 'complete') && voteResult && leftDisplay && rightDisplay}
    <div class="space-y-6">
      <!-- Topic Badge -->
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <span class="font-medium">{currentTopic}</span>
        </div>
      </div>

      <!-- Revealed Cards with Logos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left Reveal -->
        <div class="arena-card border-2 {voteResult.winner === 'a' ? 'border-green-500/50' : voteResult.winner === 'b' ? 'border-red-500/30' : 'border-slate-600/50'}">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-white/10 p-2 flex items-center justify-center">
                <img 
                  src={getLogo(voteResult.leftSource.slug)} 
                  alt={voteResult.leftSource.name}
                  class="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <div class="font-semibold text-lg {getColor(voteResult.leftSource.slug)}">{voteResult.leftSource.name}</div>
                <div class="text-sm text-slate-500">Source A</div>
              </div>
            </div>
            <div class="rating-badge {voteResult.leftRatingChange >= 0 ? 'rating-badge-positive' : 'rating-badge-negative'}">
              {formatRatingChange(voteResult.leftRatingChange)}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            Rating: {Math.round(voteResult.leftSource.rating)} → 
            <span class="font-semibold text-slate-200">{Math.round(voteResult.leftNewRating)}</span>
          </div>
          {#if voteResult.winner === 'a'}
            <div class="mt-3 text-sm text-green-400 font-medium">✓ Your pick</div>
          {/if}
          
          <!-- Quality Metrics -->
          {#if leftQuality}
            <div class="mt-4 pt-4 border-t border-slate-700/50">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-500">Quality Score</span>
                <span class="text-sm font-semibold {getQualityTier(leftQuality.overallScore).color}">
                  {formatQualityScore(leftQuality.overallScore)}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-slate-500">Accuracy</span>
                  <span class="text-slate-300">{formatQualityScore(leftQuality.metrics.accuracy)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Readability</span>
                  <span class="text-slate-300">{formatQualityScore(leftQuality.metrics.readability)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Depth</span>
                  <span class="text-slate-300">{formatQualityScore(leftQuality.metrics.depth)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Objectivity</span>
                  <span class="text-slate-300">{formatQualityScore(leftQuality.metrics.objectivity)}</span>
                </div>
              </div>
              <div class="mt-2 pt-2 border-t border-slate-800/50 flex justify-between text-xs">
                <div>
                  <span class="text-slate-500">Shapley Value</span>
                  <span class="ml-1 font-semibold {leftQuality.shapleyValue >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    {formatShapleyValue(leftQuality.shapleyValue)}
                  </span>
                </div>
                <div>
                  <span class="text-slate-500">Expected</span>
                  <span class="ml-1 font-semibold text-amber-400">{formatQualityScore(leftQuality.expectedValue)}</span>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Right Reveal -->
        <div class="arena-card border-2 {voteResult.winner === 'b' ? 'border-green-500/50' : voteResult.winner === 'a' ? 'border-red-500/30' : 'border-slate-600/50'}">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-white/10 p-2 flex items-center justify-center">
                <img 
                  src={getLogo(voteResult.rightSource.slug)} 
                  alt={voteResult.rightSource.name}
                  class="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <div class="font-semibold text-lg {getColor(voteResult.rightSource.slug)}">{voteResult.rightSource.name}</div>
                <div class="text-sm text-slate-500">Source B</div>
              </div>
            </div>
            <div class="rating-badge {voteResult.rightRatingChange >= 0 ? 'rating-badge-positive' : 'rating-badge-negative'}">
              {formatRatingChange(voteResult.rightRatingChange)}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            Rating: {Math.round(voteResult.rightSource.rating)} → 
            <span class="font-semibold text-slate-200">{Math.round(voteResult.rightNewRating)}</span>
          </div>
          {#if voteResult.winner === 'b'}
            <div class="mt-3 text-sm text-green-400 font-medium">✓ Your pick</div>
          {/if}
          
          <!-- Quality Metrics -->
          {#if rightQuality}
            <div class="mt-4 pt-4 border-t border-slate-700/50">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-500">Quality Score</span>
                <span class="text-sm font-semibold {getQualityTier(rightQuality.overallScore).color}">
                  {formatQualityScore(rightQuality.overallScore)}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-slate-500">Accuracy</span>
                  <span class="text-slate-300">{formatQualityScore(rightQuality.metrics.accuracy)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Readability</span>
                  <span class="text-slate-300">{formatQualityScore(rightQuality.metrics.readability)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Depth</span>
                  <span class="text-slate-300">{formatQualityScore(rightQuality.metrics.depth)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Objectivity</span>
                  <span class="text-slate-300">{formatQualityScore(rightQuality.metrics.objectivity)}</span>
                </div>
              </div>
              <div class="mt-2 pt-2 border-t border-slate-800/50 flex justify-between text-xs">
                <div>
                  <span class="text-slate-500">Shapley Value</span>
                  <span class="ml-1 font-semibold {rightQuality.shapleyValue >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    {formatShapleyValue(rightQuality.shapleyValue)}
                  </span>
                </div>
                <div>
                  <span class="text-slate-500">Expected</span>
                  <span class="ml-1 font-semibold text-amber-400">{formatQualityScore(rightQuality.expectedValue)}</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Coalition Value -->
      {#if qualityAssessment}
        <div class="max-w-md mx-auto">
          <div class="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 text-center">
            <div class="text-xs text-slate-500 mb-1">Combined Knowledge Quality</div>
            <div class="text-2xl font-bold text-gradient">{formatQualityScore(qualityAssessment.coalitionValue)}</div>
            <div class="text-xs text-slate-500 mt-1">When sources are blended together</div>
          </div>
        </div>
      {/if}

      <!-- Vote Summary -->
      <div class="text-center">
        <p class="text-slate-400 mb-6">
          You voted: 
          <span class="font-semibold text-amber-400">
            {#if voteResult.winner === 'a'}
              {voteResult.leftSource.name} (Source A)
            {:else if voteResult.winner === 'b'}
              {voteResult.rightSource.name} (Source B)
            {:else if voteResult.winner === 'tie'}
              Tie
            {:else}
              Both Bad
            {/if}
          </span>
        </p>

        {#if !$isAuthenticated}
          <p class="text-sm text-slate-500 mb-4">
            <button class="text-amber-400 hover:text-amber-300" on:click={() => showAuthModal = true}>
              Sign in
            </button> to save your voting history
          </p>
        {/if}
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            class="vote-btn vote-btn-primary"
            on:click={startNewComparison}
          >
            New Comparison
          </button>
          <a href="/leaderboard" class="vote-btn vote-btn-secondary">
            View Leaderboard
          </a>
        </div>
      </div>

      <!-- Expandable Content with ENABLED links -->
      <details class="arena-card">
        <summary class="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">
          View Full Articles (links now work)
        </summary>
        <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="p-4 rounded-lg bg-slate-800/30 max-h-[50vh] overflow-y-auto">
            <div class="text-xs text-slate-500 mb-2">{voteResult.leftSource.name}</div>
            <Markdown content={leftDisplay.content.content} disableLinks={false} />
          </div>
          <div class="p-4 rounded-lg bg-slate-800/30 max-h-[50vh] overflow-y-auto">
            <div class="text-xs text-slate-500 mb-2">{voteResult.rightSource.name}</div>
            <Markdown content={rightDisplay.content.content} disableLinks={false} />
          </div>
        </div>
      </details>

      <div class="text-center text-sm text-slate-500">
        Comparisons this session: {matchCount}
      </div>
    </div>
  {/if}

  <!-- Error Display -->
  {#if error}
    <div class="max-w-md mx-auto mt-8">
      <div class="arena-card text-center border-red-500/20">
        <div class="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 class="text-lg font-semibold mb-2">Something went wrong</h2>
        <p class="text-slate-400 text-sm mb-6">{error}</p>
        <button class="vote-btn vote-btn-primary" on:click={startNewComparison}>
          Try Again
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Link Disabled Toast -->
{#if showLinkToast}
  <div 
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up"
  >
    <div class="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl shadow-lg flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
      </div>
      <div>
        <div class="text-sm font-medium text-white">Links disabled during comparison</div>
        <div class="text-xs text-slate-400">Vote first to reveal sources and enable links</div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translate(-50%, 10px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
  
  .animate-fade-in-up {
    animation: fade-in-up 0.3s ease-out;
  }
</style>
