import { GameState } from './state.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';

const canvas = document.getElementById('gameCanvas');
const targetCanvas = document.getElementById('targetCanvas');

const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');
const btnTheme = document.getElementById('btn-theme');
const btnResetCamera = document.getElementById('btn-reset-camera');

const panelChallenge = document.getElementById('challenge-panel');
const panelVerification = document.getElementById('verification-panel');
const winTarget = document.getElementById('target-window');
const txtTargetCaption = document.getElementById('target-caption');
const panelSandbox = document.getElementById('sandbox-controls');
const panelVerificationControls = document.getElementById('verification-controls');

const btnStartChallenge = document.getElementById('btn-start-challenge');
const btnQuitChallenge = document.getElementById('btn-quit-challenge');
const btnGiveUp = document.getElementById('btn-giveup');
const btnNext = document.getElementById('btn-next');
const txtStatus = document.getElementById('challenge-status');
const inpNodeCount = document.getElementById('node-count');

// 検証モード用
const btnVerificationMode = document.getElementById('btn-verification-mode');
const btnSolve = document.getElementById('btn-solve');
const btnQuitVerification = document.getElementById('btn-quit-verification');

// ヘルプ用
const btnHelp = document.getElementById('btn-help');
const modalHelp = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

// 再生用
const replayControls = document.getElementById('replay-controls');
const btnReplayPrev = document.getElementById('btn-replay-prev');
const btnReplayNext = document.getElementById('btn-replay-next');
const txtReplayStep = document.getElementById('replay-step-text');

// スマホ用トグルボタン
const btnToggleControls = document.getElementById('btn-toggle-controls');
const controlsDiv = document.querySelector('.controls');

const state = new GameState();
const renderer = new Renderer(canvas, targetCanvas);
const input = new InputHandler(canvas, renderer, state);

function init() {
    window.addEventListener('resize', () => renderer.resize());
    renderer.resize();
    renderer.centerCamera();

    // マウスイベント
    canvas.addEventListener('mousedown', (e) => input.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => input.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => input.handleMouseUp(e));
    canvas.addEventListener('wheel', (e) => input.handleWheel(e), { passive: false });

    // タッチイベント
    canvas.addEventListener('touchstart', (e) => input.handleTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => input.handleTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => input.handleTouchEnd(e), { passive: false });

    // ターゲットウィンドウのイベント伝播を防ぐ
    const stopPropagation = (e) => {
        e.stopPropagation();
    };
    winTarget.addEventListener('mousedown', stopPropagation);
    winTarget.addEventListener('touchstart', stopPropagation, { passive: false });
    winTarget.addEventListener('click', stopPropagation);
    winTarget.addEventListener('touchend', stopPropagation, { passive: false });

    input.onAction = (action) => {
        if (state.isSolved) return;
        
        if (action.type === 'grow') {
            state.grow(action.srcId, action.tx, action.ty);
        } else if (action.type === 'split') {
            state.split(action.edgeIndex, action.uId, action.vId);
        }
        updateUI();
    };

    input.onEdit = (gx, gy) => {
        state.toggleNode(gx, gy);
        // 検証モードではターゲット表示はクリアする（編集されたため）
        state.targetGraph = null;
        updateUI();
    };

    btnUndo.addEventListener('click', () => {
        if(state.isSolved && state.mode === 'challenge') return;
        state.undo();
        // アニメーションターゲットをリセット
        state.nodes.forEach(n => {
            n.vx = n.gx * 50; 
            n.vy = -n.gy * 50;
        });
        updateUI();
    });
    
    btnReset.addEventListener('click', () => {
        if (state.mode === 'challenge') {
            while(state.canUndo()) state.undo();
        } else if (state.mode === 'verification') {
            state.startVerification(); // 全クリア
            renderer.centerCamera();
        } else {
            state.reset();
            renderer.centerCamera();
        }
        updateUI();
    });

    btnResetCamera.addEventListener('click', () => {
        renderer.centerCamera();
    });

    btnTheme.addEventListener('click', toggleTheme);
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'z') btnUndo.click();
        if (key === 'r') btnReset.click();
    });

    // --- チャレンジモード ---
    btnStartChallenge.addEventListener('click', () => {
        let count = parseInt(inpNodeCount.value) || 5;
        count = Math.min(100, Math.max(3, count));
        inpNodeCount.value = count;

        state.startChallenge(count);
        renderer.centerCamera();
        renderer.resetTargetView(true);
        updateUI();
    });

    btnQuitChallenge.addEventListener('click', () => {
        state.quitChallenge();
        renderer.resetTargetView(true);
        updateUI();
    });

    btnGiveUp.addEventListener('click', () => {
        state.giveUp();
        updateUI();
    });

    btnNext.addEventListener('click', () => {
        let count = parseInt(inpNodeCount.value) || 5;
        count = Math.min(100, Math.max(3, count));
        inpNodeCount.value = count;
        state.newProblem(count);
        renderer.centerCamera();
        renderer.resetTargetView(true);
        updateUI();
    });

    // --- 検証モード ---
    const handleVerificationClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        state.startVerification();
        renderer.centerCamera();
        renderer.resetTargetView(true);
        updateUI();
    };
    
    btnVerificationMode.addEventListener('click', handleVerificationClick, { passive: false });
    btnVerificationMode.addEventListener('touchend', handleVerificationClick, { passive: false });

    const handleSolveClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        btnSolve.disabled = true;
        btnSolve.innerText = "探索中...";
        // UI更新のため少し待つ
        setTimeout(() => {
            const success = state.solveVerification();
            if (success) {
                renderer.resetTargetView(true);
            } else {
                alert("これを作ることはできません。");
            }
            btnSolve.disabled = false;
            btnSolve.innerText = "答えの確認";
            updateUI();
        }, 50);
    };
    
    btnSolve.addEventListener('click', handleSolveClick, { passive: false });
    btnSolve.addEventListener('touchend', handleSolveClick, { passive: false });

    const handleQuitVerificationClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        state.quitChallenge(); // サンドボックスに戻る
        renderer.resetTargetView(true);
        updateUI();
    };
    
    btnQuitVerification.addEventListener('click', handleQuitVerificationClick, { passive: false });
    btnQuitVerification.addEventListener('touchend', handleQuitVerificationClick, { passive: false });

    // --- 再生 ---
    const handleReplayPrevClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        state.stepReplay(-1);
        updateUI();
    };
    
    const handleReplayNextClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        state.stepReplay(1);
        updateUI();
    };
    
    btnReplayPrev.addEventListener('click', handleReplayPrevClick, { passive: false });
    btnReplayPrev.addEventListener('touchend', handleReplayPrevClick, { passive: false });
    btnReplayNext.addEventListener('click', handleReplayNextClick, { passive: false });
    btnReplayNext.addEventListener('touchend', handleReplayNextClick, { passive: false });

    // ヘルプ
    btnHelp.addEventListener('click', () => {
        modalHelp.style.display = 'flex';
    });
    btnCloseHelp.addEventListener('click', () => {
        modalHelp.style.display = 'none';
    });
    modalHelp.addEventListener('click', (e) => {
        if (e.target === modalHelp) modalHelp.style.display = 'none';
    });

    if (btnToggleControls) {
        btnToggleControls.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!controlsDiv) return;
            controlsDiv.classList.toggle('hidden');
            btnToggleControls.classList.toggle('closed');
        });
    }

    loadTheme();
    loop();
}

