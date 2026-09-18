// 游戏状态
let gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    correct: 0,
    wrong: 0,
    combo: 0,
    maxCombo: 0,
    timeLeft: 60,
    mode: 'letter',
    difficulty: 'easy',
    currentTarget: '',
    currentTargetZh: '', // 单词模式的中文释义
    currentIndex: 0,
    timerInterval: null,
    challengeTimer: null, // 挑战模式的字符超时计时器
    challengeTimeout: 3000, // 挑战模式的超时时间（毫秒）
    challengeTimeRemaining: null, // 暂停时保存的剩余时间（毫秒）
    soundEnabled: true
};

// ===== 首页分步向导 =====
// 每个模式需要显示的设置组与是否展示排行榜
const MODE_SETTINGS = {
    letter:   { groups: [],                                       hasLeaderboard: true },
    character:{ groups: [],                                       hasLeaderboard: true },
    word:     { groups: ['difficulty', 'library'],                hasLeaderboard: true },
    learn:    { groups: ['library', 'batch', 'progress'],         hasLeaderboard: false },
    challenge:{ groups: ['difficulty'],                           hasLeaderboard: true },
    beginner: { groups: ['lesson'],                               hasLeaderboard: false }
};
// 设置组 key -> DOM 元素 id
const MODE_SETTING_GROUPS = {
    difficulty: 'difficultyGroup',
    library: 'libraryGroup',
    batch: 'batchGroup',
    progress: 'learnProgressGroup',
    lesson: 'lessonGroup'
};
// 模式显示名
const MODE_NAMES = {
    letter: '字母模式',
    character: '字符模式',
    word: '单词模式',
    learn: '学单词模式',
    challenge: '限时速打',
    beginner: '指法起步'
};

// ===== 指法起步（初学者）模式 =====
// 标准 QWERTY 指法映射：目标字符 / 键 → 应使用的指头
const FINGER_MAP = {
    q: 'lp', a: 'lp', z: 'lp',
    w: 'lr', s: 'lr', x: 'lr',
    e: 'lm', d: 'lm', c: 'lm',
    r: 'li', t: 'li', g: 'li', b: 'li', f: 'li', v: 'li',
    y: 'ri', u: 'ri', h: 'ri', j: 'ri', n: 'ri', m: 'ri',
    i: 'rm', k: 'rm', ',': 'rm',
    o: 'rr', l: 'rr', '.': 'rr',
    p: 'rp', '/': 'rp'
};
const FINGER_LABEL = {
    lp: '左小指', lr: '左无名指', lm: '左中指', li: '左食指',
    ri: '右食指', rm: '右中指', rr: '右无名指', rp: '右小指'
};
// 基本手位：ASDF-JKL; 双手 8 指常驻
const HOME_ROW_FINGERS = ['li', 'lm', 'lr', 'lp', 'rp', 'rr', 'rm', 'ri'];

// 闯关课表：① 单指（8 课，中排食指起）→ ② 逐行（中排→上排→下排）→ ③ 字母
const BEGINNER_PLAN = (() => [
    { type: 'finger', name: '左食指',  stage: '①单指', keys: 'rtfgvb'.split('') },
    { type: 'finger', name: '左中指',  stage: '①单指', keys: 'edc'.split('') },
    { type: 'finger', name: '左无名指', stage: '①单指', keys: 'wsx'.split('') },
    { type: 'finger', name: '左小指',  stage: '①单指', keys: 'qaz'.split('') },
    { type: 'finger', name: '右小指',  stage: '①单指', keys: 'p/'.split('') },
    { type: 'finger', name: '右无名指', stage: '①单指', keys: 'ol.'.split('') },
    { type: 'finger', name: '右中指',  stage: '①单指', keys: 'ik,'.split('') },
    { type: 'finger', name: '右食指',  stage: '①单指', keys: 'yuhjnm'.split('') },
    { type: 'row',   name: '中排',     stage: '②逐行', keys: 'asdfghjkl'.split('') },
    { type: 'row',   name: '上排',     stage: '②逐行', keys: 'qwertyuiop'.split('') },
    { type: 'row',   name: '下排',     stage: '②逐行', keys: 'zxcvbnm'.split('') },
    { type: 'alpha', name: 'A–Z 全键盘', stage: '③字母', keys: 'abcdefghijklmnopqrstuvwxyz'.split('') }
])();

const BEGINNER_PROGRESS_KEY = 'keyboardMaster_beginnerProgress';
// 进度 = 已完成课数（0..12）
function loadBeginnerProgress() {
    const v = parseInt(localStorage.getItem(BEGINNER_PROGRESS_KEY) || '0', 10);
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), BEGINNER_PLAN.length) : 0;
}
function saveBeginnerProgress(n) {
    localStorage.setItem(BEGINNER_PROGRESS_KEY, String(Math.min(Math.max(n, 0), BEGINNER_PLAN.length)));
}
// 当前闯关位置：selected=选中的课索引，lessonIndex=进行中的课，charIndex=课内字符进度
let beginnerState = { selected: 0, lessonIndex: 0, charIndex: 0 };

// 在开始界面渲染关卡选择器（按阶段分组，显示闯关状态，点击选择关卡）
function renderBeginnerPicker() {
    const wrap = document.getElementById('beginnerPick');
    if (!wrap) return;
    const done = loadBeginnerProgress(); // 已通关课数（0..12），关卡 0..done-1 已完成

    // 各课状态：done 已完成 / current 当前建议 / locked 未解锁
    const status = i => (i < done ? 'done' : (i === done ? 'current' : 'locked'));

    // 选中默认取当前建议课（可跨起始），若已通关则默认第 0 课便于重玩
    let sel = beginnerState.selected;
    if (!Number.isFinite(sel) || sel < 0 || sel >= BEGINNER_PLAN.length) sel = 0;
    if (status(sel) === 'locked') sel = Math.min(sel, done);      // 选中未解锁时回落
    if (sel >= BEGINNER_PLAN.length) sel = 0;
    beginnerState.selected = sel;

    // 按阶段分组（保持课表顺序）
    const stages = [];
    BEGINNER_PLAN.forEach((lesson, i) => {
        const g = stages.find(s => s.stage === lesson.stage);
        if (g) g.items.push({ lesson, i, st: status(i) });
        else stages.push({ stage: lesson.stage, items: [{ lesson, i, st: status(i) }] });
    });

    const selName = BEGINNER_PLAN[beginnerState.selected] ? BEGINNER_PLAN[beginnerState.selected].name : '—';
    let html = `<div class="bl-head">指法闯关 · 已完成 <b>${done}</b>/${BEGINNER_PLAN.length} 关 · 已选：<b class="bl-picked">${selName}</b></div>`;
    stages.forEach(group => {
        html += `<div class="bl-stage"><div class="bl-stage-title">${group.stage}</div><div class="bl-grid">`;
        group.items.forEach(({ lesson, i, st }) => {
            const selCls = (i === beginnerState.selected) ? ' sel' : '';
            const dis = st === 'locked' ? ' disabled' : '';
            const keyLabel = lesson.type === 'alpha' ? 'A–Z' : lesson.keys.join('').toUpperCase();
            html += `<button class="bl-item ${st}${selCls}${dis}" data-index="${i}">`
                + `<span class="bl-mark">${st === 'done' ? '✓' : (st === 'current' ? '●' : '🔒')}</span>`
                + `<span class="bl-name">${lesson.name}</span>`
                + `<span class="bl-keys">${keyLabel}</span>`
                + `</button>`;
        });
        html += `</div></div>`;
    });
    wrap.innerHTML = html;

    // 绑定点击选择（锁定的课不可选）
    wrap.querySelectorAll('.bl-item:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            beginnerState.selected = parseInt(btn.dataset.index, 10);
            renderBeginnerPicker();
        });
    });
}

// 切换开始界面的步骤（1=选模式，2=设置）
// 标题只在首页（步骤1 选模式）显示，其余页面隐藏，把垂直空间让给内容
function setHeaderVisible(visible) {
    document.body.classList.toggle('playing', !visible);
}

function showStartStep(step) {
    const stepMode = document.getElementById('stepMode');
    const stepSettings = document.getElementById('stepSettings');
    if (stepMode) stepMode.classList.toggle('hidden', step !== 1);
    if (stepSettings) stepSettings.classList.toggle('hidden', step !== 2);
    // 标题仅在步骤1（首页选模式）显示
    setHeaderVisible(step === 1);
}

// 根据模式渲染设置区：只显示该模式需要的设置组
function renderSettingsForMode(mode) {
    const setting = MODE_SETTINGS[mode] || MODE_SETTINGS.letter;

    // 显示/隐藏各设置组
    Object.keys(MODE_SETTING_GROUPS).forEach(key => {
        const el = document.getElementById(MODE_SETTING_GROUPS[key]);
        if (el) el.classList.toggle('hidden', !setting.groups.includes(key));
    });

    // 无设置项的模式（字母/字符）不显示设置卡片，只看开始按钮
    const card = document.getElementById('settingsCard');
    if (card) card.classList.toggle('hidden', setting.groups.length === 0);

    // 标题
    const title = document.getElementById('stepSettingsModeName');
    if (title) title.textContent = MODE_NAMES[mode] || mode;

    // 难度提示文案
    const diffHint = document.getElementById('difficultyHint');
    if (diffHint) {
        if (mode === 'word') {
            diffHint.textContent = '简单=短词(2-3字母) / 中等=中词(4-5字母) / 困难=长词(6+字母)';
            diffHint.classList.remove('hidden');
        } else if (mode === 'challenge') {
            diffHint.textContent = '简单=3秒超时 / 中等=2秒超时 / 困难=1秒超时';
            diffHint.classList.remove('hidden');
        } else {
            diffHint.classList.add('hidden');
        }
    }

    // 词库提示文案
    const libHint = document.getElementById('libraryHint');
    if (libHint) {
        if (mode === 'learn') {
            libHint.textContent = '词库=选择年级，学单词模式会复习该年级全部单词';
            libHint.classList.remove('hidden');
        } else if (mode === 'word') {
            libHint.textContent = '词库仅对单词模式生效';
            libHint.classList.remove('hidden');
        } else {
            libHint.classList.add('hidden');
        }
    }

    // 排行榜：学单词/指法起步模式不参与
    const lbSection = document.getElementById('leaderboardSection');
    if (lbSection) lbSection.classList.toggle('hidden', !setting.hasLeaderboard);

    // 指法起步：渲染关卡选择器
    if (mode === 'beginner') renderBeginnerPicker();

    // 刷新排行榜与学单词进度
    updateLeaderboardDisplay();
    updateLearnProgress();
}

