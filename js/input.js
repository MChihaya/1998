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

        // ピンチズーム用
        this.lastPinchDistance = 0;
        this.isPinching = false;

        // タッチイベント用
        this.isTouchEvent = false;
        this.touchMoved = false;

        // コールバック
        this.onAction = null;
        this.onEdit = null; // 検証モード用
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
        
        // パン操作の開始
        this.isPanning = true;
        if (!this.isTouchEvent) {
            this.isDragging = false;
        }
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
            
            const totalDx = e.clientX - this.dragStartX;
            const totalDy = e.clientY - this.dragStartY;
            const distance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
            
            if (distance > this.dragThreshold) {
                if (!this.isTouchEvent) {
                    this.isDragging = true;
                }
            }
            
            this.renderer.camera.x += dx;
            this.renderer.camera.y += dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            
            const dragging = this.isTouchEvent ? this.touchMoved : this.isDragging;
            this.canvas.style.cursor = dragging ? 'grabbing' : 'default';
            return;
        }

        // 検証モード時のカーソル
        if (this.state.mode === 'verification') {
            this.canvas.style.cursor = 'cell';
            return;
        }

        // アクション判定 (Split or Grow)
        if (!this.state.isSolved) {
            this.updateHoverAction(worldPos);
            this.canvas.style.cursor = this.hoveredAction ? 'pointer' : 'grab';
        }
    }

    handleMouseUp(e) {
        // ボタンやUI要素上でのクリックは無視
        if (e.target && e.target !== this.canvas) {
            this.isPanning = false;
            this.isDragging = false;
            this.isTouchEvent = false;
            this.touchMoved = false;
            return;
        }
        
        // タッチイベントの場合はtouchMovedフラグを、マウスイベントの場合はisDraggingフラグを使う
        const wasNotDragging = this.isTouchEvent ? !this.touchMoved : !this.isDragging;
        
        if (wasNotDragging) {
            if (this.state.mode === 'verification') {
                // 検証モードのクリック処理
                const pos = this.getMousePos(e);
                const worldPos = this.renderer.screenToWorld(pos.x, pos.y);
                const gx = Math.round(worldPos.x / CONFIG.GRID_SIZE);
                const gy = Math.round(-worldPos.y / CONFIG.GRID_SIZE); // Y軸反転
                
                if (this.onEdit) this.onEdit(gx, gy);
            } else {
                // タッチイベントの場合、タップ位置でhoveredActionを更新
                if (this.isTouchEvent && !this.state.isSolved) {
                    const pos = this.getMousePos(e);
                    const worldPos = this.renderer.screenToWorld(pos.x, pos.y);
                    this.updateHoverAction(worldPos);
                }
                
                if (this.hoveredAction) {
                    if (this.onAction) this.onAction(this.hoveredAction);
                    this.hoveredAction = null;
                }
            }
        }
        
        this.isPanning = false;
        this.isDragging = false;
        this.isTouchEvent = false;
        this.touchMoved = false;
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

    _triggerMouseEvent(type, touchEvent) {
        if (touchEvent.changedTouches.length === 0) return;
        const touch = touchEvent.changedTouches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => touchEvent.preventDefault(),
            stopPropagation: () => touchEvent.stopPropagation()
        };

        if (type === 'mousedown') this.handleMouseDown(mouseEvent);
        else if (type === 'mousemove') this.handleMouseMove(mouseEvent);
        else if (type === 'mouseup') this.handleMouseUp(mouseEvent);
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            // ピンチズーム開始
            if (e.cancelable) e.preventDefault();
            this.isPinching = true;
            this.isPanning = false;
            this.isDragging = false;
            this.isTouchEvent = true;
            this.touchMoved = false;
            const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
            this.lastPinchDistance = distance;
        } else if (e.touches.length === 1) {
            if (e.cancelable) e.preventDefault();
            this.isPinching = false;
            this.isTouchEvent = true;
            this.touchMoved = false;
            this._triggerMouseEvent('mousedown', e);
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 2 && this.isPinching) {
            // ピンチズーム処理
            if (e.cancelable) e.preventDefault();
            this.touchMoved = true;
            const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
            const delta = distance - this.lastPinchDistance;
            
            // ズーム中心を2点の中心に
            const rect = this.canvas.getBoundingClientRect();
            const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
            const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
            
            const worldBefore = this.renderer.screenToWorld(centerX, centerY);
            const zoomFactor = 1 + (delta / distance) * 2;
            const newZoom = Math.max(0.1, Math.min(5.0, this.renderer.camera.zoom * zoomFactor));
            this.renderer.camera.zoom = newZoom;
            const worldAfter = this.renderer.screenToWorld(centerX, centerY);
            
            this.renderer.camera.x += (worldAfter.x - worldBefore.x) * newZoom;
            this.renderer.camera.y += (worldAfter.y - worldBefore.y) * newZoom;
            
            this.lastPinchDistance = distance;
        } else if (e.touches.length === 1 && !this.isPinching) {
            if (e.cancelable) e.preventDefault();
            this.touchMoved = true;
            this._triggerMouseEvent('mousemove', e);
        }
    }

    handleTouchEnd(e) {
        // ピンチ中でなければ通常のマウスアップ処理
        if (this.isPinching) {
            // 2本指が離れたらピンチ終了
            if (e.touches.length < 2) {
                this.isPinching = false;
                this.isDragging = false;
            }
        } else {
            // 通常のタップ/クリック処理
            if (e.touches.length === 0) {
                if (e.cancelable) e.preventDefault();
                this._triggerMouseEvent('mouseup', e);
            }
        }
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateHoverAction(worldPos) {
        const threshold = CONFIG.CLICK_THRESHOLD / this.renderer.camera.zoom;
        let minInfo = null;
        let minDist = threshold;

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

        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        this.state.nodes.forEach(node => {
            directions.forEach(([dx, dy]) => {
                const tx = node.gx + dx;
                const ty = node.gy + dy;
                
                if (this.state.nodes.some(n => n.gx === tx && n.gy === ty)) return;

                const targetVx = (tx * CONFIG.GRID_SIZE);
                const targetVy = -(ty * CONFIG.GRID_SIZE);

                const dist = this.distToSegmentRaw(worldPos, node.vx, node.vy, targetVx, targetVy);

                if (dist < minDist) {
                    minDist = dist;
                    minInfo = { type: 'grow', srcId: node.id, tx, ty };
                }
            });
        });

        this.hoveredAction = minInfo;
    }

    distToSegment(p, v, w) {
        return this.distToSegmentRaw(p, v.vx, v.vy, w.vx, w.vy);
    }

    distToSegmentRaw(p, x1, y1, x2, y2) {
        const l2 = (x1 - x2)**2 + (y1 - y2)**2;
        if (l2 === 0) return Math.hypot(p.x - x1, p.y - y1);
        let t = ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (x1 + t * (x2 - x1)), p.y - (y1 + t * (y2 - y1)));
    }
}