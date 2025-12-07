<script lang="ts">
  let openSection: string | null = 'glicko2';
  
  interface FAQItem {
    question: string;
    answer: string;
  }
  
  const glicko2FAQ: FAQItem[] = [
    {
      question: "What is Glicko-2 and why do you use it?",
      answer: `Glicko-2 is a rating system created by Professor Mark Glickman at Boston University. It's what powers the rankings on sites like Lichess (online chess) and is used by gaming platforms worldwide.

We chose it because it's honestly just better than simpler alternatives. When you vote, we don't just count "wins" — we track how confident we are in each rating. A source with 500 comparisons has a much more reliable rating than one with just 10.`
    },
    {
      question: "How is this different from just counting wins?",
      answer: `Think about it this way: if Wikipedia has won 3 out of 3 comparisons, is it really better than Britannica at 450 out of 500? Simple win rates would say yes, but that's obviously wrong.

Glicko-2 solves three big problems:

<strong>Sample size matters.</strong> More data = more confidence. We actually track this as "Rating Deviation" — a number that shrinks as we get more votes.

<strong>Who you beat matters.</strong> Winning against a top-rated source is worth more than winning against a low-rated one.

<strong>Recent results matter more.</strong> If there are no new votes for a while, the confidence in the rating naturally decreases.`
    },
    {
      question: "What do the rating numbers actually mean?",
      answer: `Every source starts at 1500. Here's a rough guide:

• <strong>1500</strong> = Average (the starting point)
• <strong>1550-1600</strong> = Somewhat above average
• <strong>1600-1700</strong> = Clearly strong
• <strong>1700+</strong> = Dominant

The "Rating Deviation" number tells you how much to trust the rating. Under 100 is pretty solid. Over 200 means we're still figuring it out.

For the math nerds: a 200-point gap means the higher source wins about 75% of the time. A 400-point gap means they win 90% of the time.`
    },
    {
      question: "Can people cheat or manipulate the ratings?",
      answer: `We've thought about this. Here's why it's hard to game:

<strong>You can't pick favorites.</strong> The comparisons are blind — you literally don't know which source is which until after you vote.

<strong>Spam voting has diminishing returns.</strong> The first 50 votes shape a rating way more than votes 500-550. So flooding with votes doesn't help much.

<strong>Patterns get noticed.</strong> If someone always votes the same way or votes suspiciously fast, that data can be flagged.

<strong>Time works against manipulation.</strong> Ratings naturally become less certain over time if there aren't new votes. So any manipulation campaign fades away.`
    }
  ];
  
  const fairnessQA: FAQItem[] = [
    {
      question: "Why are the sources hidden during voting?",
      answer: `Because people have biases. If you see "Wikipedia" vs "some AI thing", you might already have opinions before reading a word.

By hiding the source names until after you vote, we measure what you actually think of the content — not what you think of the brand. You'd be surprised how often your gut reaction changes once you can't see the labels.`
    },
    {
      question: "How do you pick which sources to compare?",
      answer: `It's random. Each comparison pairs two sources on a random topic. This prevents anyone from cherry-picking topics where their favorite source looks good.

You can also search for specific topics if you want to compare sources on something you care about.`
    },
    {
      question: "What if a source is great at science but bad at history?",
      answer: `Good question — that's exactly why we have category ratings.

Instead of just one overall score, we track ratings for:
• <strong>Accuracy</strong> — does this seem factually correct?
• <strong>Readability</strong> — is this easy to understand?
• <strong>Depth</strong> — does this cover the topic thoroughly?
• <strong>Objectivity</strong> — is this neutral or biased?

Each category has its own independent rating. So Wikipedia might rank #1 for depth while Britannica leads in accuracy. The leaderboard shows all of this.`
    },
    {
      question: "How many votes does it take before ratings are reliable?",
      answer: `Rough guide:

• <strong>10-20 votes:</strong> Very rough estimate. Take it with a grain of salt.
• <strong>50-100 votes:</strong> Starting to be meaningful.
• <strong>200+ votes:</strong> Pretty reliable.
• <strong>500+ votes:</strong> Rock solid.

You can actually see this in the Rating Deviation number. Lower = more confident.`
    },
    {
      question: "What happens when there's a tie?",
      answer: `Ties count! They tell us the sources are evenly matched on that topic.

Rating-wise, ties cause smaller changes than wins or losses, and they pull both sources slightly toward each other.`
    }
  ];
  
  const qualityFAQ: FAQItem[] = [
    {
      question: "What are Shapley values?",
      answer: `It's a concept from game theory (there's actually a Nobel Prize behind it). The idea: if you have a team, how do you fairly measure each player's contribution?

We use this in the Knowledge Blender. When you combine multiple sources, Shapley values tell you how much unique value each source added to the mix. A high Shapley value means that source contributed something the others couldn't.`
    },
    {
      question: "How do you calculate the quality scores?",
      answer: `We analyze content across five dimensions. All sources start with the same base scores — the differences come from what's actually in the content:

<strong>Accuracy (30%)</strong> — Starts at 70% for all sources. Gets bonuses for: having citations (+15% max), having good structure with headings (+10% max). Well-sourced, organized content scores higher.

<strong>Depth (25%)</strong> — Based on word count (up to 2000 words = 100%) and structure (headings + paragraphs). Longer, well-organized articles score higher.

<strong>Readability (20%)</strong> — Measures sentence length. Optimal is 15-20 words per sentence. Very long or very short sentences reduce the score.

<strong>Objectivity (15%)</strong> — Counts opinion words like "best", "terrible", "obviously", "absolutely". More opinion words = lower score.

<strong>Citations (10%)</strong> — Counts links relative to content length. Expects roughly 1 link per 200 words for well-cited content.

These are heuristics, not perfect science. The real rankings come from user voting.`
    },
    {
      question: "What's the 'Expected Value' number?",
      answer: `It's a prediction of how well a source should do, combining:

• The quality score we calculated for this specific article (40%)
• The source's overall Glicko-2 rating from all votes (35%)
• Their historical win rate (25%)

If a source's quality score is way higher than expected, that article is probably better than their average. If it's lower, this particular article might not be their best work.`
    },
    {
      question: "Why use humans instead of AI to judge quality?",
      answer: `AI judgment has issues:

<strong>It's biased.</strong> AI models are trained on internet data, which includes a lot of Wikipedia. They might unfairly prefer sources they've seen more of.

<strong>"Quality" is subjective.</strong> There's no objective definition of what makes knowledge "better." Only humans can decide what they actually find useful.

<strong>It can be gamed.</strong> If AI judged quality, sources could optimize for what the AI likes instead of what humans need.

So we use AI for analysis (calculating metrics) but humans for the actual judgment (voting).`
    }
  ];
  
  const generalFAQ: FAQItem[] = [
    {
      question: "What sources are you comparing?",
      answer: `We currently have five sources:

<strong>Wikipedia</strong> — The community-edited encyclopedia. Massive coverage but quality varies by topic. Generally well-cited.

<strong>Encyclopedia Britannica</strong> — Expert-written, professionally edited. Smaller coverage, consistently high quality.

<strong>Grokipedia</strong> — AI-generated content from xAI. Potentially more up-to-date but can include AI errors.

<strong>Citizendium</strong> — Expert-guided encyclopedia founded by a Wikipedia co-founder. Emphasizes expert review and accuracy.

<strong>New World Encyclopedia</strong> — Encyclopedia with editorial oversight focusing on encyclopedic content with contextual perspectives.

We're always looking at adding more based on what people want to compare.`
    },
    {
      question: "What do you do with my data?",
      answer: `<strong>Your votes:</strong> They go into the ratings, anonymously. We never show who voted for what.

<strong>Your email (if you sign up):</strong> Just for logging in. We don't sell it or share it.

<strong>If you don't sign up:</strong> We use an anonymous session ID so you can still see your voting history. No personal info needed.`
    }
  ];
