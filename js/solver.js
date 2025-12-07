import { getComponent } from './utils.js';

export class GraphSolver {
    static solve(nodes) {
        const solver = new GraphSolver(nodes);
        return solver.run();
    }

    constructor(nodes) {
        this.targetNodes = nodes.map(n => ({
            gx: n.gx,
            gy: n.gy,
            color: n.color,
            id: n.id
        }));
        
        this.maxIterations = 100000;
    }

    run() {
        // 初期状態チェック
        const whiteNodes = this.targetNodes.filter(n => n.color === 0);
        
        if (whiteNodes.length === 0) {
            console.log("白いノードが存在しません");
            return null;
        }

        // ノード数1の特殊ケース: 白ノード1個なら即座に成功
        if (this.targetNodes.length === 1 && this.targetNodes[0].color === 0) {
            return {
                nodes: this.targetNodes,
                edges: [],
                history: [{ nodes: this.targetNodes, edges: [] }]
            };
        }

        // 可能なすべての木構造パターンを生成
        const allTreePatterns = this.generateAllTreePatterns(this.targetNodes);
        
        if (allTreePatterns.length === 0) {
            console.log("連結な木構造を構築できません");
            return null;
        }

        console.log(`${allTreePatterns.length}個の異なる木構造パターンを試します`);

        // 各パターンで探索を試みる
        for (let i = 0; i < allTreePatterns.length; i++) {
            const initialEdges = allTreePatterns[i];
            console.log(`パターン ${i + 1}/${allTreePatterns.length} を探索中...`);
            
            // 逆方向BFSで探索（targetから1ノードまで）
            const result = this.reverseBfsSearch(initialEdges);
            
            if (result) {
                // 逆順だったので反転してhistory形式に変換
                const history = result.steps.reverse();
                console.log(`パターン ${i + 1} で解が見つかりました！`);
                return {
                    nodes: this.targetNodes,
                    edges: initialEdges,
                    history: history
                };
            }
        }
        
        console.log("すべてのパターンで解が見つかりませんでした");
        return null;
    }

