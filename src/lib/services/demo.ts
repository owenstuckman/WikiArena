/**
 * Demo Data Service
 * Provides mock data for testing without Supabase connection
 */

import type { Source, Topic, LeaderboardEntry } from '$lib/types/database';

// Mock sources
export const DEMO_SOURCES: Source[] = [
  {
    id: 'source-wikipedia',
    name: 'Wikipedia',
    slug: 'wikipedia',
    description: 'The free encyclopedia that anyone can edit. Comprehensive, community-driven knowledge.',
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1542,
    rating_deviation: 85,
    volatility: 0.06,
    total_matches: 247,
    total_wins: 142,
    total_losses: 89,
    total_ties: 16,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'source-grokipedia',
    name: 'Grokipedia',
    slug: 'grokipedia',
    description: "AI-powered knowledge from xAI's Grok. Real-time, conversational information.",
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1458,
    rating_deviation: 92,
    volatility: 0.06,
    total_matches: 247,
    total_wins: 89,
    total_losses: 142,
    total_ties: 16,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'source-britannica',
    name: 'Encyclopedia Britannica',
    slug: 'britannica',
    description: "The world's most trusted encyclopedia since 1768. Expert-written, fact-checked content.",
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1512,
    rating_deviation: 95,
    volatility: 0.06,
    total_matches: 198,
    total_wins: 108,
    total_losses: 78,
    total_ties: 12,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'source-citizendium',
    name: 'Citizendium',
    slug: 'citizendium',
    description: 'Expert-guided encyclopedia founded by Wikipedia co-founder. Emphasizes accuracy and expert review.',
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1495,
    rating_deviation: 110,
    volatility: 0.06,
    total_matches: 156,
    total_wins: 82,
    total_losses: 64,
    total_ties: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'source-newworld',
    name: 'New World Encyclopedia',
    slug: 'newworld',
    description: 'Encyclopedia with editorial oversight providing encyclopedic content with contextual perspectives.',
    api_endpoint: null,
    api_config: {},
    logo_url: null,
    is_active: true,
    rating: 1478,
    rating_deviation: 115,
    volatility: 0.06,
    total_matches: 142,
    total_wins: 71,
    total_losses: 62,
    total_ties: 9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock topics
export const DEMO_TOPICS: Topic[] = [
  { id: 't1', title: 'Artificial Intelligence', slug: 'artificial-intelligence', category: 'Technology', description: null, usage_count: 45, is_active: true, created_at: new Date().toISOString() },
  { id: 't2', title: 'Climate Change', slug: 'climate-change', category: 'Science', description: null, usage_count: 38, is_active: true, created_at: new Date().toISOString() },
  { id: 't3', title: 'Quantum Computing', slug: 'quantum-computing', category: 'Technology', description: null, usage_count: 32, is_active: true, created_at: new Date().toISOString() },
  { id: 't4', title: 'Black Holes', slug: 'black-holes', category: 'Science', description: null, usage_count: 28, is_active: true, created_at: new Date().toISOString() },
  { id: 't5', title: 'The Renaissance', slug: 'the-renaissance', category: 'History', description: null, usage_count: 22, is_active: true, created_at: new Date().toISOString() },
];

// Demo content for sources - written to be source-agnostic
export const DEMO_CONTENT: Record<string, Record<string, string>> = {
  'artificial-intelligence': {
    wikipedia: `# Artificial Intelligence

Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.

## History

The term "artificial intelligence" was coined in 1956, and AI has since become an umbrella term covering a wide variety of subfields.

## Techniques

General-purpose techniques include search and mathematical optimization, formal logic, artificial neural networks, and statistical methods.

## Research Goals

Major goals of AI research include reasoning, knowledge representation, planning, learning, natural language processing, and perception.`,
    
    grokipedia: `# Artificial Intelligence

AI represents humanity's bold attempt to recreate aspects of human intelligence in silicon form. At its core, AI systems are sophisticated pattern-recognition engines that learn from vast amounts of data to make predictions and decisions.

## Categories

Modern AI can be broadly categorized into:

- **Narrow AI**: Systems designed for specific tasks (like chess, image recognition, or language translation)
- **General AI**: The still-theoretical goal of human-level reasoning across all domains

## Deep Learning Revolution

The current AI revolution is largely driven by deep learning—neural networks with many layers that can automatically discover complex patterns in data. This has enabled breakthrough applications in computer vision, natural language processing, and game playing.`,

    britannica: `# Artificial Intelligence

Artificial intelligence (AI) is the ability of a digital computer or computer-controlled robot to perform tasks commonly associated with intelligent beings. The term is frequently applied to the project of developing systems endowed with the intellectual processes characteristic of humans, such as the ability to reason, discover meaning, generalize, or learn from past experience.

## Development

Since the development of the digital computer in the 1940s, it has been demonstrated that computers can be programmed to carry out very complex tasks with great proficiency. Still, despite continuing advances in computer processing speed and memory capacity, there are as yet no programs that can match full human flexibility over wider domains or in tasks requiring much everyday knowledge.

## Origins

The field of AI research was founded at a workshop held on the campus of Dartmouth College during the summer of 1956. Those who attended would become the leaders of AI research for decades.`,

    citizendium: `# Artificial Intelligence

Artificial intelligence (AI) encompasses the development of computer systems capable of performing tasks that typically require human intelligence. This includes learning from experience, understanding language, recognizing patterns, and making decisions.

## Foundations

The theoretical foundations of AI draw from multiple disciplines including mathematics, cognitive science, philosophy, and computer science. Researchers have developed various approaches to creating intelligent systems, ranging from symbolic reasoning to statistical learning.

## Expert Perspectives

Leading researchers in the field have identified key challenges and opportunities in AI development. The balance between capability and safety remains a central concern, as does the need for transparency in AI decision-making processes.

## Current Applications

AI systems are now deployed across numerous domains, from healthcare diagnostics to autonomous vehicles. Each application area presents unique challenges that require careful consideration of both technical and ethical factors.`,

    newworld: `# Artificial Intelligence

Artificial intelligence represents one of humanity's most ambitious technological endeavors—the attempt to create machines capable of intelligent behavior. This field raises profound questions about the nature of intelligence, consciousness, and what it means to be human.

## Conceptual Framework

Understanding AI requires grappling with fundamental questions about intelligence itself. Philosophers and scientists have long debated whether machine intelligence is truly comparable to human cognition or represents something fundamentally different.

## Historical Development

The development of AI has been shaped by both technological advances and shifting perspectives on intelligence. From early optimism about achieving human-level AI to more recent focus on narrow applications, the field has evolved considerably.

## Broader Implications

AI development has implications that extend far beyond technology, touching on questions of employment, privacy, autonomy, and the future of human society. These considerations inform ongoing discussions about responsible AI development.`,
  },
  'climate-change': {
    wikipedia: `# Climate Change

Climate change refers to long-term shifts in global or regional climate patterns. Often specifically refers to the ongoing rise in global average temperature since the mid-20th century, primarily attributed to human activities, especially the burning of fossil fuels which increases heat-trapping greenhouse gas levels in Earth's atmosphere.

## Scientific Consensus

The Intergovernmental Panel on Climate Change (IPCC) has produced a series of Assessment Reports and Special Reports that are widely referenced in discussions of climate change science, impacts, and solutions. Scientific consensus is that climate change is real, human-caused, and poses significant risks to human and natural systems.`,
    
    grokipedia: `# Climate Change

Climate change is perhaps the defining challenge of our era. The science is clear: human activities, particularly burning fossil fuels and deforestation, have increased atmospheric CO2 from ~280 ppm (pre-industrial) to over 420 ppm today—levels not seen in 800,000 years.

## Key Impacts

Key impacts already observed:

- Global temperature rise of ~1.1°C since pre-industrial times
- Sea level rise of 8-9 inches since 1880
- More frequent extreme weather events
- Shifting ecosystems and species migration

## Solutions

The good news? We have the technology to address it. Solar and wind are now the cheapest forms of new electricity generation in most of the world. Electric vehicles are reaching price parity with gas cars. The transition is happening—the question is whether it's fast enough.`,

    britannica: `# Climate Change

Climate change is the periodic modification of Earth's climate brought about as a result of changes in the atmosphere as well as interactions between the atmosphere and various other geologic, chemical, biological, and geographic factors within the Earth system.

## Atmospheric Dynamics

The atmosphere is a dynamic fluid that is continually in motion. Both its physical properties and its rate and direction of motion are influenced by a variety of factors, including solar radiation, the geographic position of continents, ocean currents, the location and orientation of mountain ranges, atmospheric chemistry, and vegetation growing on the land surface.

## Historical Evidence

Since the mid-20th century, scientists have been collecting detailed observations of various weather phenomena. These meteorological records, combined with geological evidence for climate conditions in the past, show that Earth's climate has changed substantially throughout its history.`,

    citizendium: `# Climate Change

Climate change refers to significant, long-term changes in global or regional climate patterns. The current period of climate change is characterized by rapid warming attributed primarily to human activities, particularly the emission of greenhouse gases.

## Scientific Understanding

The scientific understanding of climate change is based on multiple lines of evidence, including direct temperature measurements, ice core records, ocean heat content data, and climate modeling. Expert consensus holds that human activities are the dominant cause of observed warming since the mid-20th century.

## Impacts and Projections

Climate scientists have documented a range of impacts including rising temperatures, changing precipitation patterns, sea level rise, and increasing frequency of extreme weather events. Projections indicate these trends will continue and intensify without significant emissions reductions.

## Policy Responses

International efforts to address climate change include the Paris Agreement and various national and regional policies aimed at reducing greenhouse gas emissions and adapting to climate impacts.`,

    newworld: `# Climate Change

Climate change represents one of the most significant challenges facing human civilization. Understanding this phenomenon requires consideration of both scientific evidence and the broader implications for society and the natural world.

## Earth System Perspective

Earth's climate has always been dynamic, responding to various natural factors over geological time. However, the current period of change is distinguished by its rapidity and clear connection to human activities, particularly the burning of fossil fuels.

## Human Dimensions

Climate change intersects with numerous aspects of human society, including agriculture, health, migration, and economic development. These connections highlight the importance of considering climate change within broader social and ethical frameworks.

## Future Pathways

The future trajectory of climate change depends on choices made by individuals, communities, and nations. Understanding the range of possible futures and the actions that influence them is essential for informed decision-making.`,
  },
  'quantum-computing': {
    wikipedia: `# Quantum Computing

Quantum computing is a type of computation that harnesses quantum mechanical phenomena, such as superposition and entanglement, to process information. Quantum computers use quantum bits or qubits, which can exist in multiple states simultaneously, allowing them to solve certain problems much faster than classical computers.

## History

First proposed by physicist Richard Feynman in 1982, quantum computing has since advanced from theoretical concept to working prototypes. Major tech companies including IBM, Google, and Microsoft are investing heavily in quantum computing research.

## Quantum Supremacy

In 2019, Google claimed to have achieved "quantum supremacy"—demonstrating a quantum computer performing a calculation that would be impractical for classical computers.`,
    
    grokipedia: `# Quantum Computing

Imagine a computer that doesn't just calculate one possibility at a time, but explores millions of possibilities simultaneously. That's the promise of quantum computing.

## How It Works

Classical computers use bits (0 or 1). Quantum computers use qubits, which can be 0, 1, or both at once (superposition). When you combine multiple qubits, they can be "entangled"—meaning the state of one affects others instantly.

## Why It Matters

- **Drug discovery**: Simulating molecular interactions accurately
- **Cryptography**: Both breaking and creating unbreakable codes
- **Optimization**: Solving logistics problems with countless variables
- **AI**: Training models exponentially faster

## Current State

We're in the "ENIAC era" of quantum computing—the machines work but are room-sized, extremely expensive, and error-prone. But progress is accelerating.`,

    britannica: `# Quantum Computing

Quantum computing is a method of computation that uses quantum-mechanical phenomena, such as superposition and entanglement, to perform operations on data. A quantum computer differs from a classical digital computer in that it uses quantum bits, or qubits, which can exist in superposition of states.

## Fundamental Concepts

The fundamental unit of classical computing is the bit, which can be either 0 or 1. By contrast, a qubit can be 0, 1, or any quantum superposition of those two states. This property is what enables quantum computers to process vast numbers of possibilities simultaneously.

## Origins and Development

The concept of quantum computing was first explored in the 1980s by physicist Richard Feynman, who proposed that a computer based on quantum mechanics could simulate physical processes that classical computers could not efficiently model. Since then, researchers have made significant progress in developing practical quantum computing systems.`,

    citizendium: `# Quantum Computing

Quantum computing is an emerging field of computation that exploits quantum mechanical phenomena to perform calculations. Unlike classical computers, quantum computers use quantum bits (qubits) that can exist in superposition states, potentially offering exponential speedups for certain computational problems.

## Theoretical Foundations

The theoretical foundations of quantum computing draw on quantum mechanics, computer science, and information theory. Key concepts include superposition, entanglement, and quantum interference, which together enable computational approaches impossible with classical systems.

## Technical Challenges

Building practical quantum computers presents significant technical challenges, including maintaining quantum coherence, implementing error correction, and scaling up the number of qubits. Researchers are pursuing multiple approaches including superconducting circuits, trapped ions, and photonic systems.

## Potential Applications

Quantum computers may eventually solve problems intractable for classical computers, including molecular simulation for drug discovery, optimization problems, and cryptographic applications. However, experts caution that practical quantum advantage for real-world problems remains a work in progress.`,

    newworld: `# Quantum Computing

Quantum computing represents a fundamental shift in how information can be processed. By harnessing the strange properties of quantum mechanics, these systems promise capabilities that transcend the limits of classical computation.

## Conceptual Basis

Understanding quantum computing requires grappling with concepts that challenge everyday intuition. The quantum world operates by different rules than the classical world we experience, allowing for phenomena like superposition and entanglement that have no classical analog.

## Historical Context

The development of quantum computing reflects broader trends in physics and computer science. The field emerged from theoretical insights in the 1980s and has since progressed through phases of theoretical development, experimental proof-of-concept, and now early commercialization.

## Implications

Quantum computing has implications that extend beyond pure computation, touching on questions of what is computable, the nature of physical reality, and the future of information technology. These considerations inform ongoing discussions about the societal impact of this emerging technology.`,
  },
};

/**
 * Get demo leaderboard data
 */
export function getDemoLeaderboard(): LeaderboardEntry[] {
  return DEMO_SOURCES.map(source => ({
    id: source.id,
    name: source.name,
    slug: source.slug,
    logo_url: source.logo_url,
    rating: source.rating,
    rating_deviation: source.rating_deviation,
    total_matches: source.total_matches,
    total_wins: source.total_wins,
    total_losses: source.total_losses,
    total_ties: source.total_ties,
    win_rate: source.total_matches > 0 
      ? Math.round((source.total_wins / source.total_matches) * 1000) / 10 
      : 0,
  })).sort((a, b) => b.rating - a.rating);
}

/**
 * Get a random demo topic
 */
export function getRandomDemoTopic(): Topic {
  return DEMO_TOPICS[Math.floor(Math.random() * DEMO_TOPICS.length)];
}

/**
 * Get demo content for a topic
 * Note: Content is source-agnostic to maintain blind comparison integrity
 */
export function getDemoContent(topicSlug: string, sourceSlug: string): string {
  const topicContent = DEMO_CONTENT[topicSlug];
  if (topicContent && topicContent[sourceSlug]) {
    return topicContent[sourceSlug];
  }
  
  // Find topic title
  const topic = DEMO_TOPICS.find(t => t.slug === topicSlug);
  const topicTitle = topic?.title || topicSlug.replace(/-/g, ' ');
  
  // Generate fallback content - varies by source type but without naming the source
  if (sourceSlug === 'wikipedia') {
    return `# ${topicTitle}

${topicTitle} is a topic of significant interest and research across multiple disciplines.

## Overview

The subject encompasses various aspects and has been studied extensively by researchers and practitioners in the field. Understanding ${topicTitle} requires examining both historical context and contemporary developments.

## Key Concepts

The fundamental principles underlying ${topicTitle} form the basis for deeper exploration. Scholars have identified several important areas of study within this domain.

## Significance

${topicTitle} continues to be an active area of research and discussion, with ongoing developments contributing to our understanding of this important subject.`;
  } else if (sourceSlug === 'grokipedia') {
    return `# ${topicTitle}

Let's explore ${topicTitle} in a way that's both informative and accessible.

## Understanding the Basics

${topicTitle} is a fascinating subject that touches on multiple areas of knowledge. At its core, it involves understanding key principles that have developed over time.

## Key Aspects

Important elements worth understanding:

- **Fundamental concepts** - The core ideas and their practical applications
- **Current developments** - Recent advances and future implications  
- **Broader connections** - How this relates to other fields of knowledge

## Why It Matters

Understanding ${topicTitle} provides valuable insights that can be applied across various contexts and disciplines.`;
  } else if (sourceSlug === 'britannica') {
    return `# ${topicTitle}

${topicTitle} represents an important area of human knowledge that has been extensively documented by experts and scholars worldwide.

## Introduction

The coverage of this topic draws upon centuries of accumulated knowledge and the expertise of leading authorities in the field. Understanding ${topicTitle} requires examining both its historical foundations and contemporary developments.

## Historical Development

The historical development of ${topicTitle} can be traced through multiple periods, each contributing unique insights to our current understanding.

## Contemporary Understanding

Contemporary perspectives reflect both traditional scholarship and cutting-edge research. Experts continue to refine our understanding through rigorous investigation and academic discourse.

## Significance

The practical applications and implications of ${topicTitle} extend across various domains, influencing education, research, and broader society.`;
  } else if (sourceSlug === 'citizendium') {
    return `# ${topicTitle}

${topicTitle} is a topic that has been carefully examined and documented through expert-guided research and review processes.

## Overview

Understanding ${topicTitle} requires a balanced examination of established facts and emerging knowledge. This topic has attracted attention from scholars across multiple disciplines.

## Core Concepts

The fundamental principles underlying ${topicTitle} have been refined through rigorous academic review. Key areas of focus include historical development, contemporary applications, and future implications.

## Expert Analysis

Expert contributors have identified several important dimensions of ${topicTitle} that merit careful consideration. These perspectives draw on peer-reviewed research and professional expertise.

## Practical Applications

The practical significance of ${topicTitle} extends to various fields, offering insights that inform both academic inquiry and real-world applications.`;
  } else if (sourceSlug === 'newworld') {
    return `# ${topicTitle}

${topicTitle} encompasses a range of knowledge and perspectives that contribute to a comprehensive understanding of this important subject.

## Introduction

This topic represents an area of study that connects multiple disciplines and areas of human inquiry. Understanding ${topicTitle} provides valuable context for broader questions of knowledge and meaning.

## Background

The historical and conceptual background of ${topicTitle} provides essential context for understanding its current significance. Scholars have traced its development through various periods and cultural contexts.

## Key Themes

Important themes within the study of ${topicTitle} include:

- Foundational concepts and their evolution
- Contemporary interpretations and applications
- Connections to broader areas of knowledge

## Significance

${topicTitle} continues to be relevant to ongoing discussions in education, research, and society. Its study offers perspectives that enrich our understanding of both specialized and general knowledge.`;
  }
  
  // Generic fallback
  return `# ${topicTitle}

${topicTitle} is a subject of interest and study across multiple disciplines.

## Overview

This topic encompasses various aspects that have been examined by researchers and practitioners. Understanding the fundamental concepts provides a foundation for deeper exploration.

## Key Points

The study of ${topicTitle} involves understanding its historical context, current applications, and future implications.`;
}

/**
 * Simulate a vote and return updated ratings
 */
export function simulateDemoVote(
  sourceA: Source,
  sourceB: Source,
  winner: 'a' | 'b' | 'tie'
): { sourceA: Source; sourceB: Source; changeA: number; changeB: number } {
  // Simple rating change simulation
  const K = 32; // Rating change factor
  
  const expectedA = 1 / (1 + Math.pow(10, (sourceB.rating - sourceA.rating) / 400));
  const expectedB = 1 - expectedA;
  
  let scoreA: number, scoreB: number;
  switch (winner) {
    case 'a': scoreA = 1; scoreB = 0; break;
    case 'b': scoreA = 0; scoreB = 1; break;
    default: scoreA = 0.5; scoreB = 0.5;
  }
  
  const changeA = Math.round(K * (scoreA - expectedA));
  const changeB = Math.round(K * (scoreB - expectedB));
  
  return {
    sourceA: { ...sourceA, rating: sourceA.rating + changeA },
    sourceB: { ...sourceB, rating: sourceB.rating + changeB },
    changeA,
    changeB,
  };
}
