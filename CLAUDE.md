# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project overview, features, gameplay, and installation instructions are in [README.md](README.md).

## Architecture

### Game State (`script.js:2`)

Single global object `gameState` drives everything: `isPlaying`, `isPaused`, `score`, `combo`, `mode`, `difficulty`, `currentTarget`, `currentIndex`, timers.

### Core Flow

1. `startGame()` → reset state, show game screen, start countdown
2. `nextTarget()` → generate next target based on mode
3. `handleInput()` → compare key against `currentTarget[currentIndex].toLowerCase()`
4. `handleCorrect()` / `handleWrong()` → scoring, combo, visual/audio feedback
5. `endGame()` → stop timers, show results, save to leaderboard

### Word Libraries

External JSON files in `words/` loaded via `fetch()` on grade selection. Each file has `easy`/`medium`/`hard` tiers. Built-in fallback if loading fails.

Available libraries defined in `wordLibraries` array (`script.js:26-32`). Add new grades by adding to this array and creating a JSON file.

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `loadWordList()` | `script.js:57` | Fetch word JSON, validate format |
| `nextTarget()` | `script.js:484` | Generate letter/character/word based on mode |
| `handleInput()` | `script.js:615` | Compare input vs expected char |
| `handleCorrect()` | `script.js:630` | Score, combo, advance to next target |
| `handleWrong()` | `script.js:677` | Reset combo, visual feedback |
| `pauseGame()` | `script.js:748` | Save/restore challenge timer via `Date.now()` delta |
| `updateLeaderboardDisplay()` | `script.js:186` | Show correct leaderboard for current mode×difficulty |
| `endGame()` | `script.js:776` | Stop timers, show results, save score |

### Edge Cases Handled

- **Challenge timer pause/resume** (`script.js:754-779`): Saves remaining time via `Date.now()` delta, resumes from where it left off.
- **Sound fallback** (`script.js:82-106`): `playSound()` silently catches audio errors.
- **Double-tap protection** (`script.js:656-662`): Challenge timer cleared before `nextTarget()` sets new one.
- **Word library fallback**: Hardcoded word arrays used when `fetch()` fails.

### Leaderboard (`script.js:828-996`)

- localStorage-backed, top 10 per mode×difficulty (12 boards: 4 modes × 3 difficulties)
- JSON export/import for backup/sharing
- Entry format: `{ score, accuracy, combo, timestamp }`

## Common Tasks

### Add a word library
1. Create `words/gradeN.json` with `easy`/`medium`/`hard` keys
2. Add entry to `wordLibraries` array (`script.js:26-32`)
3. Add button in `index.html` `.library-buttons`

### Add a new mode
1. Add button in `index.html` `.mode-selector`
2. Add handling in `nextTarget()` (`script.js:484`)
3. Add 3 leaderboard tables in `index.html` (easy/medium/hard)
4. Add mode name to `modeMap` in `updateLeaderboardDisplay()` (`script.js:199`)

### Modify game duration
`startGame()` (`script.js:408-411`): letter/character=60s fixed; word/challenge use difficulty-based (easy=60, medium=40, hard=30).

### Update difficulty-disabled logic
`setupEventListeners()` (`script.js:322-342`): letter/character modes disable difficulty buttons; word/challenge enable them.

## TODO

- [ ] 单词模式显示中文释义：词库 JSON 改为 `{ "en": "apple", "zh": "苹果" }` 格式，`nextTarget()` 读取 `currentTarget` 时附带中文，在 target-display 下方显示中文
