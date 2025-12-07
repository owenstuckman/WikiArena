<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  
  // Accept SvelteKit props to suppress warnings
  export let data: Record<string, unknown> = {};
  import Markdown from '$lib/components/Markdown.svelte';
  import { 
    fetchContentFromSource, 
    searchWikipedia,
    getSourceLogo,
    getSourceColor,
    type SourceSlug,
    type SourceContent 
  } from '$lib/services/content';
  import {
    assessQuality,
    formatQualityScore,
    formatShapleyValue,
    getQualityTier,
    type QualityAssessment,
    type SourceQuality
  } from '$lib/services/shapley';
  import type { Source, BlendConfig } from '$lib/types/database';

  // Constants
  const OUTPUT_STYLES = [
    { value: 'balanced', label: 'Balanced', desc: 'Mix of detail and brevity' },
    { value: 'concise', label: 'Concise', desc: 'Short and to the point' },
    { value: 'detailed', label: 'Detailed', desc: 'Comprehensive coverage' },
    { value: 'academic', label: 'Academic', desc: 'Scholarly tone with structure' },
    { value: 'casual', label: 'Casual', desc: 'Friendly and conversational' },
    { value: 'eli5', label: 'ELI5', desc: 'Explain like I\'m 5' },
  ];

  const PRESET_FORMATS = [
    { label: 'None', value: '' },
    { label: 'Bullet points', value: 'Use bullet points for key facts' },
    { label: 'Numbered list', value: 'Present information as a numbered list' },
    { label: 'Q&A format', value: 'Present as questions and answers' },
    { label: 'Timeline', value: 'Present chronologically as a timeline' },
    { label: 'Pros & Cons', value: 'Organize into pros and cons' },
    { label: 'Compare Sources', value: 'Compare and contrast what each source says differently' },
  ];

  // State
  let sources: Source[] = [];
  let weights: Record<string, number> = {};
  let enabledSources: Record<string, boolean> = {};
  let query = '';
  let outputStyle = 'balanced';
  let customPrompt = '';
  let selectedPreset = '';
  let result = '';
  let loading = false;
  let loadingPhase = '';
  let error = '';
  let showAuthModal = false;
  let searchResults: { title: string; description: string }[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout>;
  let fetchedContents: Record<string, SourceContent> = {};
  let blendHistory: { query: string; result: string; timestamp: Date }[] = [];
  let showSourceContent = true;
  let showCompareMode = false;
  
  // Saved configs
  let savedConfigs: BlendConfig[] = [];
  let configName = '';
  let showSaveConfig = false;
  let savingConfig = false;
  
  // User preferences from vote history
  let userPreferences: Record<string, { wins: number; total: number; winRate: number }> = {};
  let usePreferenceWeights = false;
  
  // Quality assessment
  let qualityAssessment: QualityAssessment | null = null;
  let sourceQualities: Record<string, SourceQuality> = {};
  
  // Track failed sources and effective weights (normalized to successful sources only)
  let failedSources: Set<string> = new Set();
  let effectiveWeights: Record<string, number> = {};

  // Helpers
  function getLogo(slug: string): string {
    return getSourceLogo(slug as SourceSlug);
  }
  
  function getColor(slug: string): string {
    return getSourceColor(slug as SourceSlug);
  }

  onMount(async () => {
    await authStore.init();
    await loadSources();
    if ($isAuthenticated && $currentUser) {
      await loadSavedConfigs();
      await loadUserPreferences();
    }
    
    // Check for suggested blend from history page
    checkForSuggestedBlend();
  });

  // React to auth changes
  $: if (browser && $isAuthenticated && $currentUser) {
    loadSavedConfigs();
    loadUserPreferences();
  }
  
  function checkForSuggestedBlend() {
    if (!browser) return;
    
    try {
      const stored = localStorage.getItem('wikiarena_suggested_blend');
      if (!stored) return;
      
      const config = JSON.parse(stored);
      
      // Check if it's recent (within last 5 minutes)
      if (Date.now() - config.timestamp > 5 * 60 * 1000) {
        localStorage.removeItem('wikiarena_suggested_blend');
        return;
      }
      
      // Apply the suggested weights
      if (config.weights && config.enabled) {
        // Wait a tick for sources to be loaded
        setTimeout(() => {
          applySuggestedBlend(config);
        }, 100);
      }
      
      // Clear it so it doesn't apply again
      localStorage.removeItem('wikiarena_suggested_blend');
    } catch (e) {
      console.error('Error loading suggested blend:', e);
      localStorage.removeItem('wikiarena_suggested_blend');
    }
  }
  
  function applySuggestedBlend(config: { weights: Record<string, number>; enabled: Record<string, boolean>; fromHistory: boolean }) {
    // Apply weights by slug
    for (const source of sources) {
      if (config.weights[source.slug] !== undefined) {
        weights[source.id] = config.weights[source.slug];
      }
      if (config.enabled[source.slug] !== undefined) {
        enabledSources[source.id] = config.enabled[source.slug];
      }
    }
    
    weights = { ...weights };
    enabledSources = { ...enabledSources };
    usePreferenceWeights = true;
    
    // Show a toast or notification that suggested blend was applied
    if (config.fromHistory) {
      showSuggestedBlendNotification = true;
      setTimeout(() => {
        showSuggestedBlendNotification = false;
      }, 4000);
    }
  }
  
  let showSuggestedBlendNotification = false;

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
    
    // Fallback to demo sources
    if (sources.length < 2) {
      sources = [
        { id: 'demo-wiki', name: 'Wikipedia', slug: 'wikipedia', description: 'The free encyclopedia', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-grok', name: 'Grokipedia', slug: 'grokipedia', description: 'AI-powered knowledge', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-brit', name: 'Encyclopedia Britannica', slug: 'britannica', description: 'Trusted since 1768', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-citizen', name: 'Citizendium', slug: 'citizendium', description: 'Expert-guided encyclopedia', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-newworld', name: 'New World Encyclopedia', slug: 'newworld', description: 'Values-based encyclopedia', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
      ];
    }
    
    // Initialize weights and enabled state
    sources.forEach(s => {
      weights[s.id] = 1 / sources.length;
      enabledSources[s.id] = true;
    });
    weights = { ...weights };
    enabledSources = { ...enabledSources };
  }

  async function loadSavedConfigs() {
    if (!isSupabaseConfigured || !$currentUser?.id) return;
    
    try {
      const { data, error: fetchError } = await supabase
        .from('blend_configs')
        .select('*')
        .eq('user_id', $currentUser.id)
        .order('updated_at', { ascending: false });
      
      if (!fetchError && data) {
        savedConfigs = data;
      }
    } catch (e) {
      console.error('Error loading saved configs:', e);
    }
  }

  async function loadUserPreferences() {
    if (!isSupabaseConfigured || !$currentUser?.id) return;
    
    try {
      // Get user's vote history to calculate preferences
      const { data, error: fetchError } = await supabase
        .from('votes')
        .select(`
          winner,
          match:matches (
            source_a:sources!matches_source_a_id_fkey (id, slug),
            source_b:sources!matches_source_b_id_fkey (id, slug)
          )
        `)
        .eq('user_id', $currentUser.id);
      
      if (!fetchError && data) {
        const prefs: Record<string, { wins: number; total: number }> = {};
        
        for (const vote of data) {
          const match = vote.match as any;
          if (!match) continue;
          
          const sourceASlug = match.source_a?.slug;
          const sourceBSlug = match.source_b?.slug;
          
          if (sourceASlug) {
            if (!prefs[sourceASlug]) prefs[sourceASlug] = { wins: 0, total: 0 };
            prefs[sourceASlug].total++;
            if (vote.winner === 'a') prefs[sourceASlug].wins++;
          }
          
          if (sourceBSlug) {
            if (!prefs[sourceBSlug]) prefs[sourceBSlug] = { wins: 0, total: 0 };
            prefs[sourceBSlug].total++;
            if (vote.winner === 'b') prefs[sourceBSlug].wins++;
          }
        }
        
        // Calculate win rates
        userPreferences = {};
        for (const [slug, data] of Object.entries(prefs)) {
          userPreferences[slug] = {
            ...data,
            winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100) : 50
          };
        }
      }
    } catch (e) {
      console.error('Error loading user preferences:', e);
    }
  }

  function applyPreferenceWeights() {
    if (Object.keys(userPreferences).length === 0) return;
    
    // Calculate weights based on win rates
    let totalWinRate = 0;
    const sourceWinRates: Record<string, number> = {};
    
    for (const source of sources) {
      const pref = userPreferences[source.slug];
      const winRate = pref?.winRate || 50;
      sourceWinRates[source.id] = winRate;
      if (enabledSources[source.id]) {
        totalWinRate += winRate;
      }
    }
    
    // Normalize to weights
    if (totalWinRate > 0) {
      for (const source of sources) {
        if (enabledSources[source.id]) {
          weights[source.id] = sourceWinRates[source.id] / totalWinRate;
        }
      }
      weights = { ...weights };
    }
    
    usePreferenceWeights = true;
  }

  async function saveConfig() {
    if (!isSupabaseConfigured || !$currentUser?.id || !configName.trim()) return;
    
    savingConfig = true;
    try {
      const configWeights: Record<string, number> = {};
      for (const source of sources) {
        configWeights[source.slug] = weights[source.id];
      }
      
      const { error: saveError } = await supabase
        .from('blend_configs')
        .insert({
          user_id: $currentUser.id,
          name: configName.trim(),
          weights: configWeights,
          output_style: outputStyle,
          format_prompt: customPrompt || selectedPreset || null,
        });
      
      if (saveError) throw saveError;
      
      await loadSavedConfigs();
      configName = '';
      showSaveConfig = false;
    } catch (e) {
      console.error('Error saving config:', e);
      error = 'Failed to save configuration';
    } finally {
      savingConfig = false;
    }
  }

  async function loadConfig(config: BlendConfig) {
    const configWeights = config.weights as Record<string, number>;
    
    // Apply weights by slug
    for (const source of sources) {
      if (configWeights[source.slug] !== undefined) {
        weights[source.id] = configWeights[source.slug];
        enabledSources[source.id] = configWeights[source.slug] > 0;
      }
    }
    
    weights = { ...weights };
    enabledSources = { ...enabledSources };
    outputStyle = config.output_style || 'balanced';
    
    if (config.format_prompt) {
      // Check if it matches a preset
      const preset = PRESET_FORMATS.find(p => p.value === config.format_prompt);
      if (preset) {
        selectedPreset = config.format_prompt;
        customPrompt = '';
      } else {
        customPrompt = config.format_prompt;
        selectedPreset = '';
      }
    }
  }

  async function deleteConfig(configId: string) {
    if (!isSupabaseConfigured || !$currentUser?.id) return;
    
    try {
      await supabase
        .from('blend_configs')
        .delete()
        .eq('id', configId)
        .eq('user_id', $currentUser.id);
      
      await loadSavedConfigs();
    } catch (e) {
      console.error('Error deleting config:', e);
    }
  }

  function toggleSource(sourceId: string) {
    enabledSources[sourceId] = !enabledSources[sourceId];
    enabledSources = { ...enabledSources };
    // When toggling, distribute evenly among enabled sources
    const enabledIds = Object.entries(enabledSources)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    if (enabledIds.length > 0) {
      const share = 1 / enabledIds.length;
      enabledIds.forEach(id => {
        weights[id] = share;
      });
      weights = { ...weights };
    }
    usePreferenceWeights = false;
  }

  function updateWeight(sourceId: string, value: number) {
    // Just set the weight, don't auto-normalize
    weights[sourceId] = value / 100;
    weights = { ...weights };
    usePreferenceWeights = false;
  }
  
  function getTotalWeight(): number {
    const enabledIds = Object.entries(enabledSources)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    return enabledIds.reduce((sum, id) => sum + (weights[id] || 0), 0);
  }
  
  function fixWeightsTo100() {
    const enabledIds = Object.entries(enabledSources)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    
    const total = enabledIds.reduce((sum, id) => sum + (weights[id] || 0), 0);
    
    if (total > 0 && total !== 1) {
      enabledIds.forEach(id => {
        weights[id] = weights[id] / total;
      });
      weights = { ...weights };
    }
  }

  function normalizeWeights() {
    const enabledIds = Object.entries(enabledSources)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    
    const total = enabledIds.reduce((sum, id) => sum + (weights[id] || 0), 0);
    
    if (total > 0) {
      enabledIds.forEach(id => {
        weights[id] = weights[id] / total;
      });
    }
    weights = { ...weights };
  }

  function resetWeights() {
    const enabledCount = Object.values(enabledSources).filter(Boolean).length;
    sources.forEach(s => {
      if (enabledSources[s.id]) {
        weights[s.id] = 1 / enabledCount;
      }
    });
    weights = { ...weights };
    usePreferenceWeights = false;
  }

  async function handleSearch() {
    if (!query.trim()) {
      searchResults = [];
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      isSearching = true;
      try {
        searchResults = await searchWikipedia(query, 6);
      } catch (e) {
        console.error('Search error:', e);
        searchResults = [];
      }
      isSearching = false;
    }, 300);
  }

  function selectTopic(topic: string) {
    query = topic;
    searchResults = [];
  }

  async function blend() {
    if (!query.trim()) {
      error = 'Please enter a topic or question';
      return;
    }

    const enabledSourceList = sources.filter(s => enabledSources[s.id]);
    if (enabledSourceList.length === 0) {
      error = 'Please enable at least one source';
      return;
    }

    loading = true;
    error = '';
    result = '';
    fetchedContents = {};
    failedSources = new Set();
    effectiveWeights = {};

    try {
      // Phase 1: Fetch content from all enabled sources
      loadingPhase = 'Fetching content from sources...';
      
      const contentPromises = enabledSourceList.map(async (source) => {
        try {
          const content = await fetchContentFromSource(query, source.slug as SourceSlug);
          if (content && content.content && content.content.trim().length > 50) {
            fetchedContents[source.id] = content;
          } else {
            failedSources.add(source.id);
          }
        } catch (e) {
          console.error(`Failed to fetch from ${source.name}:`, e);
          failedSources.add(source.id);
        }
        fetchedContents = { ...fetchedContents };
        failedSources = new Set(failedSources);
        return { source };
      });

      await Promise.all(contentPromises);
      
      // Calculate effective weights based only on successful sources
      const successfulSourceIds = Object.keys(fetchedContents);
      if (successfulSourceIds.length === 0) {
        error = 'Failed to fetch content from any source. Please try a different topic.';
        loading = false;
        loadingPhase = '';
        return;
      }
      
      // Sum weights of successful sources
      const totalSuccessfulWeight = successfulSourceIds.reduce(
        (sum, id) => sum + (weights[id] || 0), 
        0
      );
      
      // Normalize weights to 100% for successful sources only
      if (totalSuccessfulWeight > 0) {
        for (const id of successfulSourceIds) {
          effectiveWeights[id] = (weights[id] || 0) / totalSuccessfulWeight;
        }
      } else {
        // Equal distribution if all weights were 0
        const equalShare = 1 / successfulSourceIds.length;
        for (const id of successfulSourceIds) {
          effectiveWeights[id] = equalShare;
        }
      }
      effectiveWeights = { ...effectiveWeights };
      
      // Show warning if some sources failed
      if (failedSources.size > 0) {
        const failedNames = enabledSourceList
          .filter(s => failedSources.has(s.id))
          .map(s => s.name)
          .join(', ');
        console.warn(`Some sources failed to return content: ${failedNames}`);
      }
      
      // Build results array for quality assessment
      const validResults = successfulSourceIds.map(id => {
        const source = sources.find(s => s.id === id)!;
        return { source, content: fetchedContents[id] };
      });
      
      // Calculate quality assessment with Shapley values
      if (validResults.length > 0) {
        const globalRatings: Record<string, { rating: number; winRate: number }> = {};
        for (const source of sources) {
          const winRate = source.total_matches > 0 
            ? (source.total_wins / source.total_matches) * 100 
            : 50;
          globalRatings[source.slug] = { rating: source.rating, winRate };
        }
        
        qualityAssessment = assessQuality(
          validResults.map(r => ({
            sourceId: r.source.id,
            sourceName: r.source.name,
            sourceSlug: r.source.slug,
            content: r.content!.content,
          })),
          globalRatings
        );
        
        // Map to sourceQualities for easy lookup
        sourceQualities = {};
        for (const sq of qualityAssessment.sources) {
          sourceQualities[sq.sourceId] = sq;
        }
      }
      
      // Phase 2: Check if compare mode
      if (showCompareMode || selectedPreset.includes('Compare')) {
        loadingPhase = 'Comparing sources...';
        result = generateSourceComparison(validResults);
      } else {
        // Phase 2: Blend with Grok
        loadingPhase = 'Blending knowledge with AI...';
        const blendedResult = await blendWithGrok(validResults);
        result = blendedResult;
      }
      
      // Save to history
      blendHistory = [
        { query, result, timestamp: new Date() },
        ...blendHistory.slice(0, 9)
      ];

    } catch (e) {
      console.error('Blend error:', e);
      error = e instanceof Error ? e.message : 'Failed to blend knowledge';
    } finally {
      loading = false;
      loadingPhase = '';
    }
  }

  function generateSourceComparison(
    sourceContents: { source: Source; content: SourceContent | null }[]
  ): string {
    const validContents = sourceContents.filter(sc => sc.content);
    
    if (validContents.length === 0) {
      return `# ${query}\n\nNo content available from the selected sources.`;
    }

    let output = `# Source Comparison: ${query}\n\n`;
    output += `*Comparing ${validContents.length} knowledge sources side by side.*\n\n`;
    
    // Add quality overview if available
    if (qualityAssessment) {
      output += `## Quality Analysis\n\n`;
      output += `| Source | Quality | Unique Value | Expected | Accuracy | Readability |\n`;
      output += `|--------|---------|--------------|----------|----------|-------------|\n`;
      
      for (const sc of validContents) {
        const q = sourceQualities[sc.source.id];
        if (q) {
          output += `| ${sc.source.name} | ${formatQualityScore(q.overallScore)} | ${formatShapleyValue(q.shapleyValue)} | ${formatQualityScore(q.expectedValue)} | ${formatQualityScore(q.metrics.accuracy)} | ${formatQualityScore(q.metrics.readability)} |\n`;
        }
      }
      
      output += `\n*Combined Coalition Value: ${formatQualityScore(qualityAssessment.coalitionValue)}*\n\n`;
    }
    
    // Add each source's content
    for (const sc of validContents) {
      const weight = Math.round((effectiveWeights[sc.source.id] || 0) * 100);
      const q = sourceQualities[sc.source.id];
      output += `---\n\n## ${sc.source.name}\n`;
      output += `*Weight: ${weight}%`;
      if (q) {
        output += ` | Quality: ${formatQualityScore(q.overallScore)} | Unique: ${formatShapleyValue(q.shapleyValue)}`;
      }
      output += `*\n\n`;
      
      // Extract first 1500 chars of content
      const content = sc.content!.content;
      const truncated = content.length > 1500 ? content.substring(0, 1500) + '...' : content;
      output += truncated + '\n\n';
    }
    
    // Add comparison summary
    output += `---\n\n## Comparison Summary\n\n`;
    output += `| Source | Content Length | Has Images | Weight |\n`;
    output += `|--------|---------------|------------|--------|\n`;
    
    for (const sc of validContents) {
      const contentLength = sc.content!.content.length;
      const hasImages = sc.content!.content.includes('![') ? 'Yes' : 'No';
      const weight = Math.round((effectiveWeights[sc.source.id] || 0) * 100);
      output += `| ${sc.source.name} | ${contentLength.toLocaleString()} chars | ${hasImages} | ${weight}% |\n`;
    }
    
    return output;
  }

  async function blendWithGrok(
    sourceContents: { source: Source; content: SourceContent | null }[]
  ): Promise<string> {
    // Build the context from all sources using effective weights
    const sourceContexts = sourceContents
      .filter(sc => sc.content)
      .map(sc => {
        const weight = Math.round((effectiveWeights[sc.source.id] || 0) * 100);
        const truncatedContent = sc.content!.content.substring(0, 4000);
        return `### Source: ${sc.source.name} (Weight: ${weight}%)
${truncatedContent}`;
      })
      .join('\n\n---\n\n');

    const formatPrompt = customPrompt || selectedPreset;

    try {
      // Call our server-side API endpoint
      const response = await fetch('/api/blend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceContexts,
          query,
          outputStyle,
          formatPrompt,
        }),
      });

      if (!response.ok) {
        console.error('Blend API error:', response.status);
        return generateDemoBlend(sourceContents);
      }

      const data = await response.json();
      
      if (data.error && !data.content) {
        console.error('Blend API error:', data.error);
        return generateDemoBlend(sourceContents);
      }
      
      return data.content || generateDemoBlend(sourceContents);
    } catch (e) {
      console.error('Blend error:', e);
      return generateDemoBlend(sourceContents);
    }
  }

  function generateDemoBlend(
    sourceContents: { source: Source; content: SourceContent | null }[]
  ): string {
    const validContents = sourceContents.filter(sc => sc.content);
    
    if (validContents.length === 0) {
      return `# ${query}\n\nNo content available from the selected sources.`;
    }

    // Sort by effective weight
    validContents.sort((a, b) => (effectiveWeights[b.source.id] || 0) - (effectiveWeights[a.source.id] || 0));

    // Extract sections from each source
    const allSections: { heading: string; content: string; source: string; weight: number }[] = [];
    
    for (const sc of validContents) {
      const sourceWeight = effectiveWeights[sc.source.id] || 0;
      const text = sc.content!.content;
      
      const sections = text.split(/(?=^## )/m);
      for (const section of sections) {
        if (section.trim()) {
          const headingMatch = section.match(/^## (.+?)$/m);
          const heading = headingMatch ? headingMatch[1].trim() : 'Introduction';
          const content = headingMatch ? section.replace(/^## .+?\n/, '').trim() : section.trim();
          
          if (content.length > 50) {
            allSections.push({
              heading,
              content: content.substring(0, 800),
              source: sc.source.name,
              weight: sourceWeight,
            });
          }
        }
      }
    }

    // Group sections by heading
    const sectionsByHeading: Record<string, typeof allSections> = {};
    for (const section of allSections) {
      const normalizedHeading = section.heading.toLowerCase().trim();
      if (!sectionsByHeading[normalizedHeading]) {
        sectionsByHeading[normalizedHeading] = [];
      }
      sectionsByHeading[normalizedHeading].push(section);
    }

    // Build output
    let output = `# ${query}\n\n`;
    
    // Add introduction
    const primaryContent = validContents[0];
    const introMatch = primaryContent.content!.content.match(/^# .+?\n\n(.+?)(?=\n## |\n\n## |$)/s);
    if (introMatch) {
      output += introMatch[1].trim().substring(0, 500) + '\n\n';
    }

    // Add sections
    const processedHeadings = new Set<string>();
    const priorityHeadings = ['overview', 'history', 'description', 'background', 'etymology'];
    
    for (const priority of priorityHeadings) {
      for (const [heading, sections] of Object.entries(sectionsByHeading)) {
        if (heading.includes(priority) && !processedHeadings.has(heading)) {
          processedHeadings.add(heading);
          const bestSection = sections.sort((a, b) => b.weight - a.weight)[0];
          output += `## ${bestSection.heading}\n\n${bestSection.content}\n\n`;
        }
      }
    }

    let sectionsAdded = processedHeadings.size;
    for (const [heading, sections] of Object.entries(sectionsByHeading)) {
      if (sectionsAdded >= 5) break;
      if (!processedHeadings.has(heading)) {
        processedHeadings.add(heading);
        const bestSection = sections.sort((a, b) => b.weight - a.weight)[0];
        output += `## ${bestSection.heading}\n\n${bestSection.content}\n\n`;
        sectionsAdded++;
      }
    }

    // Style modifications
    if (outputStyle === 'concise') {
      const lines = output.split('\n').slice(0, 30);
      output = lines.join('\n');
    } else if (outputStyle === 'eli5') {
      output += '\n\n---\n\n### In Simple Terms\n\n';
      output += `Think of ${query} as something really interesting! It's a topic that helps us understand the world better.`;
    }

    // Add format note
    const formatNote = customPrompt || selectedPreset;
    if (formatNote) {
      output += `\n\n---\n\n*Format: ${formatNote}*`;
    }

    // Source attribution with effective weights
    const weightInfo = validContents
      .map(sc => `- **${sc.source.name}**: ${Math.round((effectiveWeights[sc.source.id] || 0) * 100)}%`)
      .join('\n');

    output += `\n\n---\n\n### Sources Blended\n\n${weightInfo}`;
    output += '\n\n*Configure an xAI API key for AI-powered synthesis.*';

    return output;
  }

  function clearResult() {
    result = '';
    fetchedContents = {};
    failedSources = new Set();
    effectiveWeights = {};
    qualityAssessment = null;
    sourceQualities = {};
  }

  function loadFromHistory(item: { query: string; result: string }) {
    query = item.query;
    result = item.result;
  }

  function exportResult(format: 'markdown' | 'html' | 'text') {
    let content = result;
    let filename = `blend-${query.replace(/\s+/g, '-').toLowerCase()}`;
    let mimeType = 'text/plain';
    
    if (format === 'html') {
      content = `<!DOCTYPE html>
<html><head><title>${query} - WikiArena Blend</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:1rem;}</style>
</head><body>${result.replace(/\n/g, '<br>')}</body></html>`;
      filename += '.html';
      mimeType = 'text/html';
    } else if (format === 'markdown') {
      filename += '.md';
      mimeType = 'text/markdown';
    } else {
      content = result.replace(/[#*_]/g, '');
      filename += '.txt';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(result);
  }
</script>

<svelte:head>
  <title>Knowledge Blender - WikiArena</title>
</svelte:head>

<AuthModal bind:open={showAuthModal} />

<!-- Suggested Blend Notification -->
{#if showSuggestedBlendNotification}
  <div class="fixed top-4 right-4 z-50 animate-slide-in">
    <div class="bg-emerald-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <div class="font-medium">Suggested Blend Applied</div>
        <div class="text-sm text-emerald-100">Weights set based on your voting preferences</div>
      </div>
      <button 
        class="ml-2 text-emerald-200 hover:text-white"
        on:click={() => showSuggestedBlendNotification = false}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Knowledge Blender</h1>
    <p class="text-slate-400 text-sm">Blend multiple knowledge sources into a single, customized response</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left Sidebar -->
    <div class="lg:col-span-3 space-y-6">
      <!-- Source Selection & Weights -->
      <div class="arena-card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">Sources</h2>
          <div class="flex items-center gap-2">
            {#if Object.keys(userPreferences).length > 0}
              <button 
                class="text-xs px-2 py-1 rounded {usePreferenceWeights ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'}"
                on:click={applyPreferenceWeights}
                title="Apply weights based on your vote history"
              >
                <svg class="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
                </svg>
                Prefs
              </button>
            {/if}
            <button 
              class="text-xs text-slate-500 hover:text-slate-300"
              on:click={resetWeights}
            >
              Reset
            </button>
          </div>
        </div>
        
        <div class="space-y-4">
          {#each sources as source (source.id)}
            {@const pref = userPreferences[source.slug]}
            <div class="p-3 rounded-lg {enabledSources[source.id] ? 'bg-slate-800/50' : 'bg-slate-900/30 opacity-60'}">
              <div class="flex items-center gap-3 mb-2">
                <button
                  class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    {enabledSources[source.id] 
                      ? 'bg-amber-500 border-amber-500 text-slate-900' 
                      : 'border-slate-600 hover:border-slate-500'}"
                  on:click={() => toggleSource(source.id)}
                >
                  {#if enabledSources[source.id]}
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
                <img src={getLogo(source.slug)} alt="" class="w-5 h-5 object-contain" />
                <span class="text-sm font-medium {getColor(source.slug)}">{source.name}</span>
              </div>
              
              {#if enabledSources[source.id]}
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(weights[source.id] * 100)}
                    on:input={(e) => updateWeight(source.id, parseInt(e.currentTarget.value))}
                    class="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-amber-500
                      [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span class="text-xs text-amber-400 font-mono w-10 text-right">
                    {Math.round(weights[source.id] * 100)}%
                  </span>
                </div>
                {#if pref}
                  <div class="text-xs text-slate-500 mt-1">
                    Your preference: {pref.winRate}% win rate
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
        
        <!-- Total Weight Display -->
        {#if true}
          {@const totalWeight = getTotalWeight()}
          {@const isValid = Math.abs(totalWeight - 1) < 0.01}
          <div class="mt-4 pt-4 border-t border-slate-700/30">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm text-slate-400">Total:</span>
                <span class="text-sm font-mono {isValid ? 'text-emerald-400' : 'text-red-400'}">
                  {Math.round(totalWeight * 100)}%
                </span>
                {#if !isValid}
                  <span class="text-xs text-red-400">(must equal 100%)</span>
                {/if}
              </div>
              {#if !isValid}
                <button
                  on:click={fixWeightsTo100}
                  class="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
                >
                  Fix to 100%
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Output Style -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">Output Style</h2>
        <div class="grid grid-cols-2 gap-2">
          {#each OUTPUT_STYLES as style}
            <button
              class="text-left p-2 rounded-lg transition-all text-xs
                {outputStyle === style.value 
                  ? 'bg-amber-500/20 border border-amber-500/50' 
                  : 'bg-slate-800/50 border border-transparent hover:bg-slate-700/50'}"
              on:click={() => outputStyle = style.value}
            >
              <span class="font-medium">{style.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Format Presets -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">Format</h2>
        <select
          bind:value={selectedPreset}
          class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm
            focus:outline-none focus:border-amber-500/50"
        >
          {#each PRESET_FORMATS as preset}
            <option value={preset.value}>{preset.label}</option>
          {/each}
        </select>
        
        <div class="mt-3">
          <label for="custom-instructions" class="text-xs text-slate-500 mb-1 block">Custom instructions</label>
          <textarea
            id="custom-instructions"
            bind:value={customPrompt}
            placeholder="e.g., 'Focus on recent developments'..."
            class="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
              text-xs placeholder-slate-500 resize-none
              focus:outline-none focus:border-amber-500/50"
          ></textarea>
        </div>
        
        <!-- Compare Mode Toggle -->
        <label class="flex items-center gap-2 mt-3 cursor-pointer">
          <input 
            type="checkbox" 
            bind:checked={showCompareMode}
            class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
          />
          <span class="text-xs text-slate-400">Compare sources side-by-side</span>
        </label>
      </div>

      <!-- Saved Configurations -->
      {#if $isAuthenticated}
        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold">Saved Configs</h2>
            <button 
              class="text-xs text-amber-400 hover:text-amber-300"
              on:click={() => showSaveConfig = !showSaveConfig}
            >
              {showSaveConfig ? 'Cancel' : '+ Save Current'}
            </button>
          </div>
          
          {#if showSaveConfig}
            <div class="mb-4 p-3 bg-slate-800/50 rounded-lg">
              <input
                type="text"
                bind:value={configName}
                placeholder="Configuration name..."
                class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm
                  focus:outline-none focus:border-amber-500/50 mb-2"
              />
              <button
                class="w-full vote-btn vote-btn-primary text-sm"
                disabled={!configName.trim() || savingConfig}
                on:click={saveConfig}
              >
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          {/if}
          
          {#if savedConfigs.length > 0}
            <div class="space-y-2 max-h-40 overflow-y-auto">
              {#each savedConfigs as config}
                <div class="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg text-sm">
                  <button
                    class="flex-1 text-left text-slate-300 hover:text-white truncate"
                    on:click={() => loadConfig(config)}
                  >
                    {config.name}
                  </button>
                  <button
                    class="text-slate-500 hover:text-red-400 ml-2"
                    on:click={() => deleteConfig(config.id)}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-slate-500">No saved configurations yet.</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Main Panel -->
    <div class="lg:col-span-9 space-y-6">
      <!-- Query Input -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">What do you want to know?</h2>
        <div class="relative">
          <input
            type="text"
            bind:value={query}
            on:input={handleSearch}
            placeholder="Enter a topic or question..."
            class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl
              placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-lg"
            on:keydown={(e) => e.key === 'Enter' && !isSearching && blend()}
          />
          {#if isSearching}
            <div class="absolute right-4 top-1/2 -translate-y-1/2">
              <div class="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            </div>
          {/if}
        </div>

        <!-- Search Suggestions -->
        {#if searchResults.length > 0}
          <div class="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div class="flex flex-wrap gap-2">
              {#each searchResults as searchResult}
                <button
                  class="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-sm transition-colors"
                  on:click={() => selectTopic(searchResult.title)}
                >
                  {searchResult.title}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="flex items-center justify-between mt-4">
          <div class="text-sm text-slate-500">
            {#if Object.values(enabledSources).filter(Boolean).length > 0}
              {showCompareMode ? 'Comparing' : 'Blending'} {Object.values(enabledSources).filter(Boolean).length} source{Object.values(enabledSources).filter(Boolean).length > 1 ? 's' : ''}
            {:else}
              No sources selected
            {/if}
          </div>
          <button
            class="vote-btn vote-btn-primary"
            disabled={loading || !query.trim() || Object.values(enabledSources).filter(Boolean).length === 0}
            on:click={blend}
          >
            {#if loading}
              <span class="inline-flex items-center gap-2">
                <div class="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                {showCompareMode ? 'Comparing...' : 'Blending...'}
              </span>
            {:else}
              {showCompareMode ? 'Compare Sources' : 'Blend Knowledge'}
            {/if}
          </button>
        </div>
        
        {#if error}
          <p class="mt-3 text-sm text-red-400">{error}</p>
        {/if}
      </div>

      <!-- Loading State -->
      {#if loading}
        <div class="arena-card">
          <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500/30 border-t-amber-500"></div>
            <p class="text-slate-400 mt-6">{loadingPhase}</p>
            <div class="flex items-center gap-2 mt-4 flex-wrap justify-center">
              {#each sources.filter(s => enabledSources[s.id]) as source}
                <div class="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-full text-xs">
                  <img src={getLogo(source.slug)} alt="" class="w-4 h-4 object-contain" />
                  <span class="{fetchedContents[source.id] ? 'text-green-400' : failedSources.has(source.id) ? 'text-red-400' : 'text-slate-500'}">
                    {fetchedContents[source.id] ? '✓' : failedSources.has(source.id) ? '✗' : '...'}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        </div>

      <!-- Result with Source Preview -->
      {:else if result}
        <!-- Source Content Preview -->
        {#if Object.keys(fetchedContents).length > 0 && !showCompareMode}
          <div class="arena-card">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-semibold">Source Content</h2>
              <button
                class="text-xs text-slate-500 hover:text-slate-300"
                on:click={() => showSourceContent = !showSourceContent}
              >
                {showSourceContent ? 'Hide' : 'Show'} Sources
              </button>
            </div>
            
            {#if showSourceContent}
              <!-- Quality Assessment Summary -->
              {#if qualityAssessment && Object.keys(sourceQualities).length > 0}
                <div class="mb-4 p-4 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30">
                  <div class="flex items-center justify-between mb-3">
                    <div class="group relative">
                      <h3 class="text-sm font-medium text-slate-300 cursor-help border-b border-dotted border-slate-600">Source Quality Analysis</h3>
                      <!-- Tooltip -->
                      <div class="absolute top-full left-0 mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                        <strong class="text-slate-200">Unique Value</strong> shows how much distinctive information each source contributes. Sources with high unique value add content the others don't have.
                      </div>
                    </div>
                    <div class="text-xs text-slate-500">
                      Coalition: <span class="text-amber-400 font-semibold">{formatQualityScore(qualityAssessment.coalitionValue)}</span>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {#each Object.entries(sourceQualities) as [sourceId, quality]}
                      {@const source = sources.find(s => s.id === sourceId)}
                      {@const tier = getQualityTier(quality.overallScore)}
                      <div class="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                        <div class="flex items-center gap-2 mb-2">
                          <img src={getLogo(source?.slug || '')} alt="" class="w-4 h-4 object-contain" />
                          <span class="text-xs font-medium {getColor(source?.slug || '')}">{source?.name}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div class="text-slate-500">Quality</div>
                            <div class="font-semibold {tier.color}">{formatQualityScore(quality.overallScore)}</div>
                          </div>
                          <div>
                            <div class="text-slate-500">Unique</div>
                            <div class="font-semibold {quality.shapleyValue >= 0 ? 'text-emerald-400' : 'text-red-400'}">{formatShapleyValue(quality.shapleyValue)}</div>
                          </div>
                          <div>
                            <div class="text-slate-500">Expected</div>
                            <div class="font-semibold text-amber-400">{formatQualityScore(quality.expectedValue)}</div>
                          </div>
                          <div>
                            <div class="text-slate-500">Accuracy</div>
                            <div class="font-semibold text-slate-300">{formatQualityScore(quality.metrics.accuracy)}</div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
              
              <!-- Failed sources warning -->
              {#if failedSources.size > 0}
                <div class="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div class="flex items-center gap-2 text-amber-400 text-sm">
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span>
                      {failedSources.size} source{failedSources.size > 1 ? 's' : ''} failed to load: 
                      {sources.filter(s => failedSources.has(s.id)).map(s => s.name).join(', ')}
                    </span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1 ml-6">Weights have been redistributed among successful sources.</p>
                </div>
              {/if}
            
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {#each Object.entries(fetchedContents) as [sourceId, content]}
                  {@const source = sources.find(s => s.id === sourceId)}
                  {@const quality = sourceQualities[sourceId]}
                  <div class="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 overflow-hidden">
                    <div class="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/30">
                      <img src={getLogo(source?.slug || '')} alt="" class="w-5 h-5 object-contain flex-shrink-0" />
                      <span class="font-medium text-sm {getColor(source?.slug || '')} truncate">{source?.name || 'Unknown'}</span>
                      <span class="text-xs text-amber-400 ml-auto flex-shrink-0">{Math.round((effectiveWeights[sourceId] || 0) * 100)}%</span>
                    </div>
                    {#if quality}
                      <div class="flex items-center gap-3 mb-3 text-xs flex-wrap">
                        <span class="text-slate-500">Quality: <span class="{getQualityTier(quality.overallScore).color}">{formatQualityScore(quality.overallScore)}</span></span>
                        <span class="text-slate-500">Unique: <span class="{quality.shapleyValue >= 0 ? 'text-emerald-400' : 'text-red-400'}">{formatShapleyValue(quality.shapleyValue)}</span></span>
                      </div>
                    {/if}
                    <div class="text-xs text-slate-400 max-h-48 overflow-y-auto overflow-x-hidden scrollbar-thin">
                      <div class="break-words">
                        <Markdown content={content.content.substring(0, 1500) + (content.content.length > 1500 ? '...' : '')} />
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
              
              <!-- Source contribution bar -->
              <div class="mt-4 pt-4 border-t border-slate-700/30">
                <div class="text-xs text-slate-500 mb-2">Source Contribution (Effective Weights)</div>
                <div class="h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  {#each Object.entries(fetchedContents) as [sourceId, _], index}
                    {@const weight = (effectiveWeights[sourceId] || 0) * 100}
                    {@const colors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-pink-500']}
                    <div 
                      class="{colors[index % colors.length]} h-full transition-all"
                      style="width: {weight}%"
                    ></div>
                  {/each}
                </div>
                <div class="flex flex-wrap gap-3 mt-2">
                  {#each Object.entries(fetchedContents) as [sourceId, _], index}
                    {@const source = sources.find(s => s.id === sourceId)}
                    {@const colors = ['text-blue-400', 'text-purple-400', 'text-amber-400', 'text-emerald-400', 'text-pink-400']}
                    {@const bgColors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-pink-500']}
                    <div class="flex items-center gap-1 text-xs {colors[index % colors.length]}">
                      <div class="w-2 h-2 rounded-full {bgColors[index % bgColors.length]}"></div>
                      {source?.name}: {Math.round((effectiveWeights[sourceId] || 0) * 100)}%
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Blended Result -->
        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold">{showCompareMode ? 'Source Comparison' : 'Blended Result'}</h2>
            <div class="flex items-center gap-2">
              <!-- Export dropdown -->
              <div class="relative group">
                <button class="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Export
                </button>
                <div class="absolute right-0 mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button 
                    class="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 rounded-t-lg"
                    on:click={() => exportResult('markdown')}
                  >Markdown</button>
                  <button 
                    class="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50"
                    on:click={() => exportResult('html')}
                  >HTML</button>
                  <button 
                    class="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 rounded-b-lg"
                    on:click={() => exportResult('text')}
                  >Plain Text</button>
                </div>
              </div>
              <button
                class="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"
                on:click={copyToClipboard}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                </svg>
                Copy
              </button>
              <button
                class="text-sm text-slate-500 hover:text-slate-300"
                on:click={clearResult}
              >
                Clear
              </button>
            </div>
          </div>
          
          <div class="max-h-[70vh] overflow-y-auto scrollbar-thin">
            <Markdown content={result} />
          </div>
        </div>

      <!-- Empty State -->
      {:else}
        <div class="arena-card">
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Blend Knowledge Sources</h3>
            <p class="text-slate-400 text-sm max-w-md">
              Enter a topic to combine information from multiple encyclopedias into a single, unified article tailored to your preferences.
            </p>
            
            <div class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
              <button 
                class="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                on:click={() => { query = 'Quantum Computing'; blend(); }}
              >
                <div class="font-medium text-sm">Quantum Computing</div>
                <div class="text-xs text-slate-500">Technology</div>
              </button>
              <button 
                class="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                on:click={() => { query = 'Climate Change'; blend(); }}
              >
                <div class="font-medium text-sm">Climate Change</div>
                <div class="text-xs text-slate-500">Science</div>
              </button>
              <button 
                class="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                on:click={() => { query = 'Renaissance Art'; blend(); }}
              >
                <div class="font-medium text-sm">Renaissance Art</div>
                <div class="text-xs text-slate-500">History</div>
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Recent Blends -->
      {#if blendHistory.length > 0 && !loading}
        <div class="arena-card">
          <h2 class="font-semibold mb-4">Recent Blends</h2>
          <div class="flex flex-wrap gap-2">
            {#each blendHistory as item}
              <button
                class="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                on:click={() => loadFromHistory(item)}
              >
                {item.query}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Info Box -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
        <h3 class="font-medium mb-3 text-sm text-slate-300">How the Blender Works</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-400">
          <div>
            <span class="text-amber-400 font-medium">1. Fetch</span>
            <p class="text-xs mt-1">Content is retrieved from each enabled source for your topic.</p>
          </div>
          <div>
            <span class="text-amber-400 font-medium">2. Weight</span>
            <p class="text-xs mt-1">Higher-weighted sources have more influence on the final result.</p>
          </div>
          <div>
            <span class="text-amber-400 font-medium">3. Synthesize</span>
            <p class="text-xs mt-1">AI combines all sources into a unified article with your preferred style.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>