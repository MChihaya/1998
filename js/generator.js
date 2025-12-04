import { getComponent } from './utils.js';

export class GraphGenerator {
    static generate(targetNodeCount) {
        // 初期状態
        let nodes = [{ id: 0, gx: 0, gy: 0, color: 0 }];
        let edges = [];
        let nextId = 1;

        // 履歴保存用（初期状態を保存）
        const history = [];
        const saveSnapshot = () => {
            history.push({
                nodes: JSON.parse(JSON.stringify(nodes)),
                edges: JSON.parse(JSON.stringify(edges))
            });
        };
        saveSnapshot(); // ステップ 0 (初期ノード)

        let attempts = 0;
        while (nodes.length < targetNodeCount && attempts < 2000) {
            attempts++;
            const opType = Math.random() < 0.6 ? 'grow' : 'split';
            let success = false;

            if (opType === 'grow') {
                if (this.tryGrow(nodes, edges, nextId)) {
                    nextId++;
                    success = true;
                }
            } else {
                if (this.trySplit(nodes, edges, nextId)) {
                    nextId++;
                    success = true;
                }
            }

            if (success) {
                saveSnapshot(); // 成功したステップを記録
                attempts = 0;
            }
        }
        
        // 最終的なデータと履歴を返す
        return { nodes, edges, history };
    }

    static tryGrow(nodes, edges, newId) {
        const srcNode = nodes[Math.floor(Math.random() * nodes.length)];
        const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
        const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        
        const tx = srcNode.gx + dx;
        const ty = srcNode.gy + dy;

        if (nodes.some(n => n.gx === tx && n.gy === ty)) return false;

        nodes.push({ id: newId, gx: tx, gy: ty, color: 0 });
        edges.push({ u: srcNode.id, v: newId });
        srcNode.color = 1 - srcNode.color;

        return true;
    }

    static trySplit(nodes, edges, newId) {
        if (edges.length === 0) return false;
        const edgeIdx = Math.floor(Math.random() * edges.length);
        const edge = edges[edgeIdx];
        const uNode = nodes.find(n => n.id === edge.u);
        const vNode = nodes.find(n => n.id === edge.v);

        const dgx = vNode.gx - uNode.gx;
        const dgy = vNode.gy - uNode.gy;
        const componentIds = getComponent(nodes, edges, vNode.id, uNode.id);
        
        const componentNodes = nodes.filter(n => componentIds.has(n.id));
        const staticNodes = nodes.filter(n => !componentIds.has(n.id));

        const movedCoords = componentNodes.map(n => ({ x: n.gx + dgx, y: n.gy + dgy }));
        for (const moved of movedCoords) {
            if (staticNodes.some(s => s.gx === moved.x && s.gy === moved.y)) return false;
        }

        componentNodes.forEach(n => { n.gx += dgx; n.gy += dgy; });
        edges.splice(edgeIdx, 1);
        
        const insGx = vNode.gx - dgx;
        const insGy = vNode.gy - dgy;

        nodes.push({ id: newId, gx: insGx, gy: insGy, color: 0 });
        edges.push({ u: uNode.id, v: newId });
        edges.push({ u: newId, v: vNode.id });

        uNode.color = 1 - uNode.color;
        vNode.color = 1 - vNode.color;

        return true;
    }
}