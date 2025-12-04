import { GameState } from './state.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';

const canvas = document.getElementById('gameCanvas');
const targetCanvas = document.getElementById('targetCanvas');

const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');
const btnTheme = document.getElementById('btn-theme');

const panelChallenge = document.getElementById('challenge-panel');
const winTarget = document.getElementById('target-window');
const txtTargetCaption = document.getElementById('target-caption');
const panelSandbox = document.getElementById('sandbox-controls');

const btnStartChallenge = document.getElementById('btn-start-challenge');
const btnQuitChallenge = document.getElementById('btn-quit-challenge');
const btnGiveUp = document.getElementById('btn-giveup');
const btnNext = document.getElementById('btn-next');
const txtStatus = document.getElementById('challenge-status');
const inpNodeCount = document.getElementById('node-count');

// ヘルプ用
const btnHelp = document.getElementById('btn-help');
const modalHelp = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

// 再生用
const replayControls = document.getElementById('replay-controls');
const btnReplayPrev = document.getElementById('btn-replay-prev');
const btnReplayNext = document.getElementById('btn-replay-next');
const txtReplayStep = document.getElementById('replay-step-text');

const state = new GameState();
const renderer = new Renderer(canvas, targetCanvas);
const input = new InputHandler(canvas, renderer, state);

function init() {
    window.addEventListener('resize', () => renderer.resize());
    renderer.resize();
    renderer.centerCamera();

    canvas.addEventListener('mousedown', (e) => input.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => input.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => input.handleMouseUp(e));
    canvas.addEventListener('wheel', (e) => input.handleWheel(e), { passive: false });

    input.onAction = (action) => {
        if (state.isSolved) return;
        
        if (action.type === 'grow') {
            state.grow(action.srcId, action.tx, action.ty);
        } else if (action.type === 'split') {
            state.split(action.edgeIndex, action.uId, action.vId);
        }
        updateUI();
    };

    btnUndo.addEventListener('click', () => {
        if(state.isSolved) return;
        state.undo();
        state.nodes.forEach(n => {
            n.vx = n.gx * 50; 
            n.vy = -n.gy * 50;
        });
        updateUI();
    });
    
    btnReset.addEventListener('click', () => {
        if (state.mode === 'challenge') {
            while(state.canUndo()) state.undo();
        } else {
            state.reset();
            renderer.centerCamera();
        }
        updateUI();
    });

    btnTheme.addEventListener('click', toggleTheme);
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'z') btnUndo.click();
        if (key === 'r') btnReset.click();
    });

    btnStartChallenge.addEventListener('click', () => {
        const count = parseInt(inpNodeCount.value) || 5;
        state.startChallenge(Math.max(3, count));
        renderer.centerCamera();
        renderer.resetTargetView(true); // 変更: trueでアニメーションスキップ
        updateUI();
    });

    btnQuitChallenge.addEventListener('click', () => {
        state.quitChallenge();
        renderer.resetTargetView(true); // 変更: リセット時も即時反映
        updateUI();
    });

    btnGiveUp.addEventListener('click', () => {
        state.giveUp();
        updateUI();
    });

    btnNext.addEventListener('click', () => {
        const count = parseInt(inpNodeCount.value) || 5;
        state.newProblem(Math.max(3, count));
        renderer.centerCamera();
        renderer.resetTargetView(true); // 変更: trueでアニメーションスキップ
        updateUI();
    });

    btnReplayPrev.addEventListener('click', () => {
        state.stepReplay(-1);
        updateUI();
    });
    btnReplayNext.addEventListener('click', () => {
        state.stepReplay(1);
        updateUI();
    });

    // ヘルプのイベント
    btnHelp.addEventListener('click', () => {
        modalHelp.style.display = 'flex';
    });
    btnCloseHelp.addEventListener('click', () => {
        modalHelp.style.display = 'none';
    });
    modalHelp.addEventListener('click', (e) => {
        if (e.target === modalHelp) modalHelp.style.display = 'none';
    });

    loadTheme();
    loop();
}

function updateUI() {
    btnUndo.disabled = !state.canUndo() || state.isSolved;
    
    if (state.mode === 'challenge') {
        panelChallenge.style.display = 'flex';
        winTarget.style.display = 'flex';
        txtTargetCaption.style.display = 'block'; // 注釈を表示
        panelSandbox.style.display = 'none';
        btnQuitChallenge.style.display = 'inline-block';
        
        const showReplay = state.isSolved || state.isGivenUp;
        replayControls.style.display = showReplay ? 'flex' : 'none';
        
        if (showReplay) {
            const current = state.replayIndex + 1;
            const total = state.targetHistory.length;
            txtReplayStep.innerText = `${current} / ${total}`;
            btnReplayPrev.disabled = state.replayIndex <= 0;
            btnReplayNext.disabled = state.replayIndex >= total - 1;
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

    } else {
        panelChallenge.style.display = 'none';
        winTarget.style.display = 'none';
        txtTargetCaption.style.display = 'none';
        replayControls.style.display = 'none';
        panelSandbox.style.display = 'flex';
        btnQuitChallenge.style.display = 'none';
    }
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