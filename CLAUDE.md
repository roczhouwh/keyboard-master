# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**键盘小达人 (Keyboard Master)** — A browser-based typing practice game for elementary school students (3rd grade).

- **Location**: `demo/type/`
- **Tech Stack**: Vanilla HTML/CSS/JavaScript — no frameworks, no build tools, no bundler
- **Persistence**: localStorage (leaderboard data)
- **Audio**: Web Audio API via `<audio>` elements with MP3 files

## Architecture

### File Structure
```
demo/type/
├── index.html       # Page structure + virtual keyboard + game/result screens (~341 lines)
├── styles.css       # All styling, animations, responsive layout (~629 lines)
├── script.js        # All game logic (~1020 lines)
├── README.md        # Full Chinese documentation (236 lines)
├── CLAUDE.md        # This file
└── sounds/          # MP3 audio files (5 files: bg_music, key, correct, wrong, levelup)
```

### Game State Management (script.js)

**Single global state object** (`gameState`, line 2) manages everything: `isPlaying`, `score`, `combo`, `mode`, `difficulty`, `currentTarget`, timers, etc.

### Three Game Modes

| Mode | Description |
|------|-------------|
| **Letter** | Random single letters (supports pure-letters toggle — only A-Z) |
| **Word** | Random words from built-in `wordList` (easy/medium/hard tiers, ~140+ words) |
| **Challenge** | Timed letter input, per-character timeout (easy=3s, medium=2s, hard=1s) |

### Core Flow
1. `startGame()` → resets state, shows game screen, starts countdown timer
2. `nextTarget()` → generates next letter/word based on mode + difficulty
3. `handleInput()` → routes keyboard or virtual-key click to correct/wrong
4. `handleCorrect()` / `handleWrong()` → scoring, combo tracking, visual/audio feedback
5. `endGame()` → stops timer, shows results screen, saves score to leaderboard

### Scoring System
- Base: 10 points per correct input
- Combo bonus: +5 at 5+ combo, +10 at 10+ combo
- Word mode: 2× multiplier

### Leaderboard (lines 813–985)
- localStorage-backed, top 10 per mode/difficulty combination (9 total leaderboards)
- Supports JSON export/import for backup and sharing
- Each entry: `{ score, accuracy, combo, timestamp }`

### Word List (lines 26–50)
- Built-in array (not loaded from external file)
- Three tiers: easy (2-3 letter words), medium (4-5 letters), hard (6+ letters)

## Running

```bash
# Option 1: Open directly
start index.html

# Option 2: Local server (recommended for audio)
cd demo/type && python -m http.server 8080
# Then open http://localhost:8080
```

## Common Tasks

### Add/modify words
Edit `wordList` object in `script.js` (line 26). Three tiers: `easy`, `medium`, `hard`.

### Sound files
Located in `sounds/`. Game runs silently if files are absent — no errors thrown.

### Leaderboard data format
```json
{
  "version": "1.0",
  "exportDate": "2026-07-20T...",
  "leaderboard": {
    "letter": { "easy": [...], "medium": [...], "hard": [...] },
    "word": { "easy": [...], "medium": [...], "hard": [...] },
    "challenge": { "easy": [...], "medium": [...], "hard": [...] }
  }
}
```
