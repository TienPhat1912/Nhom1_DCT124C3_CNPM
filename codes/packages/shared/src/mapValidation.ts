import type { MapGraph, MapNode, MapRect, MapWall } from "./mapModel.ts";
import { validMapEdge } from "./mapRouting.ts";
import { mapBuildings } from "./hospitalLayout.ts";

const eps = 1e-7;
function inRect(p: Pick<MapNode, "x" | "y">, r: MapRect) {
  return (
    p.x >= r.x - eps &&
    p.x <= r.x + r.width + eps &&
    p.y >= r.y - eps &&
    p.y <= r.y + r.height + eps
  );
}
function covered(a: MapNode, b: MapNode, rects: MapRect[]) {
  // Exact interval union on an axis-aligned edge; sampling could miss a thin wall.
  const horizontal = a.y === b.y;
  const start = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
  const end = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
  const ranges = rects
    .filter((r) =>
      horizontal
        ? a.y >= r.y - eps && a.y <= r.y + r.height + eps
        : a.x >= r.x - eps && a.x <= r.x + r.width + eps,
    )
    .map((r) => (horizontal ? [r.x, r.x + r.width] : [r.y, r.y + r.height]))
    .sort((a, b) => a[0] - b[0]);
  let reached = start;
  for (const [left, right] of ranges) {
    if (right < reached - eps) continue;
    if (left > reached + eps) return false;
    reached = Math.max(reached, right);
    if (reached >= end - eps) return true;
  }
  return false;
}
function crossesWall(a: MapNode, b: MapNode, w: MapWall) {
  const minX = Math.min(a.x, b.x),
    maxX = Math.max(a.x, b.x),
    minY = Math.min(a.y, b.y),
    maxY = Math.max(a.y, b.y);
  return (
    Math.max(minX, Math.min(w.x1, w.x2)) <=
      Math.min(maxX, Math.max(w.x1, w.x2)) + eps &&
    Math.max(minY, Math.min(w.y1, w.y2)) <=
      Math.min(maxY, Math.max(w.y1, w.y2)) + eps
  );
}

/** Structural/geometric diagnostics for the published demo dataset, never fixes coordinates. */
export function validateHospitalMap(graph: MapGraph): string[] {
  const errors: string[] = [],
    nodes = new Map<string, MapNode>(),
    edgeIds = new Set<string>();
  const spaces = new Map(graph.spaces?.map((s) => [s.id, s]));
  for (const n of graph.nodes) {
    if (nodes.has(n.id)) errors.push(`Duplicate node: ${n.id}`);
    nodes.set(n.id, n);
    const space = spaces.get(n.spaceId ?? "");
    if (
      !space ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      n.x < 0 ||
      n.y < 0 ||
      n.x > space.width ||
      n.y > space.height
    )
      errors.push(`Invalid coordinate frame: ${n.id}`);
    if (space && (space.floor !== n.floor || space.building !== n.building))
      errors.push(`Inconsistent frame: ${n.id}`);
  }
  if (spaces.size !== graph.spaces?.length)
    errors.push("Duplicate coordinate frame");
  for (const s of graph.spaces ?? []) {
    for (const r of s.rooms) {
      const room = nodes.get(r.nodeId),
        door = nodes.get(r.doorId);
      if (
        !room ||
        !door ||
        room.spaceId !== s.id ||
        door.spaceId !== s.id ||
        door.kind !== "door" ||
        !inRect(room, r) ||
        !inRect(door, r)
      )
        errors.push(`Invalid room/door: ${r.nodeId}`);
      if (
        !graph.edges.some(
          (e) =>
            (e.from === r.nodeId && e.to === r.doorId) ||
            (e.to === r.nodeId && e.from === r.doorId),
        )
      )
        errors.push(`Room lacks door access: ${r.nodeId}`);
    }
  }
  for (const e of graph.edges) {
    if (!e.id || edgeIds.has(e.id)) errors.push(`Invalid edge ID: ${e.id}`);
    if (e.id) edgeIds.add(e.id);
    const a = nodes.get(e.from),
      b = nodes.get(e.to);
    if (!a || !b) {
      errors.push(`Unknown endpoint: ${e.id}`);
      continue;
    }
    if (
      !validMapEdge(
        { ...a, closed: false },
        { ...b, closed: false },
        { ...e, closed: false },
      )
    ) {
      errors.push(`Invalid connection: ${e.id}`);
      continue;
    }
    if (e.kind !== "walk") continue;
    const space = spaces.get(a.spaceId!);
    if (!space) continue;
    const access = [
      ...space.rooms,
      ...space.cores.map((core) => ({
        ...core,
        doorId: `door-${core.nodeId}`,
      })),
    ].find(
      (r) =>
        (r.nodeId === a.id && r.doorId === b.id) ||
        (r.nodeId === b.id && r.doorId === a.id),
    );
    if (
      e.zone === "room-access"
        ? !access || !inRect(a, access) || !inRect(b, access)
        : !covered(a, b, space.corridors)
    )
      errors.push(`Edge leaves walkable geometry: ${e.id}`);
    if (
      [
        ...space.walls,
        ...space.rooms.flatMap((r) => r.walls),
        ...space.cores.flatMap((r) => r.walls),
      ].some((w) => crossesWall(a, b, w))
    )
      errors.push(`Edge crosses a wall: ${e.id}`);
    if (space.kind === "campus") {
      for (const rect of mapBuildings) {
        const inner = {
          x: rect.x + eps * 10,
          y: rect.y + eps * 10,
          width: rect.width - eps * 20,
          height: rect.height - eps * 20,
        };
        if (
          (a.y === b.y &&
            a.y > inner.y &&
            a.y < inner.y + inner.height &&
            Math.max(a.x, b.x) > inner.x &&
            Math.min(a.x, b.x) < inner.x + inner.width) ||
          (a.x === b.x &&
            a.x > inner.x &&
            a.x < inner.x + inner.width &&
            Math.max(a.y, b.y) > inner.y &&
            Math.min(a.y, b.y) < inner.y + inner.height)
        )
          errors.push(`Campus edge crosses building: ${e.id}`);
      }
    }
  }
  return errors;
}
