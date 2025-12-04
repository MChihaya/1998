export function getComponent(nodes, edges, startId, forbiddenId = -1) {
    const visited = new Set();
    const stack = [startId];
    visited.add(startId);
    
    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => {
        if (e.u !== forbiddenId && e.v !== forbiddenId) {
            adj[e.u].push(e.v);
            adj[e.v].push(e.u);
        }
    });

    while (stack.length) {
        const curr = stack.pop();
        const neighbors = adj[curr] || [];
        neighbors.forEach(next => {
            if (!visited.has(next)) {
                visited.add(next);
                stack.push(next);
            }
        });
    }
    return visited;
}

export function normalizeAndHash(nodes) {
    if (nodes.length === 0) return new Set();

    let minX = Infinity, minY = Infinity;
    nodes.forEach(n => {
        if (n.gx < minX) minX = n.gx;
        if (n.gy < minY) minY = n.gy;
    });

    const hashSet = new Set();
    nodes.forEach(n => {
        const x = n.gx - minX;
        const y = n.gy - minY;
        // 座標と色を含めて一意に識別
        hashSet.add(`${x},${y},${n.color}`);
    });
    return hashSet;
}