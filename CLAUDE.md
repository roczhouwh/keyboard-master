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

### 首页分步向导（开始界面）

开始界面是两步向导：`#stepMode`（选模式）→ `#stepSettings`（设置 + 开始）。每模式只显示自己需要的设置，无关选项不出现。

- **`MODE_SETTINGS`** (`script.js:25`)：声明每个模式显示的设置组与是否展示排行榜。
  - `letter`/`character`：无设置组（不显示设置卡片，只显示开始按钮），有排行榜
  - `word`：`difficulty` + `library`，有排行榜
  - `learn`：`library` + `batch` + `progress`，**无**排行榜
  - `challenge`：`difficulty`，有排行榜
- **`MODE_SETTING_GROUPS`** (`script.js:33`)：设置组 key → DOM 元素 id。
- **`MODE_NAMES`** (`script.js:40`)：模式显示名。
- 核心函数：`showStartStep(step)`、`renderSettingsForMode(mode)`、`goModeStep(mode)`、`goBackToModeSelect()`。
- 设置区收进 `.settings-card`：flex 纵向布局，`space-evenly` 让各组按钮垂直均分间距；开始按钮在卡片外居中。
- 排行榜可折叠（`#leaderboardToggle` 点击展开/收起），学单词模式隐藏。

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

### 学单词模式（Learn Mode）

独立于计时游戏的记忆/拼写练习模式，地位于 `startGame()`/`endGame()`/`handleInput()` 的分支路由中（`mode === 'learn'`）。

- **两阶段流程**：每词先「看词」（英文+中文照打）再「默写」（仅中文，按记忆打英文）。
- **无全局倒计时**：错词进复习队列，本局结束前再考直到答对。
- **进度持久化**：localStorage key `keyboardMaster_learnProgress`，结构 `{ [libraryId]: { [wordEn]: 'new'|'learning'|'mastered' } }`。默写一次通过→`mastered`；有错或看答案→`learning`。
- **批次**：默认 10 词（可调 10/20/30），从当前年级全部 tier 取词，未掌握优先（`buildLearnBatch()`）。
- 核心函数：`startLearnGame()`、`renderLearnWord()`、`handleLearnInput()`、`onLearnWordComplete()`、`advanceLearnWord()`、`revealLearnAnswer()`、`endLearnGame()`、`updateLearnProgress()`。
- 学习状态存于独立对象 `learnState`（避免被 `startGame()` 的 gameState 重置覆盖）。
- **不参与排行榜**：`updateLeaderboardDisplay()` 对 `mode === 'learn'` 直接隐藏所有排行榜。

### Leaderboard (`script.js:828-996`)

- localStorage-backed, top 10 per mode×difficulty (12 boards: 4 modes × 3 difficulties; learn mode excluded)
- JSON export/import for backup/sharing
- Entry format: `{ score, accuracy, combo, timestamp }`

## Common Tasks

### Add a word library
1. Create `words/gradeN.json` with `easy`/`medium`/`hard` keys
2. Add entry to `wordLibraries` array (`script.js:26-32`)
3. Add button in `index.html` `.library-buttons`

### Add a new mode
1. Add a mode card in `index.html` `.mode-cards` (`.mode-card[data-mode]`)
2. Add entry to `MODE_SETTINGS` (`script.js:25`)：声明该模式需要的设置组与是否展示排行榜
3. Add mode name to `MODE_NAMES` (`script.js:40`)
4. Add handling in `nextTarget()` (`script.js:484`)
5. Add 3 leaderboard tables in `index.html` (easy/medium/hard)
6. Add mode name to `modeMap` in `updateLeaderboardDisplay()` (`script.js:199`)

### Modify game duration
`startGame()` (`script.js:462-464`) + `updateStats()` (`script.js:861-863`): letter/character/word=60s fixed; challenge uses difficulty-based (easy=60, medium=40, hard=30). Word mode difficulty only affects word length, not duration.

### Per-mode settings (wizard)
`renderSettingsForMode()` (`script.js:57`) 按 `MODE_SETTINGS[mode].groups` 只显示该模式需要的设置组，其余设为 `hidden`，不再用「置灰禁用」。字母/字符模式无设置组时隐藏 `settingsCard`，只显示开始按钮。修改某个模式需要的设置时，编辑 `MODE_SETTINGS`（`script.js:25`）即可。