</script>

<svelte:head>
  <title>FAQ - WikiArena</title>
  <meta name="description" content="How WikiArena rates knowledge sources using the Glicko-2 system." />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-12">
    <h1 class="text-3xl font-bold mb-3">How It Works</h1>
    <p class="text-slate-400">The rating system, fairness measures, and quality metrics explained</p>
  </div>

  <!-- Navigation -->
  <div class="flex flex-wrap justify-center gap-2 mb-8">
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {openSection === 'glicko2' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'}"
      on:click={() => openSection = 'glicko2'}
    >
      Rating System
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {openSection === 'fairness' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'}"
      on:click={() => openSection = 'fairness'}
    >
      Fairness
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {openSection === 'quality' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'}"
      on:click={() => openSection = 'quality'}
    >
      Quality Metrics
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {openSection === 'general' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50'}"
      on:click={() => openSection = 'general'}
    >
      General
    </button>
  </div>

  <!-- Glicko-2 Section -->
  {#if openSection === 'glicko2'}
    <div class="space-y-4">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">The Rating System</h2>
        <p class="text-slate-400 text-sm">
          How we calculate rankings from your votes.
        </p>
      </div>
      
      <!-- Visual Explainer -->
      <div class="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 mb-6">
        <h3 class="font-semibold mb-4">Glicko-2: Three Numbers Per Source</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-lg bg-slate-800/50">
            <div class="text-2xl font-bold text-blue-400 mb-1">Rating</div>
            <div class="text-sm text-slate-400">The skill estimate. Starts at 1500. Higher is better.</div>
          </div>
          <div class="p-4 rounded-lg bg-slate-800/50">
            <div class="text-2xl font-bold text-purple-400 mb-1">Deviation</div>
            <div class="text-sm text-slate-400">How confident we are. Lower means more certain.</div>
          </div>
          <div class="p-4 rounded-lg bg-slate-800/50">
            <div class="text-2xl font-bold text-amber-400 mb-1">Volatility</div>
            <div class="text-sm text-slate-400">How stable the performance is over time.</div>
          </div>
        </div>
      </div>
      
      {#each glicko2FAQ as item}
        <details class="group">
          <summary class="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <span class="font-medium pr-4">{item.question}</span>
            <svg class="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="p-4 text-slate-300 text-sm leading-relaxed">
            {@html item.answer}
          </div>
        </details>
      {/each}
    </div>
  {/if}

  <!-- Fairness Section -->
  {#if openSection === 'fairness'}
    <div class="space-y-4">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Keeping It Fair</h2>
        <p class="text-slate-400 text-sm">
          How we prevent bias and gaming.
        </p>
      </div>
      
      <!-- Fairness Pillars -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
          <div class="font-semibold mb-1 text-blue-400">Blind Voting</div>
          <p class="text-sm text-slate-400">You don't see source names until after you vote.</p>
        </div>
        
        <div class="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20">
          <div class="font-semibold mb-1 text-purple-400">Random Topics</div>
          <p class="text-sm text-slate-400">Matchups are randomized. No cherry-picking.</p>
        </div>
        
        <div class="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
          <div class="font-semibold mb-1 text-emerald-400">Confidence Tracking</div>
          <p class="text-sm text-slate-400">More votes = more reliable ratings.</p>
        </div>
        
        <div class="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
          <div class="font-semibold mb-1 text-amber-400">Equal Starting Point</div>
          <p class="text-sm text-slate-400">All sources start with the same base quality scores.</p>
        </div>
      </div>
      
      {#each fairnessQA as item}
        <details class="group">
          <summary class="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <span class="font-medium pr-4">{item.question}</span>
            <svg class="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="p-4 text-slate-300 text-sm leading-relaxed">
            {@html item.answer}
          </div>
        </details>
      {/each}
    </div>
  {/if}

  <!-- Quality Metrics Section -->
  {#if openSection === 'quality'}
    <div class="space-y-4">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Quality Analysis</h2>
        <p class="text-slate-400 text-sm">
          The automated metrics we calculate for each piece of content.
        </p>
      </div>
      
      <!-- Metrics Overview -->
      <div class="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 mb-6">
        <h3 class="font-semibold mb-4">Quality Score Breakdown</h3>
        <div class="space-y-3">
          <div class="flex items-center gap-4">
            <div class="w-24 text-sm text-slate-400">Accuracy</div>
            <div class="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full" style="width: 30%"></div>
            </div>
            <div class="w-12 text-sm text-right">30%</div>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-24 text-sm text-slate-400">Depth</div>
            <div class="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-purple-500 rounded-full" style="width: 25%"></div>
            </div>
            <div class="w-12 text-sm text-right">25%</div>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-24 text-sm text-slate-400">Readability</div>
            <div class="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full" style="width: 20%"></div>
            </div>
            <div class="w-12 text-sm text-right">20%</div>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-24 text-sm text-slate-400">Objectivity</div>
            <div class="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-amber-500 rounded-full" style="width: 15%"></div>
            </div>
            <div class="w-12 text-sm text-right">15%</div>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-24 text-sm text-slate-400">Citations</div>
            <div class="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-red-500 rounded-full" style="width: 10%"></div>
            </div>
            <div class="w-12 text-sm text-right">10%</div>
          </div>
        </div>
      </div>
      
      {#each qualityFAQ as item}
        <details class="group">
          <summary class="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <span class="font-medium pr-4">{item.question}</span>
            <svg class="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="p-4 text-slate-300 text-sm leading-relaxed">
            {@html item.answer}
          </div>
        </details>
      {/each}
    </div>
  {/if}

  <!-- General Section -->
  {#if openSection === 'general'}
    <div class="space-y-4">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">General Questions</h2>
        <p class="text-slate-400 text-sm">
          The basics.
        </p>
      </div>
      
      {#each generalFAQ as item}
        <details class="group">
          <summary class="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
            <span class="font-medium pr-4">{item.question}</span>
            <svg class="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="p-4 text-slate-300 text-sm leading-relaxed">
            {@html item.answer}
          </div>
        </details>
      {/each}
    </div>
  {/if}

  <!-- CTA -->
  <div class="mt-12 text-center">
    <p class="text-slate-400 mb-4">Ready to help shape the rankings?</p>
    <a href="/arena" class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all">
      Start Voting
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
      </svg>
    </a>
  </div>
</div>

<style>
  details summary::-webkit-details-marker {
    display: none;
  }
  
  details[open] summary {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom: 1px solid rgb(51 65 85 / 0.5);
  }
  
  details > div {
    border: 1px solid rgb(51 65 85 / 0.5);
    border-top: none;
    border-radius: 0 0 0.75rem 0.75rem;
    background: rgb(30 41 59 / 0.2);
  }
  
  details div :global(strong) {
    color: #f1f5f9;
    font-weight: 600;
  }
  
  details div :global(code) {
    background: rgb(15 23 42 / 0.5);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
</style>
