# Dev Log

## Phase 0: Project Initialization

### 2026-07-09
- Ran `git init` to initialize empty repo
- Added remote origin: https://github.com/Amitk003/CommunalCascade.git
- Created LOGS.md for tracking all commands and changes
- Created .gitignore
- Set Git user config for commits
- Ran `npm create devvit@latest --template=phaser` in a separate temp directory to scaffold the Devvit + Phaser template (app name: cascadecoop)
- Copied the scaffolded template files into the project root
- Removed old `node_modules` and ran `npm install` to install template dependencies (phaser 4.2.0, hono, devvit 0.13.7, etc.)
- Moved assets from `public/assets/` to `src/client/assets/` to match template's expected asset paths

## Phase 1: Core Game Engine

### Branches: `physics-engine`, `gameplay-loop`, `piece-rotation-and-wells`

- Set up Phaser Matter.js physics with gravity, walls, and collision categories
- Built MarblePool object pool (200 recycled marble sprites)
- Created 5 piece types: Ramp, Bumper, Gravity Well, Slide, Block
- Implemented goal zones with scoring (10, 25, 50, 100 points)
- Added marble spawn zone and off-screen recycling
- Implemented gravity well force-field sensor + gravitational pull on marbles
- Added piece rotation (R key) with 45-degree increments
- Built piece placement flow: server validation → Redis storage → board render
- Added round-end detection (all marbles depleted → submit score → leaderboard)
- Fixed simulation button toggle (Simulate ↔ Reset) and event listener leaks

## Phase 2: Backend & API

### Branches: `devvit-backend`, `frontend-api`

- Added Hono API routes: `/init`, `/board/state`, `/board/place`, `/user/status`, `/leaderboard`, `/score/submit`
- Built Redis storage layer with atomic board writes (watch/multi/exec retry loop)
- Implemented daily piece assignment (random selection from 5 types)
- Added user profiles with daily piece tracking and placement history
- Built leaderboard with Redis sorted sets (highest score per user)
- Connected frontend API module with typed fetch helpers
- Added Vue/React-style clone-node pattern to prevent event listener leaks on scene restart

## Phase 3: Security & Reliability

### Branch: `security-and-scaling-fixes`

- Added server-side input validation on `/board/place` (type whitelist, x/y bounds, rotation finite check)
- Implemented Redis-based lock (5s TTL) to prevent double placement
- Added rate limiter (2s per-user window) on placement endpoint
- Set 7-day TTL expiry on all board and leaderboard keys
- Capped board at 200 pieces max
- Added score bounds validation (0–10000) on `/score/submit`
- Sanitized usernames (strip non-alphanumeric chars) for Redis sorted set members
- Anonymous users get unique `anonymous_{postId}` suffix to prevent score collisions
- Fixed async context leak in Devvit Hono routers (extract `subredditName` before first `await`)

## Phase 4: UX Polish

### Branch: `ux-polish`

- Added rotation hint in placement status: "Tap to place. Press R or tap Rotate to spin."
- Added `?` help button with How-to-Play modal overlay
- Bumped gravity well ring opacity from 0.03/0.15 to 0.08/0.3
- Leaderboard only auto-opens on round end if already visible
- Score label shows "Run:" during simulation, "Submitted: X!" for 2s after round end, then reverts to "Score:"
- Replaced file-based asset loading with procedural Canvas texture generation
- Added live UTC-midnight countdown timer ("Next board in: HH:MM:SS")
- Added piece attribution on hover ("Ramp — placed by u/username")
- Added particle burst effect (tweened circles) on goal score
- Added Web Audio API synth sounds: placement chime, score arpeggio, sim start sweep, round-end fanfare
- Added step-by-step tutorial overlay on first placement
- Added board auto-refresh every 60s to pick up new placements
- Removed dead-end GameOver scene (sandbox has no game over)
- Added delta cap (100ms) to prevent physics spiral-of-death
- Set up Vitest with 18 tests for validation, score bounds, and username sanitization

## Phase 5: Visual Overhaul

### Branch: `ux-polish` (continued)

- Rewrote procedural textures using native Canvas 2D API with gradients, bevels, and highlights
- Marble: radial gradient gold/amber with white specular highlight
- Bumper: neon red radial gradient with dark metal base and glow ring
- Gravity Well: purple/magenta fade to transparent with orbital rings
- Ramp & Slide: linear gradient slate-to-blue with cyan top-edge stroke
- Block: gray gradient with subtle border
- Added tech grid background overlay (40px spacing, 3% opacity)
- Full CSS glassmorphism overhaul: Outfit font, backdrop-filter blur, hover scale animations, gold-accented leaderboard panel, glow shadows on buttons

## Phase 6: Repository Cleanup

- Created `main` branch from `ux-polish` and pushed to GitHub
- Set `main` as default branch on GitHub