function updateUI() {
    btnUndo.disabled = !state.canUndo() || (state.mode === 'challenge' && state.isSolved);
    
    // 全て非表示にしてから必要なものを出す
    panelChallenge.style.display = 'none';
    panelVerification.style.display = 'none';
    winTarget.style.display = 'none';
    txtTargetCaption.style.display = 'none';
    replayControls.style.display = 'none';
    panelSandbox.style.display = 'none';
    panelVerificationControls.style.display = 'none';
    btnQuitChallenge.style.display = 'none';

    if (state.mode === 'challenge') {
        panelChallenge.style.display = 'flex';
        winTarget.style.display = 'flex';
        txtTargetCaption.style.display = 'block'; 
        btnQuitChallenge.style.display = 'inline-block';
        
        const showReplay = state.isSolved || state.isGivenUp;
        replayControls.style.display = showReplay ? 'flex' : 'none';
        
        if (showReplay) {
            updateReplayControls();
        }

        if (state.isSolved) {
            txtStatus.innerText = "正解！";
            txtStatus.className = "status-success";
            btnGiveUp.style.display = "none";
            btnNext.style.display = "inline-block";
        } else if (state.isGivenUp) {
            txtStatus.innerText = "正解例";
            txtStatus.className = "status-fail";
            btnGiveUp.style.display = "none";
            btnNext.style.display = "inline-block";
        } else {
            txtStatus.innerText = "挑戦中...";
            txtStatus.className = "";
            btnGiveUp.style.display = "inline-block";
            btnNext.style.display = "none";
        }

    } else if (state.mode === 'verification') {
        panelVerification.style.display = 'flex';
        panelVerificationControls.style.display = 'flex';
        
        // 解が見つかっている場合
        if (state.targetGraph) {
            winTarget.style.display = 'flex';
            replayControls.style.display = 'flex';
            updateReplayControls();
        }

    } else {
        // Sandbox
        panelSandbox.style.display = 'flex';
    }
}

function updateReplayControls() {
    const current = state.replayIndex + 1;
    const total = state.targetHistory.length;
    txtReplayStep.innerText = `${current} / ${total}`;
    btnReplayPrev.disabled = state.replayIndex <= 0;
    btnReplayNext.disabled = state.replayIndex >= total - 1;
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    renderer.setTheme(themeName);
    localStorage.setItem('theme', themeName);
}

function loadTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) setTheme(saved);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
    else setTheme('light');
}

function loop() {
    renderer.updateAnimations(state.nodes);
    renderer.draw(state, { hoveredAction: input.hoveredAction });
    requestAnimationFrame(loop);
}

init();