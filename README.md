# CascadeCoop

A collaborative Rube Goldberg machine game built on [Reddit's Devvit platform](https://developers.reddit.com/). Every 24 hours, a new board generates. Each Redditor gets one random piece to place — work together to build a marble run and compete for the daily high score.

Built for the **2026 Reddit Hackathon**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | [Phaser 4](https://phaser.io/) (2D game engine) |
| Physics | Matter.js (via Phaser) |
| Styling | CSS with glassmorphism (Outfit font) |
| Build Tool | [Vite 8](https://vite.dev/) |
| Backend | [Hono](https://hono.dev/) (serverless) |
| Storage | Redis (via `@devvit/web/server`) |
| API Layer | REST (typed fetch helpers) |
| Testing | [Vitest](https://vitest.dev/) |
| Language | TypeScript 6 |
| Platform | [Devvit](https://developers.reddit.com/) (Reddit app framework) |

---

## Architecture

```
src/
├── client/               # Frontend (Phaser game)
│   ├── game.ts           # Phaser game config + bootstrap
│   ├── game.html         # Expanded view entrypoint
│   ├── game.css          # Glassmorphism UI styles
│   ├── splash.ts         # Inline Reddit feed view
│   ├── splash.html/css   # Splash entrypoint
│   ├── api.ts            # Typed fetch helpers
│   ├── scenes/
│   │   ├── Boot.ts       # Boot → Preloader → MainMenu → Game
│   │   ├── Preloader.ts  # Procgen textures + init data fetch
│   │   ├── MainMenu.ts   # Title screen
│   │   └── Game.ts       # Core gameplay (~870 lines)
│   ├── physics/
│   │   ├── MarblePool.ts # Object pool (200 recycled marbles)
│   │   └── PieceTypes.ts # Piece definitions (5 types)
│   └── utils/
│       └── AudioManager.ts # Web Audio API synth sounds
├── server/               # Backend (Hono + Redis)
│   ├── index.ts          # Hono app bootstrap
│   ├── routes/
│   │   ├── api.ts        # REST endpoints
│   │   ├── menu.ts       # Menu actions
│   │   └── triggers.ts   # Install triggers
│   └── core/
│       ├── storage.ts    # Redis data layer
│       └── post.ts       # Post creation
└── shared/
    ├── api.ts            # Shared TypeScript types
    └── validation.test.ts # Vitest tests
```

## Gameplay

1. **Daily Board** — A fresh collaborative board resets every day at UTC midnight
2. **One Piece Per Day** — Each user gets one random piece (Ramp, Bumper, Gravity Well, Slide, or Block)
3. **Rotate & Place** — Press R or tap Rotate to spin before placing
4. **Simulate** — Drop 50 marbles and watch them cascade through the machine
5. **Score** — Marbles landing in goal zones earn points (10/25/50/100)
6. **Leaderboard** — Only your best run each day counts

## Features

### Gameplay
- 5 physics piece types with unique properties (friction, restitution, density)
- Gravity wells with force-field visuals and gravitational pull
- Real-time marble physics with object pooling
- 4 colored goal zones with increasing point values
- Round-end detection and automatic score submission

### Security
- Server-side input validation (type whitelist, coordinate bounds, rotation check)
- Rate limiting (2s per-user window on placement)
- Redis lock (5s TTL) preventing double placement
- Username sanitization (alphanumeric only, anonymous fallback with unique suffix)
- Score bounds validation (0–10,000)
- 7-day TTL on all stored data
- 200-piece board capacity cap

### UX
- Glassmorphism UI (blur, backdrop-filter, hover animations)
- Procedural textures with Canvas 2D gradients and bevels
- Countdown timer to next daily board
- Piece attribution on hover ("placed by u/username")
- Particle burst effects on scoring
- Web Audio synth sounds (placement, score, sim start, round end)
- Step-by-step tutorial overlay on first play
- Help modal with game rules
- Mobile-friendly rotate button

### Performance
- Delta time accumulator with 100ms cap (prevents spiral-of-death)
- Marble object pool (no GC pressure during simulation)
- Fixed timestep physics (60 FPS)
- Board auto-refresh every 60s (no polling spam)

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server (Reddit playtest) |
| `npm run build` | Build client and server |
| `npm run deploy` | Type-check + lint + upload to Reddit |
| `npm run launch` | Deploy + publish for review |
| `npm run test` | Run Vitest suite (18 tests) |
| `npm run lint` | ESLint check |
| `npm run type-check` | TypeScript compiler check |
| `npm run login` | Log CLI into Reddit |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/init` | Get post ID and username |
| GET | `/api/board/state` | Get today's board pieces |
| POST | `/api/board/place` | Place a piece (rate-limited, validated) |
| GET | `/api/user/status` | Get user profile + daily piece |
| GET | `/api/leaderboard` | Get today's top scores |
| POST | `/api/score/submit` | Submit a run score |
| POST | `/internal/menu/post-create` | Create a new post (mod only) |
| POST | `/internal/triggers/on-app-install` | App install hook |

## Tests

```bash
npm test
```

18 tests covering:
- Server-side placement validation (type, bounds, rotation)
- Score submission validation (range, NaN, non-number)
- Username sanitization (special chars, empty, anonymous fallback)

## Credits

Built with the [Devvit Phaser template](https://github.com/phaserjs/template-vite-ts) by the Phaser team.
