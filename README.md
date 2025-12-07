# WikiArena

> Compare knowledge sources head-to-head. Vote for your preferred information style. Shape the global leaderboard.

WikiArena is a crowdsourced evaluation platform that allows users to compare and rate knowledge sources (Wikipedia, Grokipedia, Encyclopedia Britannica, Citizendium, and New World Encyclopedia) through blind side-by-side comparisons using the **Glicko-2 rating system**.

![WikiArena](https://img.shields.io/badge/Stack-Svelte%20%2B%20Supabase-orange?style=for-the-badge)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

## ✨ Features

- **⚔️ Arena Comparisons** - Compare two knowledge sources side-by-side on the same topic
- **🏆 Global Leaderboard** - Real-time rankings using Glicko-2 rating system
- **📊 Vote History** - Track your voting patterns and source preferences
- **🧪 Knowledge Blender** - Combine sources with AI synthesis (powered by xAI Grok)
- **🔐 Authentication** - Sign in to save your voting history across devices
- **📱 Responsive Design** - Works on desktop and mobile
- **✨ Markdown Rendering** - Beautiful formatting with tables and links

## 📚 Knowledge Sources

| Source | Description | API/Method |
|--------|-------------|------------|
| **Wikipedia** | Community-edited encyclopedia | MediaWiki Parse API |
| **Grokipedia** | AI-powered encyclopedia | Scraped from grokipedia.com |
| **Encyclopedia Britannica** | Expert-written since 1768 | Scraped from britannica.com |
| **Citizendium** | Expert-guided encyclopedia | MediaWiki API (HTML) |
| **New World Encyclopedia** | Editorial oversight encyclopedia | MediaWiki API (HTML) |

## 🛠️ Tech Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) + TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Realtime)
- **Rating System**: [Glicko-2](http://www.glicko.net/glicko/glicko2.pdf)
- **AI Synthesis**: [xAI Grok API](https://docs.x.ai/) (for Knowledge Blender)
- **Deployment**: [Vercel](https://vercel.com/)
- **Markdown**: [Marked](https://marked.js.org/)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase CLI (optional, for local development)
- Supabase account
- xAI API key (required for Knowledge Blender)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wikiarena.git
   cd wikiarena
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   ```bash
   # Login to Supabase
   npx supabase login

   # Link to your project (or create new)
   npx supabase link --project-ref your-project-ref

   # Push database schema
   npx supabase db push
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your credentials:
   ```env
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   XAI_API_KEY=your-xai-api-key  # Required for Knowledge Blender
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 🚀 Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/wikiarena)

### Manual Deploy

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/wikiarena.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel will auto-detect SvelteKit

3. **Configure Environment Variables**
   In Vercel dashboard, add:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `XAI_API_KEY` (required for Knowledge Blender)

4. **Deploy**
   Click "Deploy" and Vercel will build and deploy your app!

### Vercel CLI Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

## 📁 Project Structure

```
wikiarena/
├── docs/                     # Documentation
│   ├── PRD.md               # Product Requirements
│   ├── ARCHITECTURE.md      # Technical Architecture
│   └── ROADMAP.md           # Development Roadmap
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte components
│   │   ├── services/        # API services & Glicko-2
│   │   ├── stores/          # Svelte stores
│   │   └── types/           # TypeScript types
│   ├── routes/              # SvelteKit routes
│   │   ├── arena/           # Arena comparison page
│   │   ├── leaderboard/     # Rankings page
│   │   ├── blend/           # Knowledge blender page
│   │   ├── history/         # Vote history page
│   │   ├── faq/             # FAQ/How it works page
│   │   └── api/             # API endpoints
│   ├── app.css              # Global styles
│   └── app.html             # HTML template
├── sql/                     # SQL scripts
├── package.json
└── README.md
```

## 🎮 How It Works

### Arena Flow
1. User enters the Arena
2. System selects a random topic and two knowledge sources
3. Sources are displayed anonymously (Source A vs Source B)
4. User reads both explanations and votes for their preference
5. Sources are revealed with Glicko-2 rating changes
6. User can continue to next match or view leaderboard

### Knowledge Blender
1. Select which sources to include and set weights
2. Enter a topic or search query
3. Content is fetched from all enabled sources
4. xAI Grok synthesizes the content into a unified article
5. View quality metrics and Shapley value analysis

### Glicko-2 Rating System
- **Rating (μ)**: Skill estimate, starting at 1500
- **Rating Deviation (φ)**: Uncertainty in rating, starting at 350
- **Volatility (σ)**: Expected fluctuation, starting at 0.06

The system accounts for:
- Opponent strength (beating a higher-rated source = more points)
- Rating confidence (new sources have higher uncertainty)
- Activity level (inactive sources become less certain over time)

## 🗄️ Database Schema

```sql
-- Core tables
sources          -- Knowledge sources (Wikipedia, Grokipedia, etc.)
topics           -- Topics/queries for comparison
matches          -- Comparison sessions
votes            -- User votes on matches
user_preferences -- Aggregated user preferences
blend_configs    -- User's blend configurations
rating_history   -- Historical rating data for charts
```

## 🔌 API Integration

### Wikipedia
Uses the [MediaWiki Parse API](https://www.mediawiki.org/wiki/API:Parsing_wikitext) to fetch full article content with HTML-to-Markdown conversion preserving links.

### Grokipedia
Scrapes content directly from [grokipedia.com](https://grokipedia.com/page/{topic}). Converts relative links to absolute URLs.

### Encyclopedia Britannica
Scrapes content from [britannica.com](https://www.britannica.com). Searches for articles then fetches full content with proper link handling. Falls back to demo content if unavailable.

### Citizendium & New World Encyclopedia
Uses MediaWiki API with HTML extracts (not plain text) to preserve internal links. Converts wiki links to absolute URLs.

### xAI Grok (Knowledge Blender)
Requires an [xAI API key](https://console.x.ai/). Used server-side to synthesize content from multiple sources into a unified article.

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Type-check the codebase
npm run lint         # Lint the codebase
npm run format       # Format with Prettier
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [LMSYS Chatbot Arena](https://lmarena.ai/)
- Glicko-2 algorithm by Mark Glickman
- Built with Svelte, Supabase, and xAI

---

<p align="center">
  <strong>WikiArena</strong> — Where knowledge sources compete for truth.
</p>
