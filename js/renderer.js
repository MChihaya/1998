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

        // --- メインキャンバス描画 ---

        // 1. エッジ
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
                this.drawPoint(midX, midY, 4, this.palette.edgeHighlight);
            }
        });

        // 2. Growプレビュー
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

        // 3. ノード
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

        // --- ターゲットウィンドウ更新 ---
        if (state.mode === 'challenge' && state.targetGraph) {
            const currentStep = state.getCurrentTargetStep();
            const finalGraph = state.getFinalTargetGraph();
            
            // エッジを表示するかどうか：正解したか、ギブアップした時のみtrue
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

    // 正解ウィンドウ描画
    // showEdgesがfalseならエッジを描画しない
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

        const margin = 1.5; 
        const widthG = (maxX - minX) + margin * 2;
        const heightG = (maxY - minY) + margin * 2;

        const scaleX = w / widthG;
        const scaleY = h / heightG;
        let scale = Math.min(scaleX, scaleY);
        if (scale > 50) scale = 50; 

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

        // 1. エッジ描画 (showEdgesがtrueの場合のみ)
        if (showEdges) {
            ctx.lineWidth = dynamicLineWidth;
            ctx.strokeStyle = this.palette.edge;
            
            edges.forEach(e => {
                const n1 = nodes.find(n => n.id === e.u);
                const n2 = nodes.find(n => n.id === e.v);
                if (n1 && n2) {
                    const p1 = getScreenPos(n1.gx, n1.gy);
                    const p2 = getScreenPos(n2.gx, n2.gy);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });
        }

        // 2. ノード描画
        nodes.forEach(n => {
            const p = getScreenPos(n.gx, n.gy);
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