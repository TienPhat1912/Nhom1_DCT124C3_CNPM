import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hospitalMap,
  destinationNode,
  shortestPath,
  startNodes,
  buildingFloors,
  routeInstructions,
} from "../../packages/shared/src/hospitalMap.ts";

const node = (id) => ({
  id,
  x: 0,
  y: 0,
  floor: "1",
  nameVi: id,
  nameEn: id,
  kind: "checkpoint",
});
const edge = (from, to, weight, extra = {}) => ({
  from,
  to,
  weight,
  kind: "walk",
  ...extra,
});
const graph = {
  nodes: ["a", "b", "c", "d", "isolated"].map(node),
  edges: [
    edge("a", "d", 20),
    edge("a", "b", 2),
    edge("b", "c", 2),
    edge("c", "d", 2),
    edge("c", "a", 10),
  ],
};
test("weighted shortest path prefers lower total cost over fewer checkpoints, in both directions", () => {
  assert.deepEqual(
    shortestPath(graph, "a", "d").nodes.map((n) => n.id),
    ["a", "b", "c", "d"],
  );
  assert.equal(shortestPath(graph, "a", "d").weight, 6);
  assert.deepEqual(
    shortestPath(graph, "d", "a").nodes.map((n) => n.id),
    ["d", "c", "b", "a"],
  );
});
test("same position, disconnected and unknown endpoints", () => {
  assert.deepEqual(shortestPath(graph, "a", "a"), {
    nodes: [graph.nodes[0]],
    edges: [],
    weight: 0,
  });
  assert.equal(shortestPath(graph, "a", "isolated"), null);
  assert.equal(shortestPath(graph, "missing", "a"), null);
  assert.equal(shortestPath(graph, "missing", "missing"), null);
});
test("closed nodes and edges, invalid weights and directed edges cannot create shortcuts", () => {
  const blocked = {
    nodes: [node("a"), node("b"), { ...node("c"), closed: true }],
    edges: [
      edge("a", "b", 1, { closed: true }),
      edge("a", "b", -1),
      edge("a", "b", NaN),
      edge("a", "b", Infinity),
      edge("a", "b", 0),
      edge("a", "c", 1),
      edge("c", "b", 1),
      edge("b", "a", 5, { oneWay: true }),
    ],
  };
  assert.equal(shortestPath(blocked, "a", "b"), null);
  assert.equal(shortestPath(blocked, "b", "a").weight, 5);
  assert.equal(shortestPath(blocked, "c", "c"), null);
});
test("ticket destination matches building, floor and room, never just location ID", () => {
  const ticket = {
    id: "example",
    nameVi: "",
    nameEn: "",
    building: "B",
    floor: "2",
    room: "B201",
  };
  assert.equal(destinationNode(ticket).id, "room-B201");
  assert.equal(destinationNode({ ...ticket, room: " b201 " }).id, "room-B201");
  assert.equal(destinationNode({ ...ticket, building: "A" }), undefined);
  assert.equal(destinationNode({ ...ticket, floor: "1" }), undefined);
  assert.equal(destinationNode({ ...ticket, room: "B999" }), undefined);
  assert.equal(destinationNode({ ...ticket, room: "B202" }).id, "room-B202");
});
test("building/floor selection excludes other floors and outside selection excludes indoor nodes", () => {
  assert.deepEqual(buildingFloors("B"), ["1", "2"]);
  assert.deepEqual(buildingFloors("unknown"), []);
  assert.ok(startNodes("outside", "").some((n) => n.id === "gate-1"));
  assert.ok(startNodes("outside", "").every((n) => !n.building));
  assert.ok(startNodes("B", "2").some((n) => n.id === "room-B201"));
  assert.ok(
    startNodes("B", "2").every((n) => n.building === "B" && n.floor === "2"),
  );
  assert.deepEqual(startNodes("B", ""), []);
  assert.deepEqual(startNodes("", ""), []);
});
test("unique room nodes, valid corridors, explicit lifts and bilingual narration for transfers", () => {
  const { nodes, edges } = hospitalMap;
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
  const rooms = nodes.filter((n) => n.kind === "room");
  assert.equal(
    new Set(rooms.map((n) => [n.building, n.floor, n.room].join(":"))).size,
    rooms.length,
  );
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.from),
      b = nodes.find((n) => n.id === e.to);
    assert.ok(a && b);
    assert.ok(e.weight > 0 && Number.isFinite(e.weight));
    if (a.floor !== b.floor) {
      assert.equal(e.kind, "elevator");
      assert.equal(a.kind, "elevator");
      assert.equal(b.kind, "elevator");
      assert.equal(a.x, b.x);
      assert.equal(a.y, b.y);
    }
  }
  const route = shortestPath(hospitalMap, "gate-1", "room-B201");
  assert.equal(route.edges.filter((e) => e.kind === "elevator").length, 1);
  assert.ok(
    routeInstructions(route, "vi").some((s) =>
      s.includes("từ tầng 1 đến tầng 2"),
    ),
  );
  assert.ok(
    routeInstructions(route, "en").some((s) =>
      s.includes("from floor 1 to floor 2"),
    ),
  );
  assert.match(routeInstructions(route, "vi").at(-1), /B201/);
  assert.equal(
    shortestPath(hospitalMap, "room-B201", "room-B202").edges.filter(
      (e) => e.kind === "elevator",
    ).length,
    0,
  );
});
test("all fixed checkpoint pairs are connected and match independent Bellman-Ford costs", () => {
  for (const start of hospitalMap.nodes) {
    const distances = new Map(
      hospitalMap.nodes.map((n) => [n.id, n.id === start.id ? 0 : Infinity]),
    );
    for (let i = 1; i < hospitalMap.nodes.length; i++)
      for (const e of hospitalMap.edges) {
        distances.set(
          e.to,
          Math.min(distances.get(e.to), distances.get(e.from) + e.weight),
        );
        distances.set(
          e.from,
          Math.min(distances.get(e.from), distances.get(e.to) + e.weight),
        );
      }
    for (const target of hospitalMap.nodes) {
      const route = shortestPath(hospitalMap, start.id, target.id);
      assert.ok(route, `${start.id} -> ${target.id}`);
      assert.ok(Math.abs(route.weight - distances.get(target.id)) < 1e-8);
      assert.equal(
        new Set(route.nodes.map((n) => n.id)).size,
        route.nodes.length,
      );
    }
  }
});
