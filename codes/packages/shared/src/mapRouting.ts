import type {
  MapAction,
  MapEdge,
  MapGraph,
  MapLeg,
  MapNode,
  MapRoute,
} from "./mapModel.ts";

const frame = (n: MapNode) =>
  n.spaceId ?? `${n.building ?? "outside"}:${n.floor}`;
export function validMapEdge(a: MapNode, b: MapNode, e: MapEdge) {
  if (
    e.closed ||
    a.closed ||
    b.closed ||
    !Number.isFinite(e.weight) ||
    e.weight <= 0
  )
    return false;
  if (!a.spaceId || !b.spaceId) return true; // Legacy callers may supply standalone test graphs.
  if (e.kind === "walk")
    return a.spaceId === b.spaceId && (a.x === b.x || a.y === b.y);
  if (a.spaceId === b.spaceId || !e.transition) return false;
  const t = e.transition;
  if (
    t.fromSpace !== a.spaceId ||
    t.toSpace !== b.spaceId ||
    t.fromFloor !== a.floor ||
    t.toFloor !== b.floor
  )
    return false;
  if (e.kind === "elevator" || e.kind === "stairs")
    return (
      a.kind === e.kind &&
      b.kind === e.kind &&
      !!a.building &&
      a.building === b.building &&
      a.floor !== b.floor
    );
  if (e.kind !== "connector") return false;
  if (a.spaceId === "campus" || b.spaceId === "campus")
    return (
      a.floor === "0" &&
      b.floor === "0" &&
      ((a.kind === "entrance" && b.kind === "exit") ||
        (b.kind === "entrance" && a.kind === "exit"))
    );
  return (
    !!a.building &&
    !!b.building &&
    a.building !== b.building &&
    ["exit", "entrance"].includes(a.kind) &&
    ["exit", "entrance"].includes(b.kind)
  );
}

function identity(nodes: MapNode[], edges: MapEdge[]) {
  const text = JSON.stringify([
    nodes.map((n) => [n.id, frame(n), n.x, n.y]),
    edges.map((e) => [e.id ?? `${e.from}~${e.to}`, e.kind, e.weight]),
  ]);
  // Keep the canonical signature, not a short hash: stale-route guards must
  // not confuse two valid paths after a hash collision. Treat this ID as opaque.
  return `route:${text}`;
}
function turn(a: MapNode, b: MapNode, c: MapNode): MapAction {
  const x = b.x - a.x,
    y = b.y - a.y,
    u = c.x - b.x,
    v = c.y - b.y;
  const cross = x * v - y * u,
    dot = x * u + y * v;
  if (Math.abs(cross) < 1e-8) return dot < 0 ? "uturn" : "straight";
  // SVG/floor coordinates have a downward-positive Y axis.
  return cross > 0 ? "right" : "left";
}
export function routeLegs(
  nodes: MapNode[],
  edges: MapEdge[],
  routeId = identity(nodes, edges),
): MapLeg[] {
  if (!nodes.length) return [];
  const result: MapLeg[] = [];
  let i = 0;
  while (i < edges.length) {
    const start = i,
      edge = edges[i];
    let action: MapAction;
    if (edge.kind === "elevator" || edge.kind === "stairs") action = edge.kind;
    else if (edge.kind === "connector")
      action =
        nodes[i].spaceId === "campus"
          ? "enter"
          : nodes[i + 1].spaceId === "campus"
            ? "exit"
            : "transfer";
    else
      action = !i
        ? "start"
        : edges[i - 1].kind === "walk" &&
            frame(nodes[i - 1]) === frame(nodes[i])
          ? turn(nodes[i - 1], nodes[i], nodes[i + 1])
          : "straight";
    i++;
    if (edge.kind === "walk") {
      while (
        i < edges.length &&
        edges[i].kind === "walk" &&
        frame(nodes[i - 1]) === frame(nodes[i + 1]) &&
        turn(nodes[i - 1], nodes[i], nodes[i + 1]) === "straight"
      )
        i++;
    }
    result.push({
      id: `${routeId}:leg:${result.length}`,
      action,
      nodes: nodes.slice(start, i + 1),
      edges: edges.slice(start, i),
      fromSpace: frame(nodes[start]),
      toSpace: frame(nodes[i]),
      transition: edge.kind !== "walk",
    });
  }
  const last = nodes.at(-1)!;
  result.push({
    id: `${routeId}:arrive`,
    action: "arrive",
    nodes: [last],
    edges: [],
    fromSpace: frame(last),
    toSpace: frame(last),
    transition: false,
  });
  return result;
}

/** Dijkstra with a binary heap. Demo weights are not walking distances. */
export function shortestPath(
  graph: MapGraph,
  from: string,
  to: string,
): MapRoute | null {
  const available = new Map(
    graph.nodes.filter((n) => !n.closed).map((n) => [n.id, n]),
  );
  if (!available.has(from) || !available.has(to)) return null;
  const adjacent = new Map<string, Array<{ next: string; edge: MapEdge }>>();
  for (const edge of graph.edges) {
    const a = available.get(edge.from),
      b = available.get(edge.to);
    if (!a || !b || !validMapEdge(a, b, edge)) continue;
    adjacent.set(a.id, [...(adjacent.get(a.id) ?? []), { next: b.id, edge }]);
    if (!edge.oneWay)
      adjacent.set(b.id, [...(adjacent.get(b.id) ?? []), { next: a.id, edge }]);
  }
  const heap: Array<{ id: string; cost: number }> = [];
  const push = (value: { id: string; cost: number }) => {
    heap.push(value);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].cost <= value.cost) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = value;
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost)
          child++;
        if (last.cost <= heap[child].cost) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const distance = new Map([[from, 0]]),
    previous = new Map<string, { id: string; edge: MapEdge }>();
  push({ id: from, cost: 0 });
  while (heap.length) {
    const current = pop();
    if (current.cost !== distance.get(current.id)) continue;
    if (current.id === to) {
      const nodes = [available.get(to)!],
        edges: MapEdge[] = [];
      let cursor = to;
      while (cursor !== from) {
        const p = previous.get(cursor)!;
        nodes.unshift(available.get(p.id)!);
        edges.unshift(p.edge);
        cursor = p.id;
      }
      const id = identity(nodes, edges);
      return {
        id,
        nodes,
        edges,
        weight: current.cost,
        legs: routeLegs(nodes, edges, id),
      };
    }
    for (const { next, edge } of adjacent.get(current.id) ?? []) {
      const cost = current.cost + edge.weight;
      if (cost < (distance.get(next) ?? Infinity)) {
        distance.set(next, cost);
        previous.set(next, { id: current.id, edge });
        push({ id: next, cost });
      }
    }
  }
  return null;
}
