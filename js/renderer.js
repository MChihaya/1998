import { CONFIG, PALETTES } from './constants.js';

export class Renderer {
    constructor(canvas, targetCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.targetCanvas = targetCanvas;
        this.targetCtx = targetCanvas ? targetCanvas.getContext('2d') : null;

        this.width = canvas.width;
        this.height = canvas.height;
        this.camera = { x: 0, y: 0, zoom: 1.0 };
        this.palette = PALETTES.light;

        this.targetVisualNodes = new Map();
        this.skipTargetAnimation = false;
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    setTheme(themeName) {
        this.palette = PALETTES[themeName] || PALETTES.light;
    }

    centerCamera() {
        this.camera.x = this.width / 2;
        this.camera.y = this.height / 2;
        this.camera.zoom = 1.0;
    }

    resetTargetView(immediate = false) {
        this.targetVisualNodes.clear();
        this.skipTargetAnimation = immediate;
    }

    gridToWorld(gx, gy) {
        return { x: gx * CONFIG.GRID_SIZE, y: -gy * CONFIG.GRID_SIZE };
    }
    worldToScreen(wx, wy) {
        return {
            x: wx * this.camera.zoom + this.camera.x,
            y: wy * this.camera.zoom + this.camera.y
        };
    }
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.camera.x) / this.camera.zoom,
            y: (sy - this.camera.y) / this.camera.zoom
        };
    }

    updateAnimations(nodes) {
        nodes.forEach(n => {
            const target = this.gridToWorld(n.gx, n.gy);
            n.vx += (target.x - n.vx) * CONFIG.ANIMATION_SPEED;
            n.vy += (target.y - n.vy) * CONFIG.ANIMATION_SPEED;
        });
    }

    draw(state, inputState) { 
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawGrid();

        const { nodes, edges } = state;
        const { hoveredAction } = inputState;

        this.ctx.lineWidth = 3 * this.camera.zoom;
        edges.forEach((e, i) => {
            const n1 = nodes.find(n => n.id === e.u);
            const n2 = nodes.find(n => n.id === e.v);
            if (!n1 || !n2) return;

            const p1 = this.worldToScreen(n1.vx, n1.vy);
            const p2 = this.worldToScreen(n2.vx, n2.vy);
            
            const isHovered = hoveredAction && hoveredAction.type === 'split' && hoveredAction.edgeIndex === i;
            this.ctx.strokeStyle = isHovered ? this.palette.edgeHighlight : this.palette.edge;
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();

            if (isHovered) {
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                this.drawGhostNode(midX, midY);
            }
        });

        if (hoveredAction && hoveredAction.type === 'grow') {
            const src = nodes.find(n => n.id === hoveredAction.srcId);
            if (src) {
                const pSrc = this.worldToScreen(src.vx, src.vy);
                const tWorld = this.gridToWorld(hoveredAction.tx, hoveredAction.ty);
                const pTarget = this.worldToScreen(tWorld.x, tWorld.y);

                this.ctx.beginPath();
                this.ctx.moveTo(pSrc.x, pSrc.y);
                this.ctx.lineTo(pTarget.x, pTarget.y);
                this.ctx.strokeStyle = this.palette.previewLine;
                this.ctx.lineWidth = 2 * this.camera.zoom;
                this.ctx.setLineDash([6, 6]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                this.drawGhostNode(pTarget.x, pTarget.y);
            }
        }

        nodes.forEach(n => {
            const p = this.worldToScreen(n.vx, n.vy);
            const r = CONFIG.NODE_RADIUS * this.camera.zoom;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            this.ctx.fillStyle = n.color === 0 ? this.palette.node0 : this.palette.node1;
            this.ctx.fill();
            this.ctx.lineWidth = 2 * this.camera.zoom;
            this.ctx.strokeStyle = this.palette.nodeBorder;
            this.ctx.stroke();
        });

        if (state.mode === 'challenge' && state.targetGraph) {
            const currentStep = state.getCurrentTargetStep();
            const finalGraph = state.getFinalTargetGraph();
            
            const showEdges = state.isSolved || state.isGivenUp;

            if (currentStep && finalGraph) {
                this.drawTargetWindow(currentStep, finalGraph, showEdges);
            }
        }
    }

    drawGhostNode(x, y) {
        const r = CONFIG.NODE_RADIUS * this.camera.zoom;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = this.palette.ghostNode;
        this.ctx.fill();
        this.ctx.strokeStyle = this.palette.ghostBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawPoint(x, y, r, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    drawGrid() {
        const startW = this.screenToWorld(0, 0);
        const endW = this.screenToWorld(this.width, this.height);
        const gs = CONFIG.GRID_SIZE;
        
        const minGx = Math.floor(Math.min(startW.x, endW.x) / gs);
        const maxGx = Math.ceil(Math.max(startW.x, endW.x) / gs);
        const minGy = Math.floor(Math.min(-startW.y, -endW.y) / gs);
        const maxGy = Math.ceil(Math.max(-startW.y, -endW.y) / gs);

        this.ctx.strokeStyle = this.palette.grid;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        for (let gx = minGx; gx <= maxGx; gx++) {
            const w = this.gridToWorld(gx, 0);
            const s = this.worldToScreen(w.x, 0);
            this.ctx.moveTo(s.x, 0);
            this.ctx.lineTo(s.x, this.height);
        }
        for (let gy = minGy; gy <= maxGy; gy++) {
            const w = this.gridToWorld(0, gy);
            const s = this.worldToScreen(0, w.y);
            this.ctx.moveTo(0, s.y);
            this.ctx.lineTo(this.width, s.y);
        }
        this.ctx.stroke();

        const origin = this.worldToScreen(0, 0);
        this.ctx.strokeStyle = this.palette.originAxis;
        this.ctx.beginPath();
        this.ctx.moveTo(origin.x, 0); this.ctx.lineTo(origin.x, this.height);
        this.ctx.moveTo(0, origin.y); this.ctx.lineTo(this.width, origin.y);
        this.ctx.stroke();
    }

    // 問題ウィンドウの描画
    drawTargetWindow(stepData, finalData, showEdges) {
        if (!this.targetCtx) return;
        const w = this.targetCanvas.width;
        const h = this.targetCanvas.height;
        const ctx = this.targetCtx;

        ctx.clearRect(0, 0, w, h);
        
        const nodes = stepData.nodes;
        const edges = stepData.edges;
        
        const refNodes = finalData.nodes;
        if (refNodes.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        refNodes.forEach(n => {
            if (n.gx < minX) minX = n.gx;
            if (n.gx > maxX) maxX = n.gx;
            if (n.gy < minY) minY = n.gy;
            if (n.gy > maxY) maxY = n.gy;
        });

        // --- レイアウト修正 ---
        
        // 画面幅が600未満(スマホ)かどうか判定
        const isMobile = window.innerWidth < 600;

        // 内部座標系(240px)におけるパディング設定
        // スマホの場合: 画面上で小さく表示されるため、相対的に余白を大きく確保する (32px)
        // PCの場合: 20pxで十分
        const screenPadding = isMobile ? 32 : 20;

        // グリッドのサイズ計算
        const gridWidth = Math.max(1, maxX - minX);
        const gridHeight = Math.max(1, maxY - minY);

        // 描画可能エリア
        const availW = w - screenPadding * 2;
        const availH = h - screenPadding * 2;

        const scaleX = availW / gridWidth;
        const scaleY = availH / gridHeight;
        let scale = Math.min(scaleX, scaleY);
        
        // 1. ノードが大きくなりすぎないように見た目のためのキャップ
        if (scale > 50) scale = 50; 
        
        // 2. ノードが見切れないための安全キャップ
        // 半径(scale*0.25) が screenPadding を超えないように制限する
        // 安全率を見て screenPadding の3倍程度まで許容
        const maxSafeScale = screenPadding * 3.0;
        if (scale > maxSafeScale) scale = maxSafeScale;

        const dynamicRadius = Math.max(3, scale * 0.25);
        const dynamicLineWidth = Math.max(1, dynamicRadius * 0.4);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const getScreenPos = (gx, gy) => {
            const relX = gx - centerX;
            const relY = -(gy - centerY);
            return {
                x: w / 2 + relX * scale,
                y: h / 2 + relY * scale
            };
        };

        const currentIds = new Set(nodes.map(n => n.id));
        for (const id of this.targetVisualNodes.keys()) {
            if (!currentIds.has(id)) {
                this.targetVisualNodes.delete(id);
            }
        }

        nodes.forEach(n => {
            if (!this.targetVisualNodes.has(n.id)) {
                let spawnGx = n.gx;
                let spawnGy = n.gy;
                
                if (!this.skipTargetAnimation) {
                    const neighbors = [];
                    edges.forEach(e => {
                        if (e.u === n.id) neighbors.push(e.v);
                        if (e.v === n.id) neighbors.push(e.u);
                    });

                    let sumGx = 0, sumGy = 0, count = 0;
                    neighbors.forEach(nid => {
                        const vNeighbor = this.targetVisualNodes.get(nid);
                        if (vNeighbor) {
                            sumGx += vNeighbor.gx;
                            sumGy += vNeighbor.gy;
                            count++;
                        }
                    });

                    if (count > 0) {
                        spawnGx = sumGx / count;
                        spawnGy = sumGy / count;
                    }
                }

                this.targetVisualNodes.set(n.id, { gx: spawnGx, gy: spawnGy });
            }

            const visual = this.targetVisualNodes.get(n.id);
            visual.gx += (n.gx - visual.gx) * CONFIG.ANIMATION_SPEED;
            visual.gy += (n.gy - visual.gy) * CONFIG.ANIMATION_SPEED;
        });
        
        this.skipTargetAnimation = false;

        if (showEdges) {
            ctx.lineWidth = dynamicLineWidth;
            ctx.strokeStyle = this.palette.edge;
            
            edges.forEach(e => {
                const n1 = nodes.find(n => n.id === e.u);
                const n2 = nodes.find(n => n.id === e.v);
                if (n1 && n2) {
                    const v1 = this.targetVisualNodes.get(n1.id) || n1;
                    const v2 = this.targetVisualNodes.get(n2.id) || n2;

                    const p1 = getScreenPos(v1.gx, v1.gy);
                    const p2 = getScreenPos(v2.gx, v2.gy);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });
        }

        nodes.forEach(n => {
            const visual = this.targetVisualNodes.get(n.id) || n;
            const p = getScreenPos(visual.gx, visual.gy);

            ctx.beginPath();
            ctx.arc(p.x, p.y, dynamicRadius, 0, Math.PI * 2);
            ctx.fillStyle = n.color === 0 ? this.palette.node0 : this.palette.node1;
            ctx.fill();
            ctx.lineWidth = dynamicLineWidth;
            ctx.strokeStyle = this.palette.nodeBorder;
            ctx.stroke();
        });
    }
}