import test from "node:test";
import assert from "node:assert/strict";
import { nativeHarness, find } from "./native-harness.mjs";
import * as maps from "../../packages/shared/src/hospitalMap.ts";
import * as departments from "../../packages/shared/src/hospitalDepartments.ts";
import * as position from "../../packages/shared/src/positionSource.ts";
import { positionCopy } from "../../packages/shared/src/positionCopy.ts";
const shared = {
  ...maps,
  ...departments,
  ...position,
  positionCopy,
  routeNarrationCopy: { en: { auto: "auto" } },
  translator: () => (key) => key,
};
test("native SVG marker follows the fix coordinates and never appears in another floor frame", () => {
  const svg = Object.fromEntries(
    ["Circle", "Defs", "G", "Line", "Marker", "Path", "Rect", "Text"].map(
      (k) => [k, k],
    ),
  );
  const h = nativeHarness("FloorPlan.tsx", {
    "@hospital/shared": shared,
    "react-native": {
      ScrollView: "ScrollView",
      useWindowDimensions: () => ({ width: 400 }),
    },
    "react-native-svg": { __esModule: true, default: "Svg", ...svg },
  });
  const c = new position.DemoPositionSource(maps.hospitalMap, "simulation", {
    originId: "room-A101",
  });
  const props = {
    graph: maps.hospitalMap,
    spaceId: "floor:A:1",
    route: null,
    from: "",
    target: "room-A101",
    locale: "en",
    zoom: 1,
    onChoose() {},
    onBuilding() {},
    position: c.getSnapshot().position,
  };
  let tree = h.render("FloorPlan", props);
  const marker = find(
    tree,
    (n) => n.type === "G" && n.props.accessibilityLabel === "RTLS demo",
  );
  assert.ok(marker);
  const point = find(marker, (n) => n.type === "Circle");
  assert.equal(point.props.cx, props.position.x);
  assert.equal(point.props.cy, props.position.y);
  tree = h.render("FloorPlan", { ...props, spaceId: "floor:B:2" });
  assert.equal(
    find(
      tree,
      (n) => n.type === "G" && n.props.accessibilityLabel === "RTLS demo",
    ),
    undefined,
  );
  c.dispose();
  h.unmount();
});
function clockFixture() {
  let time = 10000,
    id = 0;
  const timers = new Map(),
    history = [];
  const clock = {
    now: () => time,
    setTimeout: (fn, ms) => {
      timers.set(++id, { fn, at: time + ms });
      history.push(fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  return {
    clock,
    timers,
    history,
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const first = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > end) break;
        time = first[1].at;
        timers.delete(first[0]);
        first[1].fn();
      }
      time = end;
    },
  };
}
test("native hook binds AppState, requires resume after foreground and disposes all timers/subscriptions", () => {
  const f = clockFixture(),
    listeners = new Set();
  let removed = 0;
  class Source extends position.DemoPositionSource {
    constructor(graph) {
      super(graph, "simulation", { clock: f.clock });
    }
  }
  const h = nativeHarness("usePositionDemo.ts", {
    "@hospital/shared": { ...shared, DemoPositionSource: Source },
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: (_, fn) => {
          listeners.add(fn);
          return {
            remove() {
              listeners.delete(fn);
              removed++;
            },
          };
        },
      },
    },
  });
  const render = () =>
    h.render("usePositionDemo", maps.hospitalMap, "room-B201");
  render();
  render();
  let result = render();
  const c = result.controller;
  c.start();
  c.continue(c.getSnapshot().guidance);
  f.advance(2000);
  for (const fn of listeners) fn("background");
  const p = c.getSnapshot().position;
  f.advance(30000);
  assert.equal(c.getSnapshot().status, "paused");
  assert.deepEqual(c.getSnapshot().position, p);
  assert.equal(f.timers.size, 0);
  for (const fn of listeners) fn("active");
  assert.equal(c.getSnapshot().status, "paused");
  c.resume();
  c.continue(c.getSnapshot().guidance);
  f.advance(1500);
  assert.notEqual(c.getSnapshot().position.y, p.y);
  h.unmount();
  assert.equal(c.getSnapshot().status, "disposed");
  assert.equal(f.timers.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(removed, 1);
  f.history.forEach((fn) => fn());
  assert.equal(f.timers.size, 0);
});
test("native simulation UI uses live position/frame and shared controls for same/different floor/building", () => {
  for (const origin of ["room-B202", "lobby-b", "room-A101"]) {
    const f = clockFixture(),
      c = new position.DemoPositionSource(maps.hospitalMap, "simulation", {
        clock: f.clock,
        originId: origin,
      });
    c.setTarget("room-B201");
    const h = nativeHarness("SimulationMap.tsx", {
      "@hospital/shared": shared,
      "./FloorPlan": { FloorPlan: "FloorPlan" },
      "./usePositionDemo": {
        usePositionDemo: () => ({ controller: c, snapshot: c.getSnapshot() }),
      },
    });
    const render = () =>
      h.render("SimulationMap", {
        graph: maps.hospitalMap,
        targetId: "room-B201",
        locale: "en",
      });
    let tree = render();
    assert.equal(
      find(tree, (n) => n.type === "FloorPlan").props.position.nodeId,
      origin,
    );
    find(
      tree,
      (n) => n.type === "Btn" && n.props.children === "Start / resume",
    ).props.onPress();
    f.advance(2500);
    tree = render();
    assert.equal(
      find(tree, (n) => n.type === "FloorPlan").props.spaceId,
      c.getSnapshot().position.spaceId,
    );
    find(
      tree,
      (n) => n.type === "Btn" && n.props.children === "Lose signal",
    ).props.onPress();
    assert.equal(c.getSnapshot().status, "lost");
    tree = render();
    find(
      tree,
      (n) => n.type === "Btn" && n.props.children === "Restore signal",
    ).props.onPress();
    assert.equal(c.getSnapshot().status, "paused");
    tree = render();
    find(
      tree,
      (n) => n.type === "Btn" && n.props.children === "Reset simulation",
    ).props.onPress();
    assert.equal(c.getSnapshot().position.nodeId, "gate-1");
    tree = render();
    const oldRouteIds = new Set(c.getSnapshot().route.nodes.map((n) => n.id));
    find(
      tree,
      (n) => n.type === "Btn" && n.props.children === "Try deviation",
    ).props.onPress();
    assert.equal(oldRouteIds.has(c.getSnapshot().position.nodeId), false);
    assert.ok(
      maps.hospitalMap.nodes.some(
        (n) => n.id === c.getSnapshot().position.nodeId,
      ),
    );
    c.dispose();
    h.unmount();
  }
});
test("native default mode is simulation; manual remains selectable and new accounts start fresh", () => {
  const runtime = { locale: "en", config: { departments: [], locations: [] } };
  const h = nativeHarness("HospitalMap.tsx", {
    "@hospital/shared": shared,
    "react-native": {
      View: "View",
      Pressable: "Pressable",
      StyleSheet: { create: (x) => x },
    },
    "./runtime": { useNative: () => runtime },
    "./FloorPlan": { FloorPlan: "FloorPlan" },
    "./useRouteSpeech": { useRouteSpeech: () => ({ stop() {} }) },
  });
  const props = { destination: { ...maps.mappedJourneyRooms[0] } };
  let tree = h.render("MapPanel", props);
  assert.ok(find(tree, (n) => n.type === "SimulationMap"));
  find(
    tree,
    (n) => n.type === "Choice" && n.props.label === "Manual",
  ).props.onPress();
  tree = h.render("MapPanel", props);
  assert.ok(find(tree, (n) => n.type === h.exports.ManualMapPanel));
  assert.equal(
    find(tree, (n) => n.type === "SimulationMap"),
    undefined,
  );
  const a = new position.DemoPositionSource(maps.hospitalMap);
  a.setOrigin("room-B201");
  a.dispose();
  const b = new position.DemoPositionSource(maps.hospitalMap);
  assert.equal(b.getSnapshot().position.nodeId, "gate-1");
  assert.notEqual(
    a.getSnapshot().position.sessionId,
    b.getSnapshot().position.sessionId,
  );
  b.dispose();
  h.unmount();
});
