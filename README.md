# Motchi

A self-hosted anime streaming server with a clean, modern UI. Built for personal and family use.

![Motchi](https://img.shields.io/badge/Motchi-Anime%20Streaming-e11d48?style=for-the-badge)

## Features

- **Search & Browse** — Find anime by name or browse by genre with infinite scroll, persistent filters, and a live library count
- **Video Playback** — HLS and MP4 streaming with a custom player, playback speed control, and keyboard shortcuts
- **Skip OP/ED** — Automatic opening and ending skip detection via AniSkip
- **Sub/Dub Toggle** — Switch between sub and dub on any anime
- **Watch Progress** — Automatically saves your position so you can pick up where you left off
- **Continue Watching** — Homepage row shows episode artwork, titles, descriptions, and resume progress
- **Profiles** — Multiple profiles with optional PIN protection for family use
- **Watchlist** — Save or remove anime from Home, Browse, detail pages, and the Watchlist view itself
- **Device-Local Downloads** — Save episodes into browser storage for offline viewing on the same device, with grouped download management and retry/delete states
- **Episode Metadata** — Episode artwork, titles, and descriptions on detail and downloads pages when upstream data is available
- **Season Navigation** — Automatically groups and links related seasons
- **Trending** — Live trending data from AniList
- **Responsive** — Works on desktop, tablet, and mobile with a bottom tab bar
- **Self-Hosted** — Runs on your own machine, no cloud required
- **Remote Access** — Built-in Cloudflare tunnel for access from anywhere (phone, vacation, etc.)

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

Offline downloads are stored in the browser using IndexedDB, so they only appear on the device and browser profile where the download was created.

A Cloudflare tunnel is disabled by default. To expose your server remotely, install [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and set `ENABLE_TUNNEL=1`.

## Production Build

```bash
# Build frontend and compile server
npm run build

# Run the compiled server (serves both API and static frontend)
npm start

# Or run directly with tsx (no build needed)
PORT=3000 npx tsx server/index.ts

# Enable the Cloudflare tunnel explicitly
ENABLE_TUNNEL=1 npm start
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
  motchi
```

Access at `http://localhost:3001`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `CORS_ORIGIN` | Dev localhost origins | Comma-separated origins allowed to call the API directly |
| `ENABLE_TUNNEL` | `0` | Set to `1` to start the Cloudflare tunnel |
| `TUNNEL_DOMAIN` | — | Optional named tunnel domain for log messages |

Copy `.env.example` to `.env` to customize.

## Security Notes

- Local databases, downloads, and `.env` files are ignored by git and should stay untracked.
- In production, the safest default is same-origin hosting: serve the frontend and API from the same Motchi process and leave `CORS_ORIGIN` unset.
- Remote access is opt-in. Do not enable `ENABLE_TUNNEL=1` unless you intend to expose the instance beyond your local network.

## Project Structure

```
motchi/
├── server/              # Fastify backend
│   ├── db/              # SQLite schema + migrations
│   ├── routes/          # API endpoints
│   ├── services/        # Anime data, trending, skip times
│   └── lib/             # Shared validation helpers
├── src/                 # React frontend
│   ├── components/      # Reusable UI components, player, downloads provider
│   ├── pages/           # Route pages
│   └── lib/             # API client, types, text formatting helpers
└── data/                # SQLite database (auto-created)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend in development mode |
| `npm run build` | Build for production |
| `npm start` | Run production server |
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
