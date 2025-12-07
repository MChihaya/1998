import { GraphGenerator } from './generator.js';
import { getComponent, normalizeAndHash } from './utils.js';
import { GraphSolver } from './solver.js';

export class GameState {
    constructor() {
        this.reset();
        this.mode = 'sandbox'; // 'sandbox' | 'challenge' | 'verification'
        this.targetGraph = null;
        this.targetHistory = []; // 正解作成の履歴
        this.replayIndex = 0;    // 現在表示中のステップ
        this.isSolved = false;
        this.isGivenUp = false;
        
        // 検証モード用のユニークID管理
        this.verifNextId = 1;
    }

    reset() {
        this.nodes = [{ id: 0, gx: 0, gy: 0, color: 0, vx: 0, vy: 0 }];
        this.edges = [];
        this.historyStack = [];
        this.nextId = 1;
        this.verifNextId = 1;
    }

    startChallenge(nodeCount) {
        this.mode = 'challenge';
        this.newProblem(nodeCount);
    }

    startVerification() {
        this.mode = 'verification';
        this.reset();
        this.nodes = []; // 検証モードは空からスタート
        this.edges = [];
        this.targetGraph = null;
        this.targetHistory = [];
    }

    newProblem(nodeCount) {
        this.reset();
        const generated = GraphGenerator.generate(nodeCount);
        this.targetGraph = { nodes: generated.nodes, edges: generated.edges };
        this.targetHistory = generated.history;
        this.replayIndex = this.targetHistory.length - 1; // 最初は完成形を表示

        this.isSolved = false;
        this.isGivenUp = false;
        this.checkSolution();
    }

    giveUp() { 
        this.isGivenUp = true; 
        this.replayIndex = 0;
    }

    // 検証モード: ソルバー実行
    solveVerification() {
        if (this.mode !== 'verification') return false;
        
        const result = GraphSolver.solve(this.nodes);
        if (result) {
            this.targetGraph = { nodes: result.nodes, edges: result.edges };
            this.targetHistory = result.history;
            this.replayIndex = this.targetHistory.length - 1;
            return true;
        } else {
            return false;
        }
    }

    // 検証モード: ノードのトグル (なし -> 白 -> 黒 -> なし)
    toggleNode(gx, gy) {
        if (this.mode !== 'verification') return;
        this.save();

        const idx = this.nodes.findIndex(n => n.gx === gx && n.gy === gy);
        if (idx >= 0) {
            const node = this.nodes[idx];
            if (node.color === 0) {
                // 白 -> 黒
                node.color = 1;
            } else {
                // 黒 -> 削除
                this.nodes.splice(idx, 1);
            }
        } else {
            // なし -> 白
            // アニメーション用座標(vx, vy)も設定
            this.nodes.push({
                id: this.verifNextId++,
                gx: gx, gy: gy, color: 0,
                vx: gx * 50, vy: -gy * 50
            });
        }
    }

    // 再生コントロール用
    stepReplay(delta) {
        const next = this.replayIndex + delta;
        if (next >= 0 && next < this.targetHistory.length) {
            this.replayIndex = next;
            return true;
        }
        return false;
    }

    // 現在の再生ステップのデータを取得
    getCurrentTargetStep() {
        if (!this.targetHistory.length) return null;
        return this.targetHistory[this.replayIndex];
    }

    // 最終完成形を取得（カメラ固定用）
    getFinalTargetGraph() {
        if (!this.targetHistory.length) return null;
        return this.targetHistory[this.targetHistory.length - 1];
    }

    quitChallenge() {
        this.mode = 'sandbox';
        this.targetGraph = null;
        this.targetHistory = [];
        this.isSolved = false;
        this.isGivenUp = false;
        this.reset();
    }

    checkSolution() {
        if (this.mode !== 'challenge' || !this.targetGraph) return;

        const userHash = normalizeAndHash(this.nodes);
        const targetHash = normalizeAndHash(this.targetGraph.nodes);

        if (userHash.size !== targetHash.size) {
            this.isSolved = false;
            return;
        }

        for (const val of userHash) {
            if (!targetHash.has(val)) {
                this.isSolved = false;
                return;
            }
        }
        this.isSolved = true;
    }

    save() {
        const snapshot = {
            nodes: this.nodes.map(n => ({ ...n })),
            edges: JSON.parse(JSON.stringify(this.edges)),
            nextId: this.nextId,
            verifNextId: this.verifNextId
        };
        this.historyStack.push(snapshot);
        if (this.historyStack.length > 50) this.historyStack.shift();
    }

    undo() {
        if (!this.canUndo()) return;
        const prev = this.historyStack.pop();
        this.edges = prev.edges;
        this.nextId = prev.nextId;
        this.verifNextId = prev.verifNextId || 1;
        this.nodes = prev.nodes.map(n => n); 
        this.checkSolution();
    }

    canUndo() { return this.historyStack.length > 0; }

    grow(srcId, tx, ty) {
        this.save();
        const srcNode = this.nodes.find(n => n.id === srcId);
        if (!srcNode) return;

        const newId = this.nextId++;
        this.nodes.push({
            id: newId, gx: tx, gy: ty, color: 0,
            vx: srcNode.vx, vy: srcNode.vy
        });
        this.edges.push({ u: srcId, v: newId });
        srcNode.color = 1 - srcNode.color;
        this.checkSolution();
    }

    split(edgeIndex, uId, vId) {
        this.save();
        const uNode = this.nodes.find(n => n.id === uId);
        const vNode = this.nodes.find(n => n.id === vId);
        
        const dgx = vNode.gx - uNode.gx;
        const dgy = vNode.gy - uNode.gy;
        const component = getComponent(this.nodes, this.edges, vId, uId);
        
        this.nodes.forEach(n => {
            if (component.has(n.id)) {
                n.gx += dgx;
                n.gy += dgy;
            }
        });

        this.edges.splice(edgeIndex, 1);
        const newId = this.nextId++;
        const insGx = vNode.gx - dgx;
        const insGy = vNode.gy - dgy;
        const midVx = (uNode.vx + vNode.vx) / 2;
        const midVy = (uNode.vy + vNode.vy) / 2;

        this.nodes.push({
            id: newId, gx: insGx, gy: insGy, color: 0,
            vx: midVx, vy: midVy
        });

        this.edges.push({ u: uId, v: newId });
        this.edges.push({ u: newId, v: vId });

        uNode.color = 1 - uNode.color;
        vNode.color = 1 - vNode.color;

        this.checkSolution();
    }
}