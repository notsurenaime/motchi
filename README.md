# Motchi

A self-hosted anime streaming server with a clean, modern UI. Built for personal and family use.

![Motchi](https://img.shields.io/badge/Motchi-Anime%20Streaming-e11d48?style=for-the-badge)

## Features

- **Search & Browse** — Find anime by name or browse by genre with infinite scroll
- **Video Playback** — HLS and MP4 streaming with a custom player, playback speed control, and keyboard shortcuts
- **Skip OP/ED** — Automatic opening and ending skip detection via AniSkip
- **Sub/Dub Toggle** — Switch between sub and dub on any anime
- **Watch Progress** — Automatically saves your position so you can pick up where you left off
- **Continue Watching** — Homepage row shows your in-progress series
- **Profiles** — Multiple profiles with optional PIN protection for family use
- **Watchlist** — Save anime for later from any page
- **Downloads** — Download episodes for offline viewing
- **Season Navigation** — Automatically groups and links related seasons
- **Trending** — Live trending data from AniList
- **Responsive** — Works on desktop, tablet, and mobile with a bottom tab bar
- **Self-Hosted** — Runs on your own machine, no cloud required

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, TanStack Query, Tailwind CSS 4 |
| Backend | Fastify 5, Node.js |
| Database | SQLite via Drizzle ORM |
| Video | HLS.js, custom player with controls |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/notsurenaime/motchi.git
cd motchi

# Install dependencies
npm install

# Start development server (frontend + backend)
npm run dev
```

The app will be available at `http://localhost:3000`. The API server runs on port `3001`.

## Production Build

```bash
# Build frontend and compile server
npm run build

# Run the compiled server (serves both API and static frontend)
node dist/server/index.js
```

## Docker

```bash
# Build the image
docker build -t motchi .

# Run the container
docker run -d \
  --name motchi \
  -p 3001:3001 \
  -v motchi-data:/app/data \
  -v motchi-downloads:/app/downloads \
  motchi
```

Access at `http://localhost:3001`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |

Copy `.env.example` to `.env` to customize.

## Project Structure

```
motchi/
├── server/              # Fastify backend
│   ├── db/              # SQLite schema + migrations
│   ├── routes/          # API endpoints
│   ├── services/        # Anime data, trending, skip times
│   └── lib/             # Shared validation helpers
├── src/                 # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route pages
│   └── lib/             # API client, types
├── data/                # SQLite database (auto-created)
└── downloads/           # Downloaded episodes (auto-created)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend in development mode |
| `npm run build` | Build for production |
| `npm run lint` | Type-check with TypeScript |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run database migrations |

## Keyboard Shortcuts (Video Player)

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `←` / `→` | Seek ±5 seconds |
| `J` / `L` | Seek ±10 seconds |
| `↑` / `↓` | Volume ±10% |

## License

[MIT](LICENSE)
