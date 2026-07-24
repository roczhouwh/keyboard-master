# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**键盘小达人 (Keyboard Master)** — A browser-based typing practice game for elementary school students. Zero build tools, zero dependencies — open `index.html` in a browser and play.

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

### File Structure (~2200 lines total)

```
demo/type/
├── index.html       # Page structure + virtual keyboard + game/result screens
├── styles.css       # All styling, animations, responsive layout
├── script.js        # All game logic
├── words/           # External word library JSON files (per grade)
│   ├── grade3.json
│   ├── grade4.json
│   ├── grade5.json
│   └── grade6.json
├── sounds/          # 5 MP3 files (bg_music, key, correct, wrong, levelup)
├── README.md        # Chinese documentation
└── CLAUDE.md        # This file
```

### Game State (script.js:2)

Single global object `gameState` drives everything: `isPlaying`, `isPaused`, `score`, `combo`, `mode`, `difficulty`, `currentTarget`, `currentIndex`, timers.

### Four Modes

| Mode | Behavior | Difficulty生效 | Special Logic |
|------|----------|---------------|--------------|
| **Letter** | Random single A-Z a-z | ❌ (固定60s) | I/l confusion avoidance (I→i, l→L) |
| **Character** | Random A-Z a-z 0-9 , . / | ❌ (固定60s) | 大小写随机 + 混淆处理 |
| **Word** | Random words from external JSON library | ✅ 时长 + 词库tier | 2× score multiplier |
| **Challenge** | Timed letter input | ✅ 超时时间 | easy=3s, medium=2s, hard=1s |

### Word Libraries (words/)

External JSON files loaded via `fetch()` on mode/grade selection. Each file has `easy`/`medium`/`hard` tiers. Built-in fallback words if loading fails.

Available libraries are defined in `wordLibraries` array (`script.js:26-32`).

### Core Flow

1. `startGame()` → reset state, show game screen, start countdown
2. `nextTarget()` → generate next letter/word/character based on mode
3. `handleInput()` → compare key against `currentTarget[currentIndex].toLowerCase()`
4. `handleCorrect()` / `handleWrong()` → scoring, combo, visual/audio feedback
5. `endGame()` → stop timers, show results, save to leaderboard

### Edge Cases Handled

- **Challenge timer pause/resume** (script.js:754-779): Saves remaining time via `Date.now()` delta, resumes from where it left off rather than restarting.
- **Sound fallback** (script.js:82-106): `playSound()` silently catches audio errors — game runs normally with missing MP3 files.
- **Double-tap protection** (script.js:656-662): When completing a target, the challenge timer is cleared before `nextTarget()` sets a new one, preventing stale timeouts from marking the next target as wrong.
- **Word library fallback**: If fetch fails, falls back to hardcoded word arrays.

### Scoring

- Base: 10 pts per correct input
- Combo bonus: +5 at 5+ combo, +10 at 10+ combo
- Word mode: 2× multiplier

### Leaderboard (script.js:828-996)

- localStorage-backed, top 10 per mode×difficulty combination (12 boards: 4 modes × 3 difficulties)
- Supports JSON export/import for backup/sharing
- Each entry: `{ score, accuracy, combo, timestamp }`

## Common Tasks

### Add/modify word libraries
1. Add a new JSON file in `words/` (e.g., `grade7.json`)
2. Add its entry to `wordLibraries` array in `script.js:26-32`
3. Add a corresponding button in `index.html` `.library-buttons`

### Sound files
Located in `sounds/`. Game runs silently if files are absent — no errors thrown.

### Modify game duration
`startGame()` (script.js:408-411): Letter/character modes fixed at 60s; word/challenge modes use difficulty-based timing (easy=60s, medium=40s, hard=30s).

### Add a new mode
1. Add mode button in `index.html` `.mode-selector`
2. Add mode handling in `nextTarget()` (script.js:492)
3. Add leaderboard tables in `index.html` (3 difficulty variants)
4. The mode is auto-detected by `updateLeaderboardDisplay()` via `leaderboard-${mode}-${difficulty}` ID pattern
