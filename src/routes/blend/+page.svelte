<script lang="ts">
  import { onMount } from 'svelte';
  import { getSupabase } from '$lib/services/supabase';
  import type { Source } from '$lib/types/database';

  let sources: Source[] = [];
  let weights: Record<string, number> = {};
  let query = '';
  let formatPrompt = '';
  let outputStyle = 'balanced';
  let result = '';
  let loading = false;
  let error = '';

  const outputStyles = [
    { value: 'balanced', label: 'Balanced', desc: 'Mix of detail and brevity' },
    { value: 'concise', label: 'Concise', desc: 'Short and to the point' },
    { value: 'detailed', label: 'Detailed', desc: 'Comprehensive coverage' },
    { value: 'academic', label: 'Academic', desc: 'Scholarly tone with citations' },
    { value: 'casual', label: 'Casual', desc: 'Friendly and conversational' },
  ];

  onMount(async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);
    
    if (data) {
      sources = data;
      // Initialize weights equally
      sources.forEach(s => {
        weights[s.id] = 1 / sources.length;
      });
    }
  });

  function updateWeight(sourceId: string, value: number) {
    weights[sourceId] = value;
    // Normalize weights to sum to 1
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(weights).forEach(k => {
        weights[k] = weights[k] / total;
      });
    }
    weights = { ...weights }; // Trigger reactivity
  }

  async function blend() {
    if (!query.trim()) {
      error = 'Please enter a query';
      return;
    }

    loading = true;
    error = '';
    result = '';

    try {
      // In production, this would call an Edge Function that:
      // 1. Fetches content from all sources
      // 2. Sends to Grok API for blending
      // 3. Returns synthesized result
      
      // For now, simulate the blending process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      result = `**Blended Knowledge: ${query}**

This is a simulated blend of knowledge sources based on your preferences:

${sources.map(s => `• **${s.name}** (${Math.round(weights[s.id] * 100)}% weight)`).join('\n')}

---

In a production environment, this would:
1. Fetch content about "${query}" from each source
2. Send to xAI's Grok API with your weight preferences
3. Return a synthesized response that prioritizes higher-weighted sources

**Output Style:** ${outputStyle}
${formatPrompt ? `**Custom Format:** ${formatPrompt}` : ''}

The blended response would combine factual accuracy with your preferred presentation style, citing sources as appropriate and resolving any contradictions based on source weights.`;

    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to blend knowledge';
    } finally {
      loading = false;
    }
  }

  function resetWeights() {
    sources.forEach(s => {
      weights[s.id] = 1 / sources.length;
    });
    weights = { ...weights };
  }
</script>

<svelte:head>
  <title>Knowledge Blender - Knowledge Arena</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2">🧪 Knowledge Blender</h1>
    <p class="text-slate-400">Blend multiple knowledge sources into a single, customized response</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Configuration Panel -->
    <div class="lg:col-span-1 space-y-6">
      <!-- Source Weights -->
      <div class="arena-card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">Source Weights</h2>
          <button 
            class="text-xs text-slate-500 hover:text-slate-300"
            on:click={resetWeights}
          >
            Reset
          </button>
        </div>
        
        <div class="space-y-4">
          {#each sources as source (source.id)}
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm">{source.name}</span>
                <span class="text-sm text-amber-400 font-mono">
                  {Math.round(weights[source.id] * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights[source.id] * 100}
                on:input={(e) => updateWeight(source.id, parseInt(e.currentTarget.value) / 100)}
                class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-amber-500
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          {/each}
        </div>

        {#if sources.length === 0}
          <div class="text-center py-4 text-slate-500">
            Loading sources...
          </div>
        {/if}
      </div>

      <!-- Output Style -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">Output Style</h2>
        <div class="space-y-2">
          {#each outputStyles as style}
            <button
              class="w-full text-left p-3 rounded-lg transition-all
                {outputStyle === style.value 
                  ? 'bg-amber-500/10 border border-amber-500/30' 
                  : 'bg-slate-800/50 border border-transparent hover:border-slate-700'}"
              on:click={() => outputStyle = style.value}
            >
              <div class="font-medium text-sm">{style.label}</div>
              <div class="text-xs text-slate-500">{style.desc}</div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Custom Format -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">Custom Format (Optional)</h2>
        <textarea
          bind:value={formatPrompt}
          placeholder="e.g., 'Use bullet points', 'Include examples', 'Write for a 10-year-old'..."
          class="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
            text-sm placeholder-slate-500 resize-none
            focus:outline-none focus:border-amber-500/50"
        ></textarea>
      </div>
    </div>

    <!-- Main Panel -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Query Input -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">What do you want to know?</h2>
        <div class="flex gap-3">
          <input
            type="text"
            bind:value={query}
            placeholder="Enter a topic or question..."
            class="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl
              placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            on:keydown={(e) => e.key === 'Enter' && blend()}
          />
          <button
            class="vote-btn vote-btn-primary"
            disabled={loading || !query.trim()}
            on:click={blend}
          >
            {#if loading}
              <span class="inline-block animate-spin mr-2">⚙️</span>
            {/if}
            Blend
          </button>
        </div>
        
        {#if error}
          <p class="mt-3 text-sm text-red-400">{error}</p>
        {/if}
      </div>

      <!-- Result -->
      <div class="arena-card min-h-[300px]">
        <h2 class="font-semibold mb-4">Blended Result</h2>
        
        {#if loading}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
            <p class="text-slate-400">Blending knowledge sources...</p>
            <p class="text-sm text-slate-500 mt-2">Fetching and synthesizing content</p>
          </div>
        {:else if result}
          <div class="prose prose-invert prose-sm max-w-none">
            <div class="whitespace-pre-wrap text-slate-300 leading-relaxed">
              {result}
            </div>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <div class="text-4xl mb-4">🧪</div>
            <p class="text-slate-400">Enter a query to blend knowledge sources</p>
            <p class="text-sm text-slate-500 mt-2">
              Adjust weights to prioritize your preferred sources
            </p>
          </div>
        {/if}
      </div>

      <!-- Info -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
        <h3 class="font-semibold mb-2 text-sm flex items-center gap-2">
          <span>💡</span> How Blending Works
        </h3>
        <p class="text-sm text-slate-400">
          The Knowledge Blender fetches information about your query from multiple sources, 
          then uses AI (powered by Grok) to synthesize a unified response. Higher-weighted 
          sources have more influence on the final output. Contradictions are resolved by 
          preferring higher-weighted sources.
        </p>
      </div>
    </div>
  </div>
</div>
