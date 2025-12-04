export const CONFIG = {
    GRID_SIZE: 50,
    NODE_RADIUS: 8,
    TARGET_NODE_RADIUS: 14, // 正解ウィンドウのノードサイズ
    ANIMATION_SPEED: 0.25,
    CLICK_THRESHOLD: 18, // クリック判定（Split/Grow）の許容範囲
    HIT_RADIUS: 25
};

export const PALETTES = {
    light: {
        grid: '#e0e0e0',
        originAxis: '#ccc',
        node0: '#ffffff',
        node1: '#333333',
        nodeBorder: '#333333',
        edge: '#333333',
        edgeHighlight: '#ff9800',
        previewLine: '#ff9800', // プレビュー用の色
        ghostNode: 'rgba(255, 255, 255, 0.6)', // 変更: 白色の半透明
        ghostBorder: '#333333', // 変更: 白背景でも見やすい濃いグレー
    },
    dark: {
        grid: '#3c4043',
        originAxis: '#5f6368',
        node0: '#ffffff',
        node1: '#000000',
        nodeBorder: '#ffffff',
        edge: '#aaaaaa',
        edgeHighlight: '#ffca28',
        previewLine: '#ffca28',
        ghostNode: 'rgba(255, 255, 255, 0.5)', // 変更: 白色の半透明
        ghostBorder: '#ffffff', // 変更: 白
    }
};