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

// 音效控制
function toggleSound() {
    gameState.soundEnabled = !gameState.soundEnabled;
    const button = document.getElementById('soundButton');
    const text = button.querySelector('.btn-text');
    if (gameState.soundEnabled) {
        button.classList.remove('muted');
        if (text) text.textContent = '音效';
        playSound('keySound'); // 测试音效
    } else {
        button.classList.add('muted');
        if (text) text.textContent = '静音';
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

// 测试所有音效
function testAllSounds() {
    if (!gameState.soundEnabled) {
        gameState.soundEnabled = true;
        const sb = document.getElementById('soundButton');
        sb.classList.remove('muted');
        const t = sb.querySelector('.btn-text');
        if (t) t.textContent = '音效';
    }
    
    // 依次播放所有音效
    const sounds = [
        { id: 'keySound', name: '按键音效' },
        { id: 'correctSound', name: '正确音效' },
        { id: 'wrongSound', name: '错误音效' },
        { id: 'levelUpSound', name: '成就音效' },
        { id: 'bgMusic', name: '背景音乐' }
    ];
    
    let delay = 0;
    sounds.forEach((sound, index) => {
        setTimeout(() => {
            playSound(sound.id);
            showMessage(`测试: ${sound.name}`, 'success');
            if (index === sounds.length - 1) {
                setTimeout(() => {
                    showMessage('准备好了吗？按键盘上对应的键！', '');
                }, 1000);
            }
        }, delay);
        delay += 1000;
    });
}

// 排行榜显示逻辑：只显示当前游戏设置的模式和难度，并更新数据
function updateLeaderboardDisplay() {
    const mode = gameState.mode;
    const difficulty = gameState.difficulty;
    
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
        'challenge': '挑战模式'
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
    document.querySelectorAll('.library-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const libraryId = this.dataset.library;
            if (libraryId === currentLibraryId) return;

            document.querySelectorAll('.library-btn').forEach(b => {
                b.classList.remove('active');
                b.disabled = true;
                const t = b.querySelector('.btn-text');
                if (t) t.textContent = t.textContent.replace('…', '');
            });
            this.classList.add('active');
            const t = this.querySelector('.btn-text');
            if (t) t.textContent = t.textContent + '…';

            await loadWordList(libraryId);

            document.querySelectorAll('.library-btn').forEach(b => {
                b.disabled = false;
                const t = b.querySelector('.btn-text');
                if (t) t.textContent = t.textContent.replace('…', '');
            });
        });
    });

    // 模式选择
    document.querySelectorAll('.mode-selector .mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mode-selector .mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const mode = this.dataset.mode;
            gameState.mode = mode;

            // 字母/字符模式：难度不生效，置灰
            const isModeWithoutDifficulty = mode === 'letter' || mode === 'character';
            document.querySelectorAll('.difficulty-btn').forEach(b => {
                b.disabled = isModeWithoutDifficulty;
            });

            // 词库仅在单词模式可用
            const isLibraryMode = mode === 'word';
            document.querySelectorAll('.library-btn').forEach(b => {
                b.disabled = !isLibraryMode;
            });
            const libHint = document.getElementById('libraryHint');
            if (libHint) {
                libHint.classList.toggle('hidden', isLibraryMode);
            }

            // 难度提示文字
            const hint = document.getElementById('difficultyHint');
            if (hint) {
                if (mode === 'word') {
                    hint.textContent = '简单=短词(2-3字母) / 中等=中词(4-5字母) / 困难=长词(6+字母)';
                    hint.classList.remove('hidden');
                } else if (mode === 'challenge') {
                    hint.textContent = '简单=3秒超时 / 中等=2秒超时 / 困难=1秒超时';
                    hint.classList.remove('hidden');
                } else {
                    hint.classList.add('hidden');
                }
            }

            // 更新排行榜显示
            updateLeaderboardDisplay();
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
function startGame() {
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
        timeLeft: (gameState.mode === 'letter' || gameState.mode === 'character')
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

    // 播放背景音乐
    if (gameState.soundEnabled) {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic) {
            bgMusic.volume = 0.3 * masterVolume;
            bgMusic.play().catch(e => console.log('Background music play failed:', e));
        }
    }

    // 更新界面
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');

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
    if (gameState.isPlaying && gameState.mode === 'challenge' && gameState.currentIndex < gameState.currentTarget.length) {
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
    
    displayTarget();
    highlightTargetKey();
}

// 显示目标
function displayTarget() {
    const display = document.getElementById('targetDisplay');
    display.innerHTML = '';

    for (let i = 0; i < gameState.currentTarget.length; i++) {
        const char = document.createElement('span');
        char.className = 'target-char';
        char.textContent = gameState.currentTarget[i];

        if (i < gameState.currentIndex) {
            char.classList.add('correct');
        } else if (i === gameState.currentIndex) {
            char.classList.add('current');
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
    if (gameState.currentIndex < gameState.currentTarget.length) {
        let targetChar = gameState.currentTarget[gameState.currentIndex].toLowerCase();
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
    
    const expected = gameState.currentTarget[gameState.currentIndex].toLowerCase();
    
    if (input === expected) {
        // 正确输入
        handleCorrect();
    } else {
        // 错误输入
        handleWrong();
    }
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

    const completed = gameState.currentIndex >= gameState.currentTarget.length;

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
    const maxTime = (gameState.mode === 'letter' || gameState.mode === 'character')
        ? 60
        : gameState.difficulty === 'easy' ? 60 : gameState.difficulty === 'medium' ? 40 : 30;
    const progress = ((maxTime - gameState.timeLeft) / maxTime) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
}

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
function restartGame() {
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
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

        // 默认字母模式，禁用难度和词库选择
        document.querySelectorAll('.difficulty-btn').forEach(b => b.disabled = true);
        document.querySelectorAll('.library-btn').forEach(b => b.disabled = true);
        document.getElementById('libraryHint')?.classList.remove('hidden');
        
    } catch (error) {
        console.error('游戏初始化失败:', error);
        
        // 显示错误消息
        showMessage('游戏初始化失败，请检查单词库文件。❌', 'error');
    }
});