# WikiArena

> LMArena for online encylopeidas

WikiArena is a platform for comparing, rating, and synthesizing knowledge from sources like Wikipedia, Grokipedia, Encyclopedia Britannica, Citizendium, and New World Encyclopedia, using the Glicko-2 rating system through blind side-by-side comparisons.

![WikiArena](https://img.shields.io/badge/Stack-Svelte%20%2B%20Supabase-orange?style=for-the-badge)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

## The Thesis

The thesis for this project was really about wondering what source of information people like the most. 

 > Do people actually like Grokipedia?

## Features

- Arena comparisons: judge two sources side-by-side on the same topic
- Global leaderboard: real-time rankings with Glicko-2
- Vote history: track voting patterns and source preferences
- Knowledge blender: combine sources with AI synthesis (xAI Grok)
- Authentication: sign in to save history
- Responsive design: works on desktop and mobile
- Markdown rendering: formatting with tables and links

## Knowledge Sources

| Source | Description | API/Method |
|--------|-------------|------------|
| **Wikipedia** | Community-edited encyclopedia | MediaWiki Parse API |
| **Grokipedia** | AI-powered encyclopedia | Scraped from grokipedia.com |
| **Encyclopedia Britannica** | Expert-written since 1768 | Scraped from britannica.com |
| **Citizendium** | Expert-guided encyclopedia | MediaWiki API (HTML) |
| **New World Encyclopedia** | Editorial oversight encyclopedia | MediaWiki API (HTML) |

## Tech Stack

- Frontend: [SvelteKit](https://kit.svelte.dev/) + TypeScript
- Styling: [Tailwind CSS](https://tailwindcss.com/)
- Backend: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Realtime)
- Rating system: [Glicko-2](http://www.glicko.net/glicko/glicko2.pdf)
- AI synthesis: [xAI Grok API](https://docs.x.ai/) (for Knowledge Blender)
- Deployment: [Vercel](https://vercel.com/)
- Markdown: [Marked](https://marked.js.org/)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase CLI (optional, for local development)
- Supabase account
- xAI API key (for Knowledge Blender)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/wikiarena.git
   cd wikiarena
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env
   ```
   Fill in your credentials in `.env`.

4. Start the development server
   ```bash
   npm run dev
   ```

6. Open your browser at `http://localhost:5173`


## How It Works

### Arena Flow
1. User enters the Arena
2. System selects a random topic and two knowledge sources
3. Sources are shown anonymously as Source A vs Source B
4. User votes for their preference
5. Sources are revealed with Glicko-2 rating updates
6. Continue to next match or view leaderboard

### Knowledge Blender
1. Select sources and set weights
2. Enter a topic or search query
3. Content is fetched from enabled sources
4. xAI Grok synthesizes a unified article
5. View quality metrics and Shapley value analysis

### Glicko-2 Rating System
- **Rating (μ)**: Estimate, starting at 1500
- **Rating Deviation (φ)**: Uncertainty, starting at 350
- **Volatility (σ)**: Expected fluctuation, starting at 0.06

The system takes into account:
- Opponent strength (beating higher-rated sources gives more points)
- Rating confidence (new sources have higher uncertainty)
- Activity level (inactive sources become less certain over time)

## API Integration

- **Wikipedia**: Uses the [MediaWiki Parse API](https://www.mediawiki.org/wiki/API:Parsing_wikitext) with HTML-to-Markdown conversion and link preservation.
- **Grokipedia**: Scrapes [grokipedia.com](https://grokipedia.com/page/{topic}) and updates links to absolute URLs.
- **Encyclopedia Britannica**: Scrapes [britannica.com](https://www.britannica.com), fetching articles and handling links, falling back to demo content if needed.
- **Citizendium & New World Encyclopedia**: Use the MediaWiki API with HTML extracts for link preservation.
- **xAI Grok (Knowledge Blender)**: Server-side synthesis; requires an [xAI API key](https://console.x.ai/).

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Type-check the codebase
npm run lint         # Lint the codebase
npm run format       # Format with Prettier
```


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file.

## Acknowledgments

- Inspired by [LMSYS Chatbot Arena](https://lmarena.ai/)
- Glicko-2 algorithm by Mark Glickman
- Built with Svelte, Supabase, and xAI

---

<p align="center">
  <strong>WikiArena</strong> — Where knowledge sources compete for truth.
</p>
