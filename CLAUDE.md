# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**键盘小达人 (Keyboard Master)** — A browser-based typing practice game for elementary school students (3rd grade). Zero build tools, zero dependencies — open `index.html` in a browser and play.

- **Location**: `demo/type/`
- **Tech Stack**: Vanilla HTML/CSS/JS
- **Persistence**: localStorage (leaderboard data)
- **Audio**: Web Audio API via `<audio>` elements, silent fallback if MP3 files missing

## Quick Start

```bash
# Option 1: Open directly
start index.html

# Option 2: Local server (needed for audio to work)
cd demo/type && python -m http.server 8080
# Then open http://localhost:8080
```

## Architecture

### File Structure (~2220 lines total)

```
demo/type/
├── index.html       # Page structure + virtual keyboard + game/result screens
├── styles.css       # All styling, animations, responsive layout
├── script.js        # All game logic
├── sounds/          # 5 MP3 files (bg_music, key, correct, wrong, levelup)
├── README.md        # Chinese documentation
└── CLAUDE.md        # This file
```

### Game State (script.js:2)

Single global object `gameState` drives everything: `isPlaying`, `isPaused`, `score`, `combo`, `mode`, `difficulty`, `currentTarget`, `currentIndex`, timers.

### Three Modes

| Mode | Behavior | Special Logic |
|------|----------|--------------|
| **Letter** | Random single A-Z/0-9 chars | Pure-letters toggle excludes numbers/punctuation; I/l confusion avoidance (I→i, l→L) |
| **Word** | Random words from built-in `wordList` (3 tiers, ~140+ words) | 2× score multiplier |
| **Challenge** | Timed per-character input | `challengeTimeout`: easy=3s, medium=2s, hard=1s; auto-mark wrong on timeout |

### Core Flow

1. `startGame()` → reset state, show game screen, start countdown
2. `nextTarget()` → generate next letter/word, set challenge timer if mode=challenge
3. `handleInput()` → compare key against `currentTarget[currentIndex].toLowerCase()`
4. `handleCorrect()` / `handleWrong()` → scoring, combo, visual/audio feedback
5. `endGame()` → stop timers, show results, save to leaderboard

### Edge Cases Noticed

- **Pause/resume challenge timer** (script.js:742-752): When unpausing in challenge mode, the timer is restarted with the original `challengeTimeout` — but the remaining time from before the pause is lost.
- **Import leaderboard bug** (script.js:964): `updateLeaderboardDisplay(mode, difficulty)` passes arguments, but the function takes none — it reads from `gameState.mode`/`gameState.difficulty` instead. The call still works (ignores args) but doesn't force-refresh the displayed board.
- **Sound fallback** (script.js:89-107): `playSound()` silently catches audio errors — game runs normally with missing MP3 files.
- **Double-tap protection** (script.js:656-662): When completing a target, the challenge timer is cleared before `nextTarget()` sets a new one, preventing stale timeouts from marking the next target as wrong.

### Scoring

- Base: 10 pts per correct input
- Combo bonus: +5 at 5+ combo, +10 at 10+ combo
- Word mode: 2× multiplier

### Leaderboard (script.js:813-985)

- localStorage-backed, top 10 per mode×difficulty combination (9 boards total)
- Supports JSON export/import for backup/sharing
- Each entry: `{ score, accuracy, combo, timestamp }`

## Common Tasks

### Add/modify words
Edit `wordList` object in `script.js:26`. Three tiers: `easy` (2-3 letters), `medium` (4-5), `hard` (6+).

### Sound files
Located in `sounds/`. Game runs silently if files are absent — no errors thrown.

### Modify game duration
`startGame()` (script.js:361): `timeLeft` is set per-difficulty — easy=60s, medium=40s, hard=30s.

### Add a new mode
1. Add mode button in `index.html` `.mode-selector`
2. Add mode handling in `nextTarget()` (script.js:463)
3. Add leaderboard tables in `index.html` (3 difficulty variants)
4. The mode is auto-detected by `updateLeaderboardDisplay()` via `leaderboard-${mode}-${difficulty}` ID pattern