// 在步骤1选中某个模式：进入步骤2
function goModeStep(mode) {
    gameState.mode = mode;
    showStartStep(2);
    renderSettingsForMode(mode);
}

// 从步骤2返回步骤1
function goBackToModeSelect() {
    showStartStep(1);
}

// 音量控制
let masterVolume = 1.0;

// 词库列表
const wordLibraries = [
    { id: 'grade3', name: '三年级词库' },
    { id: 'grade4', name: '四年级词库' },
    { id: 'grade5', name: '五年级词库' },
    { id: 'grade6', name: '六年级词库' }
];

// 当前词库数据（加载后填充）
let wordList = null;
let wordListLoaded = false;
let currentLibraryId = 'grade3';

// 加载词库
async function loadWordList(libraryId) {
    const logPrefix = '词库加载';
    console.log(`${logPrefix}开始加载: ${libraryId}`);

    // 显示加载中消息
    showMessage('正在加载词库，请稍候...⏳', '');

    try {
        const response = await fetch(`words/${libraryId}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // 验证数据格式
        if (!data.easy || !data.medium || !data.hard) {
            throw new Error('词库数据格式不正确');
        }

        wordList = data;
        wordListLoaded = true;
        currentLibraryId = libraryId;

        console.log(`${logPrefix}成功:`, libraryId, Object.keys(wordList));
        showMessage(`词库加载成功！📚 (${libraryId})`, 'success');
    } catch (error) {
        console.error(`${logPrefix}失败:`, error.message);
        showMessage(`词库加载失败: ${error.message}，使用内置词库`, 'error');

        // 回退到内置词库
        wordList = null;
        wordListLoaded = true;
    }
}

// 检查单词库是否加载完成
function isWordListLoaded() {
    return wordListLoaded;
}

// ============ 学单词模式 ============
// 学单词模式状态（独立于 gameState，避免被 startGame 重置覆盖）
let learnState = {
    batch: [],               // 当前批次的词条 [{en, zh, status}]
    batchIndex: 0,           // 主批次索引
    current: null,           // 当前练习的词条
    phase: 'learn',          // 'learn' 看词 | 'recite' 默写 | 'review' 复习
    revealed: false,         // 当前词是否已揭示拼写（点「看答案」或超配额自动揭示），续打当前词
    mistakeLimit: 3,         // 错键配额：默写/复习阶段允许打错的键数上限
    mistakeCount: 0,         // 当前词已打错的键数
    transitioning: false,    // 词完成反馈过渡中（屏蔽输入，展示完成状态）
    reviewQueue: [],         // 复习队列
    preMastered: new Set(),  // 本局开始前已掌握的词en（用于「新掌握」只统计新词）
    masteredThisSession: 0,  // 本局新掌握数
    needReview: 0,           // 本局结束时仍未掌握、需再复习的词数
    batchSize: 10            // 每批词数（默认10）
};

// 词完成后的反馈时长（ms）：展示整词完成动画，再进入下一步
const LEARN_DONE_DELAY = 500;

// 学单词进度持久化 key（结构: { [libraryId]: { [wordEn]: 'new'|'learning'|'mastered' } }）
const LEARN_PROGRESS_KEY = 'keyboardMaster_learnProgress';
// 重点词持久化 key（结构: { [libraryId]: [wordEn, ...] }，独立存储避免迁移已有进度）
const LEARN_IMPORTANT_KEY = 'keyboardMaster_importantWords';
// 重点词抽词权重倍数
const IMPORTANT_WEIGHT = 3;

function loadLearnProgress() {
    try {
        const raw = localStorage.getItem(LEARN_PROGRESS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.log('读取学单词进度失败:', e);
        return {};
    }
}

function saveLearnProgress(progress) {
    try {
        localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {
        console.log('保存学单词进度失败:', e);
    }
}

function getWordStatus(libId, word) {
    const prog = loadLearnProgress();
    return (prog[libId] && prog[libId][word]) || 'new';
}

function setWordStatus(libId, word, status) {
    const prog = loadLearnProgress();
    if (!prog[libId]) prog[libId] = {};
    prog[libId][word] = status;
    saveLearnProgress(prog);
}

// 统计当前年级进度（去重后已掌握/总数）
function countGradeProgress(libId) {
    const prog = loadLearnProgress();
    const p = prog[libId] || {};
    const allTiers = wordList ? [...wordList.easy, ...wordList.medium, ...wordList.hard] : [];
    const seen = new Set();
    let mastered = 0;
    allTiers.forEach(w => {
        if (seen.has(w.en)) return;
        seen.add(w.en);
        if (p[w.en] === 'mastered') mastered++;
    });
    return { mastered, total: seen.size };
}

// ===== 重点词（词库管理）=====
function loadImportantWords() {
    try {
        const raw = localStorage.getItem(LEARN_IMPORTANT_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.log('读取重点词失败:', e);
        return {};
    }
}

function saveImportantWords(data) {
    try {
        localStorage.setItem(LEARN_IMPORTANT_KEY, JSON.stringify(data));
    } catch (e) {
        console.log('保存重点词失败:', e);
    }
}

// 当前词库的重点词集合（Set<en>）
function getImportantSet(libId) {
    return new Set(loadImportantWords()[libId] || []);
}

// 标记/取消某词为重点
function setWordImportant(libId, word, important) {
    const data = loadImportantWords();
    if (!data[libId]) data[libId] = [];
    let arr = data[libId];
    const has = arr.includes(word);
    if (important && !has) arr.push(word);
    if (!important && has) arr = arr.filter(w => w !== word);
    data[libId] = arr;
    saveImportantWords(data);
}

// 加权随机不重复抽样：从 pool 抽取并入 out，直到 out 达到 max 或 pool 用尽
function addWeighted(pool, out, max, weightFn) {
    const remaining = pool.slice();
    while (out.length < max && remaining.length) {
        const total = remaining.reduce((s, w) => s + weightFn(w), 0);
        let r = Math.random() * total;
        let idx = 0;
        for (let i = 0; i < remaining.length; i++) {
            r -= weightFn(remaining[i]);
            if (r <= 0) { idx = i; break; }
        }
        out.push(remaining.splice(idx, 1)[0]);
    }
}

// 构建本批次：未掌握优先 + 重点词加权随机
function buildLearnBatch(size) {
    const all = [...wordList.easy, ...wordList.medium, ...wordList.hard];
    const seen = new Set();
    const unique = all.filter(w => {
        if (seen.has(w.en)) return false;
        seen.add(w.en);
        return true;
    });
    const prog = loadLearnProgress();
    const p = prog[currentLibraryId] || {};
    const important = getImportantSet(currentLibraryId);

    const getStatus = w => (p[w.en] || 'new');
    const weight = w => {
        let wgt = getStatus(w) === 'new' ? 2 : 1; // 未学过略高
        if (important.has(w.en)) wgt *= IMPORTANT_WEIGHT; // 重点词加倍
        return wgt;
    };

    // 未掌握池（new + learning）优先，不足再从已掌握池补足复习
    const unlearned = unique.filter(w => getStatus(w) !== 'mastered');
    const mastered = unique.filter(w => getStatus(w) === 'mastered');

    const result = [];
    addWeighted(unlearned, result, size, weight);
    if (result.length < size) addWeighted(mastered, result, size, weight);
    return result;
}

// 字母表（包含常用字符）
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890,./';

// 音效播放函数
function playSound(id) {
    if (gameState.soundEnabled) {
        const sound = document.getElementById(id);
        if (sound) {
            try {
                // 使用主音量控制
                updateVolume();
                
                // 尝试播放音频
                sound.currentTime = 0;
                sound.play().catch(e => {
                    console.log('Audio play failed:', e);
                });
            } catch (error) {
                console.log('Error playing sound:', error);
            }
        }
    }
}

// 同步所有声音开关按钮（右上角悬浮 + 游戏内）的状态
function updateSoundButtons() {
    document.querySelectorAll('.sound-btn').forEach(button => {
        const text = button.querySelector('.btn-text');
        if (gameState.soundEnabled) {
            button.classList.remove('muted');
            if (text) text.textContent = '声音开';
        } else {
            button.classList.add('muted');
            if (text) text.textContent = '声音关';
        }
    });
}

// 音效控制
function toggleSound() {
    gameState.soundEnabled = !gameState.soundEnabled;
    updateSoundButtons();
    if (gameState.soundEnabled) {
        playSound('keySound'); // 测试按钮音效
        // 游戏中取消静音时，从暂停处恢复背景音乐（不重头）
        if (gameState.isPlaying && !gameState.isPaused) {
            const bgMusic = document.getElementById('bgMusic');
            if (bgMusic) bgMusic.play().catch(e => console.log('Background music resume failed:', e));
        }
    } else {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic) {
            bgMusic.pause();
        }
    }
}

// 增加音量
function increaseVolume() {
    masterVolume = Math.min(masterVolume + 0.1, 1.0);
    updateVolume();
    playSound('keySound'); // 测试音量
}

// 减少音量
function decreaseVolume() {
    masterVolume = Math.max(masterVolume - 0.1, 0);
    updateVolume();
    playSound('keySound'); // 测试音量
}

// 更新所有音频音量
function updateVolume() {
    const audioElements = ['bgMusic', 'keySound', 'correctSound', 'wrongSound', 'levelUpSound'];
    audioElements.forEach(id => {
        const sound = document.getElementById(id);
        if (sound) {
            if (id === 'bgMusic') {
                sound.volume = 0.3 * masterVolume;
            } else {
                sound.volume = 0.8 * masterVolume;
            }
        }
    });
}

// 排行榜显示逻辑：只显示当前游戏设置的模式和难度，并更新数据
function updateLeaderboardDisplay() {
    const mode = gameState.mode;
    const difficulty = gameState.difficulty;

    // 学单词/指法起步模式不参与排行榜，隐藏所有排行榜
    if (mode === 'learn' || mode === 'beginner') {
        document.querySelectorAll('.leaderboard').forEach(board => {
            board.classList.add('hidden');
        });
        document.getElementById('currentMode').textContent = MODE_NAMES[mode] || mode;
        const difficultyLabel = document.getElementById('difficultyLabel');
        if (difficultyLabel) difficultyLabel.classList.add('hidden');
        return;
    }

    // 隐藏所有排行榜
    document.querySelectorAll('.leaderboard').forEach(board => {
        board.classList.add('hidden');
    });

    // 显示当前模式和难度的排行榜
    document.getElementById(`leaderboard-${mode}-${difficulty}`).classList.remove('hidden');

    // 更新排行榜数据
    updateLeaderboardData(mode, difficulty);
    
    // 更新当前模式和难度的显示
    const modeMap = {
        'letter': '字母模式',
        'character': '字符模式',
        'word': '单词模式',
        'challenge': '限时速打'
    };
    
    const difficultyMap = {
        'easy': '简单',
        'medium': '中等',
        'hard': '困难'
    };
    
    // 设置难度对应的颜色
    const difficultyColorMap = {
        'easy': 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
        'medium': 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
        'hard': 'linear-gradient(135deg, #f44336 0%, #ff7043 100%)'
    };
    
    document.getElementById('currentMode').textContent = modeMap[mode] || mode;
    document.getElementById('currentDifficulty').textContent = difficultyMap[difficulty] || difficulty;

    // 字母/字符模式不显示难度
    const difficultyLabel = document.getElementById('difficultyLabel');
    if (difficultyLabel) {
        difficultyLabel.classList.toggle('hidden', mode === 'letter' || mode === 'character');
    }

    // 更新难度标签的颜色
    const difficultyElement = document.getElementById('currentDifficulty');
    if (difficultyElement) {
        difficultyElement.style.background = difficultyColorMap[difficulty] || difficultyColorMap.easy;
    }
}

// 更新排行榜数据
function updateLeaderboardData(mode, difficulty) {
    const leaderboard = getLeaderboard(mode, difficulty);
    const tbody = document.getElementById(`leaderboard-${mode}-${difficulty}-body`);
    
    if (!tbody) return;
    
    // 清空表格
    tbody.innerHTML = '';
    
    if (leaderboard.length === 0) {
        // 显示暂无记录
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.textContent = '暂无记录';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }
    
    // 填充排行榜数据
    leaderboard.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        // 排名
        const rankCell = document.createElement('td');
        rankCell.textContent = index + 1;
        rankCell.style.fontWeight = 'bold';
        row.appendChild(rankCell);
        
        // 得分
        const scoreCell = document.createElement('td');
        scoreCell.textContent = entry.score;
        scoreCell.style.color = '#667eea';
        scoreCell.style.fontWeight = 'bold';
        row.appendChild(scoreCell);
        
        // 正确率
        const accuracyCell = document.createElement('td');
        accuracyCell.textContent = entry.accuracy + '%';
        row.appendChild(accuracyCell);
        
        // 连击
        const comboCell = document.createElement('td');
        comboCell.textContent = entry.combo;
        row.appendChild(comboCell);
        
        // 时间
        const timeCell = document.createElement('td');
        timeCell.textContent = formatDate(entry.timestamp);
        timeCell.style.fontSize = '0.8em';
        timeCell.style.color = '#666';
        row.appendChild(timeCell);

        // 操作：删除按钮
        const actionCell = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerHTML = '<svg class="icon"><use href="#icon-x"/></svg>';
        deleteBtn.title = '删除此记录';
        deleteBtn.setAttribute('aria-label', '删除此记录');
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteLeaderboardEntry(mode, difficulty, index);
        });
        actionCell.appendChild(deleteBtn);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}

// 初始化
function setupEventListeners() {
    // 难度选择
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const difficulty = this.dataset.difficulty;
            gameState.difficulty = difficulty;
            
            // 更新排行榜显示
            updateLeaderboardDisplay();
        });
    });
    

    // 词库选择
    document.querySelectorAll('.library-btn[data-library]').forEach(btn => {
        btn.addEventListener('click', async function() {
            const libraryId = this.dataset.library;
            if (libraryId === currentLibraryId) return;

            document.querySelectorAll('.library-btn[data-library]').forEach(b => {
                b.classList.remove('active');
                b.disabled = true;
                const t = b.querySelector('.btn-text');
                if (t) t.textContent = t.textContent.replace('…', '');
            });
            this.classList.add('active');
            const t = this.querySelector('.btn-text');
            if (t) t.textContent = t.textContent + '…';

            await loadWordList(libraryId);

            document.querySelectorAll('.library-btn[data-library]').forEach(b => {
                b.disabled = false;
                const t = b.querySelector('.btn-text');
                if (t) t.textContent = t.textContent.replace('…', '');
            });

            // 切词库后刷新学单词进度
            updateLearnProgress();
        });
    });

    // 批次大小选择
    document.querySelectorAll('.batch-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.batch-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            learnState.batchSize = parseInt(this.dataset.batch, 10) || 10;
        });
    });

    // 步骤1：模式卡片选择 —— 进入步骤2
    document.querySelectorAll('.mode-card').forEach(btn => {
        btn.addEventListener('click', function() {
            goModeStep(this.dataset.mode);
        });
    });

    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // 虚拟键盘点击
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', function() {
            const keyValue = this.dataset.key;
            handleInput(keyValue);
        });
    });

    // 处理浏览器自动播放限制
    document.addEventListener('click', function enableAudio() {
        // 尝试播放一个静音的音频来获得音频上下文
        const testSound = document.getElementById('keySound');
        if (testSound) {
            testSound.volume = 0;
            testSound.play().catch(e => console.log('Audio context enabled:', e));
        }
        // 只执行一次
        document.removeEventListener('click', enableAudio);
    });

    // 初始化排行榜
    initLeaderboard();
    // 初始化排行榜显示
    updateLeaderboardDisplay();
}

// 开始游戏
// 隐藏学单词模式的专属界面元素（切换到其他模式时调用，避免残留）
function hideLearnUI() {
    ['learnPhase', 'learnHearts', 'learnAnswerBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

// 顶部统计栏：学单词模式隐藏整个统计框（得分/正确率/连击/时间对学习结果无意义）
function setStandardStatsVisible(visible) {
    const el = document.getElementById('statsBar');
    if (el) el.classList.toggle('hidden', !visible);
}

function startGame() {
    // 离开开始界面，隐藏顶部标题（只在首页显示）
    setHeaderVisible(false);

    // 学单词模式走独立流程
    if (gameState.mode === 'learn') {
        startLearnGame();
        return;
    }
    // 指法起步（初学者）模式走独立流程
    if (gameState.mode === 'beginner') {
        startBeginnerGame();
        return;
    }

    // 非学单词模式：隐藏学单词专属界面，避免上一局残留
    hideLearnUI();
    // 隐藏指法起步专属界面
    showBeginnerUI(false);

    // 检查单词库是否加载完成
    if (!isWordListLoaded()) {
        console.error('单词库未加载完成，无法开始游戏');

        showMessage('单词库未加载完成，请稍后再试！⏳', 'error');
        return;
    }
    
    console.log('开始游戏，单词库已加载:', wordList ? Object.keys(wordList) : null);

    // 重置暂停按钮状态
    const pauseBtn = document.getElementById('pauseButton');
    if (pauseBtn) {
        pauseBtn.classList.remove('paused');
        const pt = pauseBtn.querySelector('.btn-text');
        if (pt) pt.textContent = '暂停';
    }

    // 根据难度设置挑战模式的超时时间
    let challengeTimeout;
    if (gameState.mode === 'challenge') {
        challengeTimeout = gameState.difficulty === 'easy' ? 3000 : gameState.difficulty === 'medium' ? 2000 : 1000;
    } else {
        challengeTimeout = 3000;
    }
    
    // 重置游戏状态
    gameState = {
        isPlaying: true,
        isPaused: false,
        score: 0,
        correct: 0,
        wrong: 0,
        combo: 0,
        maxCombo: 0,
        timeLeft: (gameState.mode === 'letter' || gameState.mode === 'character' || gameState.mode === 'word')
            ? 60
            : gameState.difficulty === 'easy' ? 60 : gameState.difficulty === 'medium' ? 40 : 30,
        mode: gameState.mode,
        difficulty: gameState.difficulty,
        currentTarget: '',
        currentTargetZh: '',
        currentIndex: 0,
        timerInterval: null,
        challengeTimer: null,
        challengeTimeout: challengeTimeout,
        challengeTimeRemaining: null,
        challengeTimerStartAt: null,
        soundEnabled: gameState.soundEnabled
    };

    // 播放背景音乐（从开头重新开始）
    if (gameState.soundEnabled) {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.volume = 0.3 * masterVolume;
            bgMusic.play().catch(e => console.log('Background music play failed:', e));
        }
    }

    // 更新界面
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    // 常规模式显示顶部统计（得分/正确率/连击/时间）
    setStandardStatsVisible(true);

    // 清空上一局的提示语，避免残留（如词库已加载、再试一次、暂停等）
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.textContent = '';
        messageEl.className = 'message';
    }

    updateStats();
    nextTarget();
    startTimer();
}

// 开始计时
function startTimer() {
    gameState.timerInterval = setInterval(() => {
        if (!gameState.isPaused) {
            gameState.timeLeft--;
            updateStats();
            
            if (gameState.timeLeft <= 0) {
                endGame();
            }
        }
    }, 1000);
}

// 挑战模式超时处理
function handleChallengeTimeout() {
    // 检查是否正在处理正确输入（通过currentIndex判断）
    // 如果currentIndex >= currentTarget.length，说明用户已经完成了当前目标
    if (gameState.isPlaying && gameState.mode === 'challenge' && gameState.currentIndex < gameState.typeablePositions.length) {
        console.log('挑战模式超时，标记为错误');
        
        // 标记为错误
        gameState.wrong++;
        gameState.combo = 0; // 重置连击
        
        // 播放错误音效
        if (gameState.soundEnabled) {
            const wrongSound = document.getElementById('wrongSound');
            if (wrongSound) {
                wrongSound.currentTime = 0;
                wrongSound.volume = 0.6 * masterVolume;
                wrongSound.play().catch(e => console.log('Wrong sound play failed:', e));
            }
        }
        
        // 生成下一个目标
        nextTarget();
    } else {
        console.log('挑战模式超时处理被跳过，因为目标已经完成');
    }
}

// 生成下一个目标
function nextTarget() {
    gameState.currentIndex = 0;
    gameState.currentTargetZh = ''; // 非单词模式清空中文释义
    
    // 清除之前的挑战模式计时器
    if (gameState.challengeTimer) {
        clearTimeout(gameState.challengeTimer);
        gameState.challengeTimer = null;
    }
    
    if (gameState.mode === 'letter') {
        // 字母模式：随机一个字母
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let char = letters[Math.floor(Math.random() * letters.length)];
        // 随机大小写
        char = Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase();
        // 避免容易混淆的字符
        if (char === 'I') char = 'i';
        if (char === 'l') char = 'L';
        gameState.currentTarget = char;
    } else if (gameState.mode === 'character') {
        // 字符模式：包括字母、数字和标点
        let char = alphabet[Math.floor(Math.random() * alphabet.length)];
        if (/[a-zA-Z]/.test(char)) {
            char = Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase();
            if (char === 'I') char = 'i';
            if (char === 'l') char = 'L';
        }
        gameState.currentTarget = char;
    } else if (gameState.mode === 'word') {
        // 单词模式：从词库随机选择
        let words = wordList ? wordList[gameState.difficulty] : null;

        // 检查词库是否加载
        if (!words || words.length === 0) {
            console.log('词库未加载，使用默认单词');
            // 使用默认单词（含中文释义）
            const fallback = {
                easy: [
                    { en: 'cat', zh: '猫' }, { en: 'dog', zh: '狗' }, { en: 'sun', zh: '太阳' },
                    { en: 'fun', zh: '乐趣' }, { en: 'run', zh: '跑' }, { en: 'hat', zh: '帽子' },
                    { en: 'bat', zh: '蝙蝠' }, { en: 'mat', zh: '垫子' }, { en: 'sit', zh: '坐' },
                    { en: 'big', zh: '大的' }
                ],
                medium: [
                    { en: 'apple', zh: '苹果' }, { en: 'happy', zh: '快乐的' }, { en: 'water', zh: '水' },
                    { en: 'school', zh: '学校' }, { en: 'friend', zh: '朋友' }, { en: 'mouse', zh: '老鼠' },
                    { en: 'house', zh: '房子' }, { en: 'plant', zh: '植物' }, { en: 'dance', zh: '跳舞' },
                    { en: 'smile', zh: '微笑' }
                ],
                hard: [
                    { en: 'computer', zh: '计算机' }, { en: 'keyboard', zh: '键盘' },
                    { en: 'student', zh: '学生' }, { en: 'teacher', zh: '老师' },
                    { en: 'picture', zh: '图画' }, { en: 'morning', zh: '早上' },
                    { en: 'evening', zh: '晚上' }, { en: 'family', zh: '家庭' },
                    { en: 'animal', zh: '动物' }, { en: 'science', zh: '科学' }
                ]
            };
            words = fallback[gameState.difficulty] || fallback.easy;
        }

        console.log('使用的单词列表:', words);
        const wordObj = words[Math.floor(Math.random() * words.length)];
        gameState.currentTarget = wordObj.en || wordObj;
        gameState.currentTargetZh = wordObj.zh || '';
        console.log('选择的单词:', gameState.currentTarget, '中文:', gameState.currentTargetZh);
    } else if (gameState.mode === 'challenge') {
        // 挑战模式：随机字母，限时输入
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let char = letters[Math.floor(Math.random() * letters.length)];
        char = Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase();
        if (char === 'I') char = 'i';
        if (char === 'l') char = 'L';
        gameState.currentTarget = char;
        
        // 添加挑战模式超时计时器
        gameState.challengeTimer = setTimeout(handleChallengeTimeout, gameState.challengeTimeout);
        gameState.challengeTimerStartAt = Date.now();
        gameState.challengeTimeRemaining = null;
        console.log('挑战模式计时器已启动，超时时间:', gameState.challengeTimeout, 'ms');
    }
    
    // 计算可输入字符位置：单词模式仅字母可输入，空格/标点作为字面显示跳过；
    // 其他模式（单字符）目标本身即可输入。
    gameState.typeablePositions = [];
    for (let i = 0; i < gameState.currentTarget.length; i++) {
        if (gameState.mode === 'word') {
            if (/^[a-zA-Z]$/.test(gameState.currentTarget[i])) {
                gameState.typeablePositions.push(i);
            }
        } else {
            gameState.typeablePositions.push(i);
        }
    }

    displayTarget();
    highlightTargetKey();
}

// 显示目标
function displayTarget() {
    const display = document.getElementById('targetDisplay');
    display.innerHTML = '';

    for (let i = 0; i < gameState.currentTarget.length; i++) {
        const char = document.createElement('span');
        char.textContent = gameState.currentTarget[i];
        const rank = gameState.typeablePositions.indexOf(i);

        if (rank === -1) {
            // 非可输入字符（空格/标点）：字面显示，无需输入
            char.className = 'target-literal';
        } else {
            char.className = 'target-char';
            if (rank < gameState.currentIndex) {
                char.classList.add('correct');
            } else if (rank === gameState.currentIndex) {
                char.classList.add('current');
            }
        }

        display.appendChild(char);
    }

    // 单词模式显示中文释义
    const meaning = document.getElementById('wordMeaning');
    if (meaning) {
        if (gameState.mode === 'word' && gameState.currentTargetZh) {
            meaning.textContent = gameState.currentTargetZh;
            meaning.classList.remove('hidden');
        } else {
            meaning.classList.add('hidden');
        }
    }
}

// 高亮目标键
function highlightTargetKey() {
    // 清除之前的高亮
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove('target');
    });
    
    // 高亮当前目标键
    if (gameState.currentIndex < gameState.typeablePositions.length) {
        const pos = gameState.typeablePositions[gameState.currentIndex];
        let targetChar = gameState.currentTarget[pos].toLowerCase();
        const keyElement = document.querySelector(`.key[data-key="${targetChar}"]`);
        if (keyElement) {
            keyElement.classList.add('target');
        }
    }
}

// 处理键盘按下
function handleKeyDown(e) {
    if (!gameState.isPlaying || gameState.isPaused) return;
    
    let key = e.key.toLowerCase();
    
    // 处理简单标点符号
    if (e.key === ',') key = ',';
    if (e.key === '.') key = '.';
    if (e.key === '/') key = '/';
    
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    
    if (keyElement) {
        keyElement.classList.add('active');
        playSound('keySound'); // 播放按键音效
    }
    
    handleInput(key);
}

// 处理键盘释放
function handleKeyUp(e) {
    let key = e.key.toLowerCase();
    
    // 处理简单标点符号
    if (e.key === ',') key = ',';
    if (e.key === '.') key = '.';
    if (e.key === '/') key = '/';
    
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    
    if (keyElement) {
        keyElement.classList.remove('active');
    }
}

// 处理输入
function handleInput(input) {
    if (!gameState.isPlaying || gameState.isPaused) return;

    // 学单词模式走独立输入逻辑
    if (gameState.mode === 'learn') {
        handleLearnInput(input);
        return;
    }
    // 指法起步模式走独立输入逻辑
    if (gameState.mode === 'beginner') {
        handleBeginnerInput(input);
        return;
    }

    const pos = gameState.typeablePositions[gameState.currentIndex];
    const expected = gameState.currentTarget[pos].toLowerCase();

    if (input === expected) {
        // 正确输入
        handleCorrect();
    } else {
        // 错误输入
        handleWrong();
    }
}

// ============ 指法起步（初学者）模式流程 ============

// 显示/隐藏指法起步专属界面（双手图解 + 阶段条），并复位指头高亮
function showBeginnerUI(show) {
    ['beginnerBar', 'beginnerHands'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !show);
    });
    // 气泡始终隐藏：仅在本关通过后由 handleBeginnerInput 显示
    const bubble = document.getElementById('beginnerNextBubble');
    if (bubble) bubble.classList.add('hidden');
    if (!show) {
        const hands = document.getElementById('beginnerHands');
        if (hands) hands.querySelectorAll('.finger').forEach(f => f.classList.remove('lit', 'rest'));
    }
}

// 点亮某个字符应使用的指头（在键盘下方的双手图上），空格点亮拇指
function lightBeginnerFinger(ch) {
    const key = String(ch == null ? '' : ch).toLowerCase();
    const hands = document.getElementById('beginnerHands');
    if (!hands) return;
    hands.querySelectorAll('.finger').forEach(f => f.classList.remove('lit', 'rest'));
    HOME_ROW_FINGERS.forEach(id => {
        const f = hands.querySelector(`.finger[data-finger="${id}"]`);
        if (f) f.classList.add('rest');
    });
    const ids = FINGER_MAP[key] ? [FINGER_MAP[key]] : [];
    ids.forEach(id => {
        const f = hands.querySelector(`.finger[data-finger="${id}"]`);
        if (f) f.classList.add('lit');
    });
}

// 开始指法起步：未计时，只练选中关卡（关卡在开始界面选择）
function startBeginnerGame() {
    hideLearnUI();
    beginnerState.lessonIndex = beginnerState.selected;
    beginnerState.charIndex = 0;

    gameState = {
        isPlaying: true, isPaused: false, score: 0, correct: 0, wrong: 0,
        combo: 0, maxCombo: 0, timeLeft: 0, mode: 'beginner', difficulty: gameState.difficulty,
        currentTarget: '', currentTargetZh: '', currentIndex: 0,
        timerInterval: null, challengeTimer: null, challengeTimeout: 3000,
        challengeTimeRemaining: null, challengeTimerStartAt: null,
        soundEnabled: gameState.soundEnabled
    };

    // 界面切换
    setHeaderVisible(false);
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    // 隐藏标准计时统计（得分/连击/时间对教学无意义），显示阶段条
    setStandardStatsVisible(false);
    document.getElementById('standardResult').classList.add('hidden');
    document.getElementById('learnResult').classList.add('hidden');
    document.getElementById('beginnerResult').classList.add('hidden');

    // 背景音乐（从头播放）
    if (gameState.soundEnabled) {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.volume = 0.3 * masterVolume;
            bgMusic.play().catch(e => console.log('Background music play failed:', e));
        }
    }

    showBeginnerUI(true);
    alignBeginnerHands();
    renderBeginnerTarget();
    // 确保侧边栏切换窗口后仍对齐
    attachBeginnerResizeHandler();
}

// 出当前关卡的目标字母（按课表顺序，单关内不连续到下一关）
function renderBeginnerTarget() {
    const lesson = BEGINNER_PLAN[beginnerState.lessonIndex];
    if (!lesson || beginnerState.charIndex >= lesson.keys.length) {
        // 理论不会走到：进入本关卡时 charIndex=0，完成时走 handleBeginnerInput→endBeginnerGame
        endBeginnerGame(false);
        return;
    }
    const ch = lesson.keys[beginnerState.charIndex];
    gameState.currentTarget = ch;
    gameState.currentIndex = 0;
    gameState.typeablePositions = [0];

    // 常驻提示：这个键该用哪个指头（始终显示，打错也不消失）
    const finger = FINGER_LABEL[FINGER_MAP[ch]];
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.innerHTML = finger ? `这个键用 <b>${finger}</b> 来按` : '';
        messageEl.className = 'message';
    }

    displayTarget();
    highlightTargetKey();
    lightBeginnerFinger(ch);
    updateBeginnerBar();
    updateBeginnerProgressBar();
}

// 更新阶段条文案（单关内进度）
function updateBeginnerBar() {
    const el = document.getElementById('beginnerBar');
    if (!el) return;
    const lesson = BEGINNER_PLAN[beginnerState.lessonIndex];
    el.textContent = `${lesson.stage} · ${lesson.name} · ${beginnerState.charIndex + 1}/${lesson.keys.length}：${lesson.keys[beginnerState.charIndex].toUpperCase()}`;
}

// 更新本关进度条
function updateBeginnerProgressBar() {
    const lesson = BEGINNER_PLAN[beginnerState.lessonIndex];
    const pct = lesson ? Math.round((beginnerState.charIndex / lesson.keys.length) * 100) : 0;
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
}

// 处理指法起步模式的输入
function handleBeginnerInput(input) {
    if (!gameState.isPlaying || gameState.isPaused) return;
    const expected = String(gameState.currentTarget || '').toLowerCase();
    if (input === expected) {
        // 正确：声音 + 推进本关下一字母
        gameState.correct++;
        playSound('correctSound');
        const lesson = BEGINNER_PLAN[beginnerState.lessonIndex];
        beginnerState.charIndex++;
        if (beginnerState.charIndex >= lesson.keys.length) {
            // 本关完整过一遍即算通过（存档），但不结束：无限循环练习，弹出「去下一关」气泡
            saveBeginnerProgress(Math.max(loadBeginnerProgress(), beginnerState.lessonIndex + 1));
            const bubble = document.getElementById('beginnerNextBubble');
            if (bubble) {
                bubble.classList.remove('hidden');
                positionBeginnerBubble();
            }
            beginnerState.charIndex = 0;
            renderBeginnerTarget();
        } else {
            renderBeginnerTarget();
        }
    } else {
        // 错键：无惩罚、不推进，只发出音效（常驻提示已指出正确指头）
        gameState.wrong++;
        playSound('wrongSound');
    }
}

// 让「去下一关」气泡与当前目标字母同行（垂直居中对齐目标区）
function positionBeginnerBubble() {
    const area = document.getElementById('gameArea');
    const target = document.getElementById('targetDisplay');
    const bubble = document.getElementById('beginnerNextBubble');
    if (!area || !target || !bubble) return;
    if (bubble.classList.contains('hidden')) return;
    const ar = area.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    bubble.style.top = (tr.top - ar.top + tr.height / 2 - bubble.offsetHeight / 2) + 'px';
}

// 点击「去下一关」气泡：本关已通过，结束本局回到选关/结果页
function nextBeginnerForced() {
    if (!gameState.isPlaying) return;
    endBeginnerGame(true);
}

// 让两只手的最小指距与键盘第二行（ASDF-JKL）键距一致，并逐指对齐到对应列
function alignBeginnerHands() {
    const block = document.getElementById('beginnerHands');
    const left = document.getElementById('beginnerHands') ? document.querySelector('#beginnerHands .hand-left') : null;
    const right = document.getElementById('beginnerHands') ? document.querySelector('#beginnerHands .hand-right') : null;
    const fig = document.getElementById('beginnerFingers');
    const a = document.querySelector('.key[data-key="a"]');
    const f = document.querySelector('.key[data-key="f"]');
    const j = document.querySelector('.key[data-key="j"]');
    if (!block || !left || !right || !fig || !a || !f || !j) return;
    if (block.classList.contains('hidden')) return;
    if (!gameState || gameState.mode !== 'beginner' || !gameState.isPlaying) return;

    const VSN = 92;       // 手视框宽（viewBox width）
    const PITCH = 22;     // 视框内相邻手指间距
    const RATIO = 48 / VSN; // 视框高/宽（宽扁比例，控制手高度）
    const RIGHT_SHIFT = -8; // 右手整体向左微调（px），让食指更稳落在 J 上

    const cx = el => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 + window.scrollX;
    const fa = cx(f) - cx(a);   // F-A 距离 = 3 个键距
    const pitch = Math.max(fa / 3, 24);         // 单个键距（像素）
    const handW = pitch * VSN / PITCH;          // 使视框内 1 指距 ↔ 1 键距的手宽

    left.style.width = handW + 'px';
    right.style.width = handW + 'px';
    fig.style.height = Math.ceil(handW * RATIO) + 'px';

    // 左手：左手食指（视框中心 78）对齐到 F 列
    left.style.transform = 'none';
    const lWant = cx(f) - (78 / VSN) * handW;
    left.style.transform = `translateX(${lWant - (left.getBoundingClientRect().left + window.scrollX)}px)`;

    // 右手：右手食指（视框中心 12）对齐到 J 列（则中/无名/小指依次对 J/K/L/;），并整体向左微调
    right.style.transform = 'none';
    const rWant = cx(j) - (12 / VSN) * handW + RIGHT_SHIFT;
    right.style.transform = `translateX(${rWant - (right.getBoundingClientRect().left + window.scrollX)}px)`;
}

// 窗口尺寸变化时重新对齐双手（仅 beginners 进行中）
let _beginnerResizeAttached = false;
function attachBeginnerResizeHandler() {
    if (_beginnerResizeAttached) return;
    _beginnerResizeAttached = true;
    window.addEventListener('resize', () => {
        if (gameState && gameState.mode === 'beginner' && gameState.isPlaying) {
            alignBeginnerHands();
            positionBeginnerBubble();
        }
    });
}

// 结束指法起步（finished=true 表示本关完成；false 为提前结束/结束游戏按钮）
function endBeginnerGame(finished) {
    gameState.isPlaying = false;
    clearInterval(gameState.timerInterval);
    // 停止背景音乐
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) bgMusic.pause();
    playSound('levelUpSound');

    const completed = loadBeginnerProgress();
    document.getElementById('beginnerCompleted').textContent = `${completed}/${BEGINNER_PLAN.length} 关`;
    const playedLesson = BEGINNER_PLAN[beginnerState.lessonIndex];
    document.getElementById('beginnerStageResult').textContent = playedLesson ? playedLesson.stage : '—';

    const rm = document.getElementById('resultMessage');
    if (finished && completed >= BEGINNER_PLAN.length) {
        rm.innerHTML = '🎉 全部 12 关已通过！你已经养成指法好习惯啦！';
    } else if (finished && playedLesson) {
        rm.innerHTML = `🎉 第 ${beginnerState.lessonIndex + 1} 关「${playedLesson.name}」已通过，下一关已解锁！`;
    } else if (finished) {
        rm.innerHTML = '🎉 本关已通过！';
    } else {
        rm.innerHTML = `练习结束，已完成 ${completed}/${BEGINNER_PLAN.length} 关，随时回来继续 💪`;
    }

    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    document.getElementById('standardResult').classList.add('hidden');
    document.getElementById('learnResult').classList.add('hidden');
    document.getElementById('beginnerResult').classList.remove('hidden');
    showBeginnerUI(false);
}

// 处理正确输入
function handleCorrect() {
    gameState.correct++;
    gameState.combo++;
    
    if (gameState.combo > gameState.maxCombo) {
        gameState.maxCombo = gameState.combo;
    }
    
    // 计算得分
    let points = 10;
    if (gameState.combo > 5) points += 5;
    if (gameState.combo > 10) points += 10;
    if (gameState.mode === 'word') points *= 2;

    gameState.score += points;

    // 显示浮动分数
    showFloatingScore(points);

    gameState.currentIndex++;

    const completed = gameState.currentIndex >= gameState.typeablePositions.length;

    // 正确音效：单词模式仅在整词完整输入正确时播放，单字符模式逐字符播放
    if (completed || gameState.mode !== 'word') {
        playSound('correctSound');
    }

    if (completed) {
        // 完成当前目标：先刷新显示，让最后一个字母显示为绿色
        displayTarget();
        highlightTargetKey();
        showMessage('太棒了！🎉', 'success');
        
        // 清除挑战模式计时器，防止超时触发
        if (gameState.challengeTimer) {
            clearTimeout(gameState.challengeTimer);
            gameState.challengeTimer = null;
        }
        
        setTimeout(() => {
            nextTarget();
            showMessage('准备好了吗？按键盘上对应的键！', '');
        }, 500);
    } else {
        displayTarget();
        highlightTargetKey();
    }
    
    updateStats();
}

// 处理错误输入
function handleWrong() {
    gameState.wrong++;
    gameState.combo = 0;
    
    // 播放错误音效
    playSound('wrongSound');
    
    // 显示错误动画
    const currentChar = document.querySelector('.target-char.current');
    if (currentChar) {
        currentChar.classList.add('wrong');
        setTimeout(() => {
            currentChar.classList.remove('wrong');
        }, 500);
    }
    
    showMessage('再试一次！💪', 'error');
    updateStats();
}

// 显示浮动分数
function showFloatingScore(points) {
    const gameArea = document.getElementById('gameArea');
    const floating = document.createElement('div');
    floating.className = 'floating-score';
    floating.textContent = '+' + points;
    floating.style.left = Math.random() * 60 + 20 + '%';
    floating.style.top = '50%';
    gameArea.appendChild(floating);
    
    setTimeout(() => {
        floating.remove();
    }, 1000);
}

// 显示消息
function showMessage(text, type) {
    const message = document.getElementById('message');
    message.textContent = text;
    message.className = 'message ' + type;
}

// 更新统计
function updateStats() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('combo').textContent = gameState.combo;
    document.getElementById('timer').textContent = gameState.timeLeft;
    
    const total = gameState.correct + gameState.wrong;
    const accuracy = total > 0 ? Math.round((gameState.correct / total) * 100) : 100;
    document.getElementById('accuracy').textContent = accuracy + '%';
    
    // 更新进度条
    if (gameState.mode === 'learn') {
        // 学单词模式：进度 = 已练词数 / 本批词数
        const pct = learnState.batch.length > 0 ? (learnState.batchIndex / learnState.batch.length) * 100 : 0;
        document.getElementById('progressFill').style.width = pct + '%';
    } else {
        const maxTime = (gameState.mode === 'letter' || gameState.mode === 'character' || gameState.mode === 'word')
            ? 60
            : gameState.difficulty === 'easy' ? 60 : gameState.difficulty === 'medium' ? 40 : 30;
        const progress = ((maxTime - gameState.timeLeft) / maxTime) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
    }
}

// ============ 学单词模式流程 ============

// 开始学单词游戏
function startLearnGame() {
    if (!isWordListLoaded() || !wordList) {
        showMessage('词库未加载完成，请稍后再试！⏳', 'error');
        return;
    }

    const batch = buildLearnBatch(learnState.batchSize);
    if (batch.length === 0) {
        showMessage('本年级暂无单词可练习！', 'error');
        return;
    }

    learnState.batch = batch;
    learnState.batchIndex = 0;
    learnState.reviewQueue = [];
    learnState.transitioning = false;
    learnState.masteredThisSession = 0;
    learnState.needReview = 0;
    // 记录本局开始前已掌握的词，使「新掌握」只统计本局新达到掌握的词
    const prog = loadLearnProgress();
    const libProg = prog[currentLibraryId] || {};
    learnState.preMastered = new Set(Object.keys(libProg).filter(en => libProg[en] === 'mastered'));
    learnState.current = batch[0];
    learnState.phase = 'learn';

    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.score = 0;
    gameState.correct = 0;
    gameState.wrong = 0;
    gameState.combo = 0;
    gameState.maxCombo = 0;

    // 播放背景音乐（学单词模式同样播放，从开头重新开始）
    if (gameState.soundEnabled) {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.volume = 0.3 * masterVolume;
            bgMusic.play().catch(e => console.log('Background music play failed:', e));
        }
    }

    // 界面切换
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    // 学单词模式隐藏顶部统计（得分/正确率/连击/时间，对学习结果无意义）
    setStandardStatsVisible(false);
    // 清空提示语
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.textContent = '';
        messageEl.className = 'message';
    }

    setupLearnWord();
    renderLearnWord();
    updateStats();
}

// 加载当前练习词到打字状态
function setupLearnWord() {
    const word = learnState.current;
    learnState.revealed = false; // 进入新词时清除「已看答案」状态
    learnState.mistakeCount = 0; // 进入新词时重置错键配额
    gameState.currentTarget = word.en;
    gameState.currentTargetZh = word.zh || '';
    gameState.currentIndex = 0;
    // 计算可输入字母位置（仅字母可输入，空格/标点跳过）
    gameState.typeablePositions = [];
    for (let i = 0; i < gameState.currentTarget.length; i++) {
        if (/^[a-zA-Z]$/.test(gameState.currentTarget[i])) {
            gameState.typeablePositions.push(i);
        }
    }
}

// 渲染当前学习词
function renderLearnWord() {
    const word = learnState.current;
    const showLetters = learnState.phase === 'learn' || learnState.revealed; // 看词或已看答案时显示字母
    const display = document.getElementById('targetDisplay');
    display.innerHTML = '';
    display.classList.remove('complete'); // 清除上一词的完成动画

    for (let i = 0; i < gameState.currentTarget.length; i++) {
        const char = document.createElement('span');
        const rank = gameState.typeablePositions.indexOf(i);
        if (rank === -1) {
            // 空格/标点：原样显示（作为提示）
            char.className = 'target-literal';
            char.textContent = gameState.currentTarget[i];
        } else {
            char.className = 'target-char';
            if (rank < gameState.currentIndex) {
                char.classList.add('correct');
                char.textContent = gameState.currentTarget[i];
            } else if (rank === gameState.currentIndex) {
                char.classList.add('current');
                char.textContent = showLetters ? gameState.currentTarget[i] : '';
            } else {
                // 看词阶段：整词展示（同单词模式，不隐藏未达字母）；
                // 默写/复习阶段：未达字母用空盒子隐藏
                if (showLetters) {
                    char.textContent = gameState.currentTarget[i];
                } else {
                    char.classList.add('blank');
                    char.textContent = '';
                }
            }
        }
        display.appendChild(char);
    }

    // 中文释义（看词/默写/复习都显示中文作为提示）
    const meaning = document.getElementById('wordMeaning');
    if (meaning) {
        meaning.textContent = word.zh || '';
        meaning.classList.remove('hidden');
    }

    // 阶段标签 + 进度
    const phaseEl = document.getElementById('learnPhase');
    if (phaseEl) {
        let content;
        if (learnState.phase === 'review') {
            content = `🔁 复习 · 剩余 ${learnState.reviewQueue.length} 词`;
        } else {
            const phaseText = learnState.phase === 'learn' ? '👀 看词' : '✍️ 默写';
            content = `${phaseText} · 第 ${learnState.batchIndex + 1}/${learnState.batch.length} 词`;
        }
        if (learnState.revealed) content += ' · 已看答案';
        phaseEl.textContent = content;
        phaseEl.classList.remove('hidden');
    }

    // 看答案按钮：默写/复习阶段可用，已揭示后隐藏
    const answerBtn = document.getElementById('learnAnswerBtn');
    if (answerBtn) {
        answerBtn.classList.toggle('hidden', learnState.phase === 'learn' || learnState.revealed);
    }

    // 看词阶段或已看答案：高亮下一个目标键；否则不提示，需凭记忆输入
    if (learnState.phase === 'learn' || learnState.revealed) {
        highlightTargetKey();
    } else {
        document.querySelectorAll('.key').forEach(key => key.classList.remove('target'));
    }

    renderLearnHearts();
}

// 渲染错误配额爱心（默写/复习阶段显示，每打错一键少一颗，看答案/超配额后归零）
function renderLearnHearts() {
    const el = document.getElementById('learnHearts');
    if (!el) return;
    const show = learnState.phase === 'recite' || learnState.phase === 'review';
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const remaining = learnState.revealed ? 0 : Math.max(0, learnState.mistakeLimit - learnState.mistakeCount);
    let html = '';
    for (let i = 0; i < learnState.mistakeLimit; i++) {
        html += `<span class="heart${i < remaining ? '' : ' lost'}">♥</span>`;
    }
    el.innerHTML = html;
}

// 处理学单词模式的输入
function handleLearnInput(input) {
    if (!gameState.isPlaying || gameState.isPaused || learnState.transitioning) return;
    const pos = gameState.typeablePositions[gameState.currentIndex];
    const expected = gameState.currentTarget[pos].toLowerCase();

    if (input === expected) {
        gameState.correct++;
        gameState.currentIndex++;
        renderLearnWord();
        if (gameState.currentIndex >= gameState.typeablePositions.length) {
            onLearnWordComplete();
        }
    } else {
        gameState.wrong++;
        gameState.combo = 0;
        playSound('wrongSound');
        const currentChar = document.querySelector('.target-char.current');
        if (currentChar) {
            currentChar.classList.add('wrong');
            setTimeout(() => currentChar.classList.remove('wrong'), 500);
        }
        // 错键配额：默写/复习阶段累计，3 颗爱心耗尽即判失败（揭示拼写照打一遍）
        if (!learnState.revealed && learnState.phase !== 'learn') {
            learnState.mistakeCount++;
            renderLearnHearts();
            if (learnState.mistakeCount >= learnState.mistakeLimit) {
                revealLearnAnswer(true); // 自动揭示，不重复播放错误音
            }
        }
    }
    updateStats();
}

// 整词输入完成后的阶段推进
function onLearnWordComplete() {
    const word = learnState.current;
    learnState.transitioning = true; // 反馈过渡期间屏蔽输入
    // 整词完成反馈：显示完成动画，让用户看到最后的字母变绿再进入下一步
    const display = document.getElementById('targetDisplay');
    if (display) {
        display.classList.add('complete');
        setTimeout(() => display.classList.remove('complete'), LEARN_DONE_DELAY);
    }

    if (learnState.phase === 'learn') {
        // 看词完成 → 进入默写
        playSound('correctSound');
        learnState.phase = 'recite';
        setTimeout(() => { learnState.transitioning = false; setupLearnWord(); renderLearnWord(); }, LEARN_DONE_DELAY);
    } else if (learnState.phase === 'recite') {
        // 默写完成：配额内完成（未揭示）→ 已掌握；看答案/超配额 → 进复习队列
        if (!learnState.revealed) {
            setWordStatus(currentLibraryId, word.en, 'mastered');
            if (!learnState.preMastered.has(word.en)) learnState.masteredThisSession++; // 只统计本局新掌握
            playSound('levelUpSound');
        } else {
            setWordStatus(currentLibraryId, word.en, 'learning');
            learnState.reviewQueue.push(word);
            playSound('correctSound');
        }
        advanceAfterDelay();
    } else if (learnState.phase === 'review') {
        // 复习判定：配额内答对 → 已掌握；看答案/超配额 → 未掌握（下次游戏重抽）
        if (!learnState.revealed) {
            setWordStatus(currentLibraryId, word.en, 'mastered');
            if (!learnState.preMastered.has(word.en)) learnState.masteredThisSession++; // 只统计本局新掌握
            playSound('levelUpSound');
        } else {
            setWordStatus(currentLibraryId, word.en, 'learning');
            learnState.needReview++; // 本局结束仍未掌握
            playSound('correctSound');
        }
        learnState.reviewQueue.shift();
        advanceAfterDelay();
    }
}

// 词完成反馈过渡结束后，解锁输入并推进到下一步
function advanceAfterDelay() {
    setTimeout(() => {
        learnState.transitioning = false;
        advanceLearnWord();
    }, LEARN_DONE_DELAY);
}

// 推进到下一个词
function advanceLearnWord() {
    if (learnState.phase === 'review') {
        if (learnState.reviewQueue.length > 0) {
            learnState.current = learnState.reviewQueue[0];
            setupLearnWord();
            renderLearnWord();
        } else {
            endLearnGame();
        }
    } else {
        learnState.batchIndex++;
        if (learnState.batchIndex < learnState.batch.length) {
            learnState.current = learnState.batch[learnState.batchIndex];
            learnState.phase = 'learn';
            setupLearnWord();
            renderLearnWord();
        } else if (learnState.reviewQueue.length > 0) {
            learnState.phase = 'review';
            learnState.current = learnState.reviewQueue[0];
            setupLearnWord();
            renderLearnWord();
        } else {
            endLearnGame();
        }
    }
}

// 看答案：揭示当前词剩余拼写，保留已打进度，让用户续打当前词（不跳到下一个词）
// silent=true 时（超配额自动揭示）不重复播放错误音
function revealLearnAnswer(silent) {
    if (!gameState.isPlaying || gameState.isPaused) return;
    if (learnState.phase === 'learn') return; // 看词阶段无需看答案
    if (learnState.revealed) return;          // 已揭示过，避免重复
    learnState.revealed = true;
    setWordStatus(currentLibraryId, learnState.current.en, 'learning');
    if (!silent) playSound('wrongSound');
    renderLearnWord();                        // 揭示字母，当前词待续打
}

// 结束学单词游戏
function endLearnGame() {
    gameState.isPlaying = false;
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) bgMusic.pause();

    const progress = countGradeProgress(currentLibraryId);

    document.getElementById('resultMessage').innerHTML = learnState.needReview === 0
        ? '🌟 太棒了！这批词都学会啦！'
        : `👍 不错！还有 ${learnState.needReview} 个词需要再练练！`;
    document.getElementById('standardResult').classList.add('hidden');
    document.getElementById('learnResult').classList.remove('hidden');
    document.getElementById('beginnerResult').classList.add('hidden');
    document.getElementById('learnNewMastered').textContent = learnState.masteredThisSession;
    document.getElementById('learnReviewed').textContent = learnState.needReview;
    document.getElementById('learnGradeProgress').textContent = `${progress.mastered}/${progress.total}`;

    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
}

// 更新开始界面的学单词进度面板
function updateLearnProgress() {
    const el = document.getElementById('learnProgress');
    if (!el) return;
    if (gameState.mode !== 'learn' || !wordList) {
        el.classList.add('hidden');
        return;
    }
    const progress = countGradeProgress(currentLibraryId);
    el.textContent = `本年级已掌握：${progress.mastered} / ${progress.total} 词`;
    el.classList.remove('hidden');
}

// ===== 词库管理面板 =====
// 当前面板的筛选状态（不持久化，仅本次会话）
let wordManagerFilter = { q: '', status: 'all', importantOnly: false };

// 唯一词列表（跨 tier 按 en 去重）
function getUniqueLibraryWords() {
    if (!wordList) return [];
    const all = [...wordList.easy, ...wordList.medium, ...wordList.hard];
    const seen = new Set();
    const unique = [];
    all.forEach(w => {
        if (seen.has(w.en)) return;
        seen.add(w.en);
        unique.push(w);
    });
    return unique;
}

// 弹出词库管理面板
function openWordManager() {
    if (!wordList) { showMessage('词库未加载，无法管理', ''); return; }
    wordManagerFilter = { q: '', status: 'all', importantOnly: false };
    const modal = document.getElementById('wordManagerModal');
    if (!modal) return;
    const lib = wordLibraries.find(l => l.id === currentLibraryId);
    document.getElementById('wordManagerTitle').textContent = `${lib ? lib.name : currentLibraryId} · 词库管理`;
    modal.classList.remove('hidden');
    renderWordManager();
}

function closeWordManager() {
    const modal = document.getElementById('wordManagerModal');
    if (modal) modal.classList.add('hidden');
}

// 渲染当前筛选下的词表
function renderWordManager() {
    const f = wordManagerFilter;
    const important = getImportantSet(currentLibraryId);
    const prog = loadLearnProgress()[currentLibraryId] || {};
    const libName = wordLibraries.find(l => l.id === currentLibraryId);

    const words = getUniqueLibraryWords().filter(w => {
        const st = prog[w.en] || 'new';
        if (f.q && !(w.en.toLowerCase().includes(f.q.toLowerCase()) || (w.zh || '').includes(f.q))) return false;
        if (f.status !== 'all' && st !== f.status) return false;
        if (f.importantOnly && !important.has(w.en)) return false;
        return true;
    });

    const listEl = document.getElementById('wordManagerList');
    const countEl = document.getElementById('wordManagerCount');
    if (!listEl) return;

    countEl.textContent = `共 ${words.length} 词`;
    if (!words.length) {
        listEl.innerHTML = '<div class="wm-empty">没有匹配的单词</div>';
        updateWordManagerBatchInfo();
        return;
    }

    listEl.innerHTML = words.map(w => {
        const st = prog[w.en] || 'new';
        const isImp = important.has(w.en);
        return `
        <div class="wm-row">
            <input type="checkbox" class="wm-check" data-en="${w.en}" ${isImp ? '' : ''}>
            <button class="wm-star ${isImp ? 'on' : ''}" data-en="${w.en}" title="${isImp ? '取消重点' : '标记为重点'}">★</button>
            <div class="wm-word">
                <div class="wm-en">${w.en}</div>
                <div class="wm-zh">${w.zh || ''}</div>
            </div>
            <div class="wm-library-tag">${libName ? libName.name : ''}</div>
            <span class="wm-status ${st}">${st === 'new' ? '未学' : st === 'learning' ? '学习中' : '已掌握'}</span>
            <div class="wm-actions">
                ${st !== 'mastered' ? `<button class="wm-reset" data-en="${w.en}" data-act="master" title="设为已学习">设为已学习</button>` : ''}
                ${st !== 'new' ? `<button class="wm-reset" data-en="${w.en}" data-act="reset" title="放回未学习">放回未学习</button>` : ''}
            </div>
        </div>`;
    }).join('');

    updateWordManagerBatchInfo();
    bindWordManagerEvents();
}

// 更新批量操作栏信息（选中数 / 全选状态）
function updateWordManagerBatchInfo() {
    const checks = document.querySelectorAll('#wordManagerList .wm-check:checked');
    const selCount = document.getElementById('wmSelectedCount');
    if (selCount) selCount.textContent = `已选 ${checks.length} 词`;
    const selectAll = document.getElementById('wmSelectAll');
    if (selectAll) {
        const all = document.querySelectorAll('#wordManagerList .wm-check');
        selectAll.checked = all.length > 0 && all.length === checks.length;
    }
}

// 绑定列表内事件（每词：星标 / 放回未学习 / 复选框）
function bindWordManagerEvents() {
    document.querySelectorAll('.wm-star').forEach(btn => {
        btn.onclick = () => {
            const en = btn.dataset.en;
            const nowOn = btn.classList.contains('on');
            setWordImportant(currentLibraryId, en, !nowOn);
            renderWordManager();
            updateLearnProgress();
        };
    });
    document.querySelectorAll('.wm-reset').forEach(btn => {
        btn.onclick = () => {
            const en = btn.dataset.en;
            const act = btn.dataset.act; // 'master' 设为已学习 | 'reset' 放回未学习
            setWordStatus(currentLibraryId, en, act === 'master' ? 'mastered' : 'new');
            renderWordManager();
            updateLearnProgress();
        };
    });
    document.querySelectorAll('.wm-check').forEach(cb => {
        cb.onchange = updateWordManagerBatchInfo;
    });
}

// 批量动作：对当前筛选结果（或选中项）执行操作
function applyWordManagerBatch(action) {
    const checks = document.querySelectorAll('#wordManagerList .wm-check:checked');
    // 有选中项就作用于选中项，否则作用于当前筛选结果
    const targets = checks.length
        ? Array.from(checks).map(c => c.dataset.en)
        : getUniqueLibraryWords().filter(w => {
            const f = wordManagerFilter;
            const prog = loadLearnProgress()[currentLibraryId] || {};
            const st = prog[w.en] || 'new';
            if (f.q && !(w.en.toLowerCase().includes(f.q.toLowerCase()) || (w.zh || '').includes(f.q))) return false;
            if (f.status !== 'all' && st !== f.status) return false;
            const important = getImportantSet(currentLibraryId);
            if (f.importantOnly && !important.has(w.en)) return false;
            return true;
        }).map(w => w.en);

    if (!targets.length) { showMessage('没有可操作的词', ''); return; }

    targets.forEach(en => {
        if (action === 'reset') setWordStatus(currentLibraryId, en, 'new');
        else if (action === 'master') setWordStatus(currentLibraryId, en, 'mastered');
        else setWordImportant(currentLibraryId, en, action === 'markImportant');
    });
    renderWordManager();
    updateLearnProgress();
    showMessage(`已处理 ${targets.length} 个词`, 'success');
}

// 初始化词库管理面板的事件（筛选栏 / 批量栏 / 关闭）
function initWordManager() {
    const modal = document.getElementById('wordManagerModal');
    if (!modal) return;

    document.getElementById('wordManagerClose')?.addEventListener('click', closeWordManager);
    modal.addEventListener('click', e => { if (e.target === modal) closeWordManager(); });

    document.getElementById('wmSearch')?.addEventListener('input', e => {
        wordManagerFilter.q = e.target.value.trim();
        renderWordManager();
    });

    document.querySelectorAll('.wm-status-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.wm-status-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            wordManagerFilter.status = chip.dataset.status;
            renderWordManager();
        });
    });

    document.getElementById('wmImportantOnly')?.addEventListener('change', e => {
        wordManagerFilter.importantOnly = e.target.checked;
        renderWordManager();
    });

    document.getElementById('wmSelectAll')?.addEventListener('change', e => {
        document.querySelectorAll('#wordManagerList .wm-check').forEach(cb => { cb.checked = e.target.checked; });
        updateWordManagerBatchInfo();
    });

    document.querySelectorAll('[data-wm-batch]').forEach(btn => {
        btn.addEventListener('click', () => applyWordManagerBatch(btn.dataset.wmBatch));
    });
}
if (typeof document !== 'undefined') initWordManager();

// 暂停游戏
function pauseGame() {
    gameState.isPaused = !gameState.isPaused;
    const btn = document.getElementById('pauseButton');
    btn.classList.toggle('paused', gameState.isPaused);
    const btnText = btn.querySelector('.btn-text');
    if (btnText) btnText.textContent = gameState.isPaused ? '继续' : '暂停';
    showMessage(gameState.isPaused ? '游戏已暂停' : '游戏继续！', '');
    
    // 暂停/继续挑战模式计时器
    if (gameState.isPaused) {
        // 暂停：保存剩余时间
        if (gameState.challengeTimer) {
            clearTimeout(gameState.challengeTimer);
            gameState.challengeTimer = null;
        }
        gameState.challengeTimeRemaining = gameState.challengeTimerStartAt
            ? gameState.challengeTimeout - (Date.now() - gameState.challengeTimerStartAt)
            : gameState.challengeTimeout;
        if (gameState.challengeTimeRemaining < 0) gameState.challengeTimeRemaining = 0;
    } else {
        // 恢复：用剩余时间重新计时
        if (gameState.mode === 'challenge' && gameState.isPlaying) {
            const remaining = gameState.challengeTimeRemaining ?? gameState.challengeTimeout;
            if (remaining > 0) {
                gameState.challengeTimer = setTimeout(handleChallengeTimeout, remaining);
                gameState.challengeTimerStartAt = Date.now();
                console.log('挑战模式计时器已恢复，剩余时间:', remaining, 'ms');
            }
        }
    }
    
    // 暂停/恢复背景音乐
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
        if (gameState.isPaused) {
            bgMusic.pause();
        } else {
            bgMusic.play().catch(e => console.log('Background music resume failed:', e));
        }
    }
}

// 结束游戏
function endGame() {
    // 结果页也不显示顶部标题
    setHeaderVisible(false);

    // 学单词模式走独立结束流程
    if (gameState.mode === 'learn') {
        endLearnGame();
        return;
    }
    // 指法起步模式走独立结束流程（结束游戏按钮触发，未完成整条课表）
    if (gameState.mode === 'beginner') {
        endBeginnerGame(false);
        return;
    }
    gameState.isPlaying = false;
    clearInterval(gameState.timerInterval);
    
    // 清除挑战模式计时器
    if (gameState.challengeTimer) {
        clearTimeout(gameState.challengeTimer);
        gameState.challengeTimer = null;
    }
    
    // 停止背景音乐
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
        bgMusic.pause();
    }
    
    // 计算最终统计
    const total = gameState.correct + gameState.wrong;
    const accuracy = total > 0 ? Math.round((gameState.correct / total) * 100) : 0;
    
    // 评价
    let evaluation = '';
    if (accuracy >= 95 && gameState.score >= 500) {
        evaluation = '🏆 太厉害了！你是键盘小大师！';
    } else if (accuracy >= 85 && gameState.score >= 300) {
        evaluation = '🌟 做得真棒！继续加油！';
    } else if (accuracy >= 70) {
        evaluation = '👍 不错哦！多练习会更好！';
    } else {
        evaluation = '💪 加油！熟能生巧！';
    }
    
    // 每次游戏结束后都播放成就音效
    playSound('levelUpSound');
    
    document.getElementById('resultMessage').innerHTML = evaluation;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalAccuracy').textContent = accuracy + '%';
    document.getElementById('finalCombo').textContent = gameState.maxCombo;
    
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    // 常规模式显示标准统计，隐藏学单词/指法统计（避免上一局残留）
    document.getElementById('standardResult').classList.remove('hidden');
    document.getElementById('learnResult').classList.add('hidden');
    document.getElementById('beginnerResult').classList.add('hidden');

    // 保存分数到排行榜
    saveScoreToLeaderboard();
}

// 排行榜相关函数

// 初始化排行榜
function initLeaderboard() {
    const modes = ['letter', 'character', 'word', 'challenge'];
    const difficulties = ['easy', 'medium', 'hard'];

    modes.forEach(mode => {
        difficulties.forEach(difficulty => {
            updateLeaderboardData(mode, difficulty);
        });
    });
    
    // 初始化显示当前设置的排行榜
    updateLeaderboardDisplay();
}

// 保存分数到排行榜
function saveScoreToLeaderboard() {
    const mode = gameState.mode;
    const difficulty = gameState.difficulty;
    const total = gameState.correct + gameState.wrong;
    const accuracy = total > 0 ? Math.round((gameState.correct / total) * 100) : 0;
    
    const scoreData = {
        score: gameState.score,
        accuracy: accuracy,
        combo: gameState.maxCombo,
        timestamp: Date.now()
    };
    
    // 获取现有排行榜数据
    const leaderboard = getLeaderboard(mode, difficulty);
    
    // 添加新分数
    leaderboard.push(scoreData);
    
    // 按分数排序（降序）
    leaderboard.sort((a, b) => b.score - a.score);
    
    // 只保留前10名
    const top10Leaderboard = leaderboard.slice(0, 10);
    
    // 保存回localStorage
    localStorage.setItem(`leaderboard_${mode}_${difficulty}`, JSON.stringify(top10Leaderboard));
    
    // 更新排行榜显示
    updateLeaderboardData(mode, difficulty);
    
    // 如果当前显示的就是这个排行榜，刷新显示
    if (gameState.mode === mode && gameState.difficulty === difficulty) {
        updateLeaderboardDisplay();
    }
}

// 从localStorage获取排行榜数据
function getLeaderboard(mode, difficulty) {
    const stored = localStorage.getItem(`leaderboard_${mode}_${difficulty}`);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing leaderboard data:', e);
            return [];
        }
    }
    return [];
}

// 删除排行榜中的单条记录
function deleteLeaderboardEntry(mode, difficulty, index) {
    const leaderboard = getLeaderboard(mode, difficulty);
    if (index < 0 || index >= leaderboard.length) return;

    leaderboard.splice(index, 1);
    localStorage.setItem(`leaderboard_${mode}_${difficulty}`, JSON.stringify(leaderboard));

    updateLeaderboardData(mode, difficulty);
    if (gameState.mode === mode && gameState.difficulty === difficulty) {
        updateLeaderboardDisplay();
    }
}

// 清空当前排行榜
function clearLeaderboard() {
    const mode = gameState.mode;
    const difficulty = gameState.difficulty;

    const leaderboard = getLeaderboard(mode, difficulty);
    if (leaderboard.length === 0) {
        showMessage('排行榜已为空', '');
        return;
    }

    if (!confirm('确定要清空当前排行榜的所有记录吗？此操作不可恢复！')) {
        return;
    }

    localStorage.setItem(`leaderboard_${mode}_${difficulty}`, JSON.stringify([]));

    updateLeaderboardData(mode, difficulty);
    if (gameState.mode === mode && gameState.difficulty === difficulty) {
        updateLeaderboardDisplay();
    }

    showMessage('排行榜已清空', 'success');
}


// 格式化日期
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 导出排行榜数据
function exportLeaderboard() {
    const modes = ['letter', 'character', 'word', 'challenge'];
    const difficulties = ['easy', 'medium', 'hard'];
    const leaderboardData = {};
    
    // 收集所有排行榜数据
    modes.forEach(mode => {
        leaderboardData[mode] = {};
        difficulties.forEach(difficulty => {
            leaderboardData[mode][difficulty] = getLeaderboard(mode, difficulty);
        });
    });
    
    // 添加导出信息
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        leaderboard: leaderboardData
    };
    
    // 转换为JSON字符串
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // 创建Blob对象
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyboard_master_leaderboard_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 释放URL对象
    URL.revokeObjectURL(url);
    
    // 显示导出成功消息
    showMessage('排行榜数据导出成功！📤', 'success');
}

// 导入排行榜数据
function importLeaderboard() {
    document.getElementById('leaderboardFile').click();
}

// 处理文件导入
function handleFileImport(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            
            // 验证数据格式
            if (!jsonData.leaderboard) {
                throw new Error('无效的排行榜数据格式');
            }
            
            // 导入数据
            const modes = ['letter', 'character', 'word', 'challenge'];
            const difficulties = ['easy', 'medium', 'hard'];

            modes.forEach(mode => {
                if (jsonData.leaderboard[mode]) {
                    difficulties.forEach(difficulty => {
                        if (jsonData.leaderboard[mode][difficulty]) {
                            // 保存数据到localStorage
                            localStorage.setItem(`leaderboard_${mode}_${difficulty}`, JSON.stringify(jsonData.leaderboard[mode][difficulty]));
                            // 更新排行榜显示
                            updateLeaderboardDisplay();
                        }
                    });
                }
            });
            
            // 显示导入成功消息
            showMessage('排行榜数据导入成功！📥', 'success');
            
        } catch (error) {
            console.error('导入失败:', error);
            showMessage('导入失败，请检查文件格式！❌', 'error');
        }
    };
    reader.onerror = function() {
        showMessage('文件读取失败！❌', 'error');
    };
    reader.readAsText(file);
    
    // 重置文件输入
    input.value = '';
}

// 重新开始游戏
// 从结果页返回首页（模式选择）
function goToHome() {
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    showStartStep(1);
}

function restartGame() {
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    // 回到步骤2，保留上次模式设置，便于"再玩一次"
    showStartStep(2);
    renderSettingsForMode(gameState.mode);
}

// 初始化
window.addEventListener('DOMContentLoaded', async function() {
    console.log('游戏初始化开始...');
    
    // 首先设置事件监听器
    setupEventListeners();
    console.log('事件监听器设置完成');
    
    // 然后加载单词库，等待完成
    try {
        console.log('开始加载词库...');
        await loadWordList('grade3');
        console.log('单词库加载完成，游戏初始化完成');
        
        // 单词库加载成功后，显示开始界面
        showMessage('单词库加载成功，准备开始游戏！🎮', 'success');
        
        // 初始化排行榜
        initLeaderboard();
        console.log('排行榜初始化完成');

        // 同步声音开关按钮状态（右上角悬浮按钮进页面即显示正确状态）
        updateSoundButtons();

        // 进入步骤1：选择模式
        showStartStep(1);
        
    } catch (error) {
        console.error('游戏初始化失败:', error);
        
        // 显示错误消息
        showMessage('游戏初始化失败，请检查单词库文件。❌', 'error');
    }
});