    reverseBfsSearch(initialEdges) {
        const queue = [];
        const visited = new Set();

        // 初期状態: ターゲットから開始（逆方向探索）
        const initialKey = this.stateKey(this.targetNodes, initialEdges);
        
        queue.push({
            nodes: this.cloneNodes(this.targetNodes),
            edges: this.cloneEdges(initialEdges),
            steps: [{ nodes: this.cloneNodes(this.targetNodes), edges: this.cloneEdges(initialEdges) }],
            iteration: 0
        });
        visited.add(initialKey);

        let iterations = 0;

        while (queue.length > 0 && iterations < this.maxIterations) {
            iterations++;
            const current = queue.shift();
            const { nodes, edges, steps } = current;

            // ゴール判定: ノードが1個かつ白色
            if (nodes.length === 1 && nodes[0].color === 0) {
                console.log(`解発見: ${iterations}回の探索で到達`);
                return { steps };
            }

            // 定期的なログ出力
            if (iterations % 10000 === 0) {
                console.log(`探索中... ${iterations}回, キュー: ${queue.length}, 訪問済み: ${visited.size}, 現在ノード数: ${nodes.length}`);
            }

            // 逆操作1: Ungrow（白い葉ノード削除）
            const ungrowResults = this.tryUngrow(nodes, edges);
            for (const nextState of ungrowResults) {
                const key = this.stateKey(nextState.nodes, nextState.edges);
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push({
                        nodes: nextState.nodes,
                        edges: nextState.edges,
                        steps: [...steps, { nodes: this.cloneNodes(nextState.nodes), edges: this.cloneEdges(nextState.edges) }],
                        iteration: iterations
                    });
                }
            }

            // 逆操作2: Unsplit（白ノードdegree=2を削除してエッジ統合）
            const unsplitResults = this.tryUnsplit(nodes, edges);
            for (const nextState of unsplitResults) {
                const key = this.stateKey(nextState.nodes, nextState.edges);
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push({
                        nodes: nextState.nodes,
                        edges: nextState.edges,
                        steps: [...steps, { nodes: this.cloneNodes(nextState.nodes), edges: this.cloneEdges(nextState.edges) }],
                        iteration: iterations
                    });
                }
            }
        }

        console.log(`探索終了: ${iterations}回で解が見つかりませんでした`);
        return null;
    }

    // Ungrow逆操作: 白い葉ノード（エッジが1本だけ）を削除
    tryUngrow(nodes, edges) {
        const results = [];

        for (const node of nodes) {
            if (node.color !== 0) continue; // 白ノードのみ

            const connectedEdges = edges.filter(e => e.u === node.id || e.v === node.id);
            if (connectedEdges.length !== 1) continue; // 葉ノード条件

            const edge = connectedEdges[0];
            const parentId = edge.u === node.id ? edge.v : edge.u;

            const nextNodes = this.cloneNodes(nodes).filter(n => n.id !== node.id);
            const nextEdges = this.cloneEdges(edges).filter(e => !(e.u === node.id || e.v === node.id));

            // 親ノードの色を反転（Growの逆操作）
            const parentInNext = nextNodes.find(n => n.id === parentId);
            if (parentInNext) {
                parentInNext.color = 1 - parentInNext.color;
            }

            results.push({
                nodes: nextNodes,
                edges: nextEdges
            });
        }

        return results;
    }

    // Unsplit逆操作: 白ノードB (degree=2, 直線上) を削除し A-C を直結
    // Split操作の逆: エッジu-vを分割してvのコンポーネントを(dgx,dgy)移動し、中間に白ノード挿入
    // → Unsplitでは両端A,Cを見つけ、一方のコンポーネントを(-dgx,-dgy)戻し、Bを削除、A-C直結
    tryUnsplit(nodes, edges) {
        const results = [];

        for (const nodeB of nodes) {
            if (nodeB.color !== 0) continue; // 白ノードのみ

            const connectedEdges = edges.filter(e => e.u === nodeB.id || e.v === nodeB.id);
            if (connectedEdges.length !== 2) continue; // ちょうど2本のエッジ

            const edge1 = connectedEdges[0];
            const edge2 = connectedEdges[1];

            const id1 = edge1.u === nodeB.id ? edge1.v : edge1.u;
            const id2 = edge2.u === nodeB.id ? edge2.v : edge2.u;

            const node1 = nodes.find(n => n.id === id1);
            const node2 = nodes.find(n => n.id === id2);

            // B-node1-node2 が直線上にあるか確認
            if (node1.gx + node2.gx !== nodeB.gx * 2 || node1.gy + node2.gy !== nodeB.gy * 2) continue;

            // 両方向を試す（どちらのコンポーネントを動かすか）
            for (const [nodeA, nodeC] of [[node1, node2], [node2, node1]]) {
                const aId = nodeA.id;
                const cId = nodeC.id;

                // Split逆操作: Aのコンポーネント（Bを除外）を特定
                const componentIds = getComponent(nodes, edges, aId, nodeB.id);
                
                // AのコンポーネントをB方向に戻す: dgx = B.gx - C.gx, dgy = B.gy - C.gy
                const dgx = nodeB.gx - nodeC.gx;
                const dgy = nodeB.gy - nodeC.gy;
                
                // 移動後の座標が他のノードと重ならないか確認
                const staticNodes = nodes.filter(n => !componentIds.has(n.id) && n.id !== nodeB.id);
                let collision = false;
                for (const n of nodes) {
                    if (componentIds.has(n.id)) {
                        const newGx = n.gx - dgx;
                        const newGy = n.gy - dgy;
                        // Bの位置は空くので除外
                        if (staticNodes.some(s => s.gx === newGx && s.gy === newGy)) {
                            collision = true;
                            break;
                        }
                    }
                }
                if (collision) continue;

                // 次の状態を作成
                const nextNodes = this.cloneNodes(nodes);
                
                // Aのコンポーネントを移動
                nextNodes.forEach(n => {
                    if (componentIds.has(n.id)) {
                        n.gx -= dgx;
                        n.gy -= dgy;
                    }
                });

                // Bを削除
                const finalNodes = nextNodes.filter(n => n.id !== nodeB.id);
                
                // B関連のエッジを削除し、A-Cエッジを追加
                const nextEdges = this.cloneEdges(edges)
                    .filter(e => !(e.u === nodeB.id || e.v === nodeB.id));
                nextEdges.push({ u: aId, v: cId });

                // A, C の色を反転（Splitの逆操作）
                const aInNext = finalNodes.find(n => n.id === aId);
                const cInNext = finalNodes.find(n => n.id === cId);
                aInNext.color = 1 - aInNext.color;
                cInNext.color = 1 - cInNext.color;

                results.push({
                    nodes: finalNodes,
                    edges: nextEdges
                });
            }
        }

        return results;
    }

    // ヘルパー関数

    cloneNodes(nodes) {
        return nodes.map(n => ({ ...n }));
    }

    cloneEdges(edges) {
        return edges.map(e => ({ ...e }));
    }

    // すべての可能な木構造パターンを生成
    generateAllTreePatterns(nodes) {
        if (nodes.length === 0) return [[]];
        if (nodes.length === 1) return [[]];

        const allPatterns = [];
        
        // 各ノードをルートとして試す
        for (const root of nodes) {
            const patterns = this.buildTreesFromRoot(nodes, root);
            allPatterns.push(...patterns);
        }

        // 重複を除去（エッジの組み合わせが同じものは除外）
        const uniquePatterns = [];
        const seen = new Set();

        for (const pattern of allPatterns) {
            const key = pattern
                .map(e => [e.u, e.v].sort((a, b) => a - b).join('-'))
                .sort()
                .join('|');
            
            if (!seen.has(key)) {
                seen.add(key);
                uniquePatterns.push(pattern);
            }
        }

        return uniquePatterns;
    }

    // 指定されたルートから全ての可能な木を生成（DFS）
    buildTreesFromRoot(nodes, root) {
        const results = [];
        
        const buildTree = (visited, edges) => {
            // 全ノードを訪問したら完成
            if (visited.size === nodes.length) {
                results.push([...edges]);
                return;
            }

            // 訪問済みノードに隣接する未訪問ノードを探す
            const candidates = [];
            for (const visitedId of visited) {
                const visitedNode = nodes.find(n => n.id === visitedId);
                
                for (const node of nodes) {
                    if (visited.has(node.id)) continue;
                    
                    const d = Math.abs(node.gx - visitedNode.gx) + Math.abs(node.gy - visitedNode.gy);
                    if (d === 1) {
                        candidates.push({ from: visitedId, to: node.id });
                    }
                }
            }

            // 候補がなければ木が完成できない（連結でない）
            if (candidates.length === 0) return;

            // 各候補について再帰的に木を構築
            for (const candidate of candidates) {
                const newVisited = new Set(visited);
                newVisited.add(candidate.to);
                const newEdges = [...edges, { u: candidate.from, v: candidate.to }];
                buildTree(newVisited, newEdges);
            }
        };

        const initialVisited = new Set([root.id]);
        buildTree(initialVisited, []);

        return results;
    }

    isConnected(nodes, edges) {
        if (nodes.length === 0) return false;
        if (nodes.length === 1) return true;

        const componentIds = getComponent(nodes, edges, nodes[0].id);
        return componentIds.size === nodes.length;
    }

    stateKey(nodes, edges) {
        const nodeKeys = nodes
            .map(n => `${n.gx},${n.gy},${n.color}`)
            .sort()
            .join('|');
        const edgeKeys = edges
            .map(e => [e.u, e.v].sort((a, b) => a - b).join('-'))
            .sort()
            .join('|');
        return `N:${nodeKeys}|E:${edgeKeys}`;
    }

}