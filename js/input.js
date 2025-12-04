import { CONFIG } from './constants.js';

export class InputHandler {
    constructor(canvas, renderer, state) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.state = state;
        
        this.hoveredAction = null; // { type: 'split'|'grow', ... }
        
        this.isPanning = false;
        this.isDragging = false; // ドラッグ中かどうか
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.dragThreshold = 5; // ドラッグと判定する最小移動距離（ピクセル）
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        if (this.state.isSolved) return;
        const pos = this.getMousePos(e);
        
        // パン操作の開始
        this.isPanning = true;
        this.isDragging = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        const worldPos = this.renderer.screenToWorld(pos.x, pos.y);

        if (this.isPanning) {
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            
            // ドラッグ判定：最初の位置から一定距離以上移動したらドラッグとみなす
            const totalDx = e.clientX - this.dragStartX;
            const totalDy = e.clientY - this.dragStartY;
            const distance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
            
            if (distance > this.dragThreshold) {
                this.isDragging = true;
            }
            
            this.renderer.camera.x += dx;
            this.renderer.camera.y += dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            
            // ドラッグ中はカーソルをつかんでいる状態に
            this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'default';
            return;
        }

        // アクション判定 (Split or Grow)
        if (!this.state.isSolved) {
            this.updateHoverAction(worldPos);
            this.canvas.style.cursor = this.hoveredAction ? 'pointer' : 'grab';
        }
    }

    handleMouseUp(e) {
        // ドラッグしていなかった場合のみアクションを実行
        if (this.isPanning && !this.isDragging && this.hoveredAction) {
            this.onAction(this.hoveredAction);
            this.hoveredAction = null;
        }
        
        this.isPanning = false;
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const newZoom = Math.max(0.1, Math.min(5.0, this.renderer.camera.zoom - e.deltaY * zoomSpeed));
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldBefore = this.renderer.screenToWorld(mouseX, mouseY);
        this.renderer.camera.zoom = newZoom;
        const worldAfter = this.renderer.screenToWorld(mouseX, mouseY);

        this.renderer.camera.x += (worldAfter.x - worldBefore.x) * newZoom;
        this.renderer.camera.y += (worldAfter.y - worldBefore.y) * newZoom;
    }

    // 最も近いアクションを探す
    updateHoverAction(worldPos) {
        const threshold = CONFIG.CLICK_THRESHOLD / this.renderer.camera.zoom;
        let minInfo = null;
        let minDist = threshold;

        // 1. Split (既存のエッジ上にあるか)
        this.state.edges.forEach((edge, i) => {
            const u = this.state.nodes.find(n => n.id === edge.u);
            const v = this.state.nodes.find(n => n.id === edge.v);
            if (!u || !v) return;

            const dist = this.distToSegment(worldPos, u, v);
            if (dist < minDist) {
                minDist = dist;
                minInfo = { type: 'split', edgeIndex: i, uId: u.id, vId: v.id };
            }
        });

        // 2. Grow (ノードから空きマスへの仮想エッジ上にあるか)
        // 全ノードに対し、上下左右の空きマスへの「線分」との距離を測る
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        this.state.nodes.forEach(node => {
            directions.forEach(([dx, dy]) => {
                const tx = node.gx + dx;
                const ty = node.gy + dy;
                
                // すでにノードがある場所へはGrowできない
                if (this.state.nodes.some(n => n.gx === tx && n.gy === ty)) return;

                // ノード中心から、隣のグリッド中心への線分
                // アニメーション中のノード位置(vx,vy)を使う
                const targetVx = (tx * CONFIG.GRID_SIZE);
                const targetVy = -(ty * CONFIG.GRID_SIZE);

                // 簡易的に線分として判定
                // (node.vx, node.vy) -> (targetVx, targetVy)
                const dist = this.distToSegmentRaw(worldPos, node.vx, node.vy, targetVx, targetVy);

                if (dist < minDist) {
                    minDist = dist;
                    minInfo = { type: 'grow', srcId: node.id, tx, ty };
                }
            });
        });

        this.hoveredAction = minInfo;
    }

    // ノードオブジェクト間の距離
    distToSegment(p, v, w) {
        return this.distToSegmentRaw(p, v.vx, v.vy, w.vx, w.vy);
    }

    // 座標間の距離
    distToSegmentRaw(p, x1, y1, x2, y2) {
        const l2 = (x1 - x2)**2 + (y1 - y2)**2;
        if (l2 === 0) return Math.hypot(p.x - x1, p.y - y1);
        let t = ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (x1 + t * (x2 - x1)), p.y - (y1 + t * (y2 - y1)));
    }
}