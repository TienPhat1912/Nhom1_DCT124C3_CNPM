import test from "node:test";
import assert from "node:assert/strict";
import {
  DemoPositionSource,
  positionDemoConfig,
} from "../../packages/shared/src/positionSource.ts";
import { hospitalMap } from "../../packages/shared/src/hospitalMap.ts";
import { routeLanguage } from "../../packages/shared/src/hospitalMap.ts";
import { positionCopy } from "../../packages/shared/src/positionCopy.ts";

export class FakeClock {
  time = 100000;
  next = 0;
  timers = new Map();
  history = [];
  now = () => this.time;
  setTimeout = (fn, ms) => {
    const id = ++this.next;
    this.timers.set(id, { fn, at: this.time + ms });
    this.history.push(fn);
    return id;
  };
  clearTimeout = (id) => this.timers.delete(id);
  advance(ms) {
    const end = this.time + ms;
    for (;;) {
      const first = [...this.timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > end) break;
      this.time = Math.max(this.time, first[1].at);
      this.timers.delete(first[0]);
      first[1].fn();
    }
    this.time = end;
  }
}
const node = (id, x, y, spaceId = "floor:A:0") => ({
  id,
  x,
  y,
  spaceId,
  building: "A",
  floor: "0",
  kind: "checkpoint",
  nameVi: id,
  nameEn: id,
});
const graph = {
  nodes: [
    node("a", 0, 0),
    node("b", 50, 0),
    node("c", 100, 0),
    node("d", 100, 100),
    node("e", 110, 100),
  ],
  edges: [
    ["a", "b", 50],
    ["b", "c", 50],
    ["c", "d", 100],
    ["d", "e", 10],
  ].map(([from, to, weight]) => ({
    id: from + to,
    from,
    to,
    weight,
    kind: "walk",
  })),
};
function fixture(source = "simulation", g = graph, originId = "a") {
  const clock = new FakeClock(),
    controller = new DemoPositionSource(g, source, { clock, originId });
  const events = [];
  controller.subscribe((s, e) => events.push({ s, e }));
  controller.setTarget(g === graph ? "e" : "room-B201");
  return { clock, c: controller, events, s: () => controller.getSnapshot() };
}
function ack(f) {
  f.c.start();
  assert.equal(f.c.continue(f.s().guidance), true);
}

test("5 seconds per merged leg, no corner cutting, guidance before turning, heartbeat while waiting", () => {
  const f = fixture();
  ack(f);
  f.clock.advance(999);
  assert.equal(f.s().status, "guidance");
  f.clock.advance(1);
  assert.equal(f.s().status, "moving");
  f.clock.advance(2500);
  assert.equal(f.s().position.x, 50);
  assert.equal(f.s().position.y, 0);
  f.clock.advance(2500);
  assert.equal(f.s().status, "guidance");
  assert.equal(f.s().position.x, 100);
  assert.equal(f.s().position.y, 0);
  assert.equal(f.s().route.legs[f.s().legIndex].action, "right");
  const timestamp = f.s().position.timestamp;
  f.clock.advance(10000);
  assert.equal(f.s().position.timestamp, timestamp + 10000);
  assert.equal(f.s().position.y, 0);
  assert.equal(f.events.filter((e) => e.e === "guidance").length, 2);
  ack(f);
  f.clock.advance(2500);
  assert.equal(f.s().position.x, 100);
  assert.equal(f.s().position.y, 50);
});
test("late acknowledgements and old token revisions cannot advance after pause/resume", () => {
  const f = fixture(),
    old = f.s().guidance;
  ack(f);
  f.clock.advance(3000);
  const p = f.s().position;
  f.c.pause();
  f.clock.advance(20000);
  assert.equal(f.s().position.x, p.x);
  assert.equal(f.clock.timers.size, 0);
  f.c.resume();
  assert.notEqual(f.s().guidance.revision, old.revision);
  assert.equal(f.c.continue(old), false);
  f.clock.advance(6000);
  assert.equal(f.s().position.x, p.x);
  ack(f);
  f.clock.advance(3000);
  assert.equal(f.s().status, "guidance");
  assert.equal(f.s().position.x, 100);
});
test("reset/origin changes start isolated sessions; old timer and prompt are rejected", () => {
  const f = fixture();
  ack(f);
  const old = f.s().guidance,
    session = f.s().position.sessionId,
    callbacks = [...f.clock.history];
  f.c.setOrigin("d");
  assert.notEqual(f.s().position.sessionId, session);
  assert.equal(f.s().position.nodeId, "d");
  callbacks.forEach((fn) => fn());
  assert.equal(f.s().position.nodeId, "d");
  assert.equal(f.c.continue(old), false);
  f.c.reset("a");
  assert.equal(f.s().position.nodeId, "a");
  assert.equal(positionDemoConfig.defaultNodeId, "gate-1");
});
test("manual source shares fix/lifecycle contract but never advances or starts movement timers", () => {
  const f = fixture("manual");
  f.c.start();
  f.clock.advance(30000);
  assert.equal(f.s().position.nodeId, "a");
  assert.equal(f.clock.timers.size, 0);
  f.c.setOrigin("d");
  assert.equal(f.s().position.nodeId, "d");
  assert.equal(f.s().position.source, "manual");
  assert.equal(f.c.continue({}), false);
  f.c.dispose();
  assert.equal(f.s().status, "disposed");
});
test("loss/stale stop immediately; recovery needs explicit resume and never catches up", () => {
  for (const signal of ["unavailable", "stale"]) {
    const f = fixture();
    ack(f);
    f.clock.advance(2500);
    f.c.setSignal(signal);
    const p = f.s().position;
    f.clock.advance(60000);
    assert.deepEqual(f.s().position, p);
    assert.equal(f.clock.timers.size, 0);
    f.c.setSignal("available");
    assert.equal(f.s().status, "paused");
    f.clock.advance(60000);
    assert.equal(f.s().position.x, p.x);
    f.c.resume();
    ack(f);
    f.clock.advance(1000);
    assert.equal(f.s().position.x, p.x);
    f.clock.advance(1000);
    assert.ok(f.s().position.x > p.x);
  }
});
test("suspended event loop marks fix stale rather than applying a large delta", () => {
  const f = fixture();
  ack(f);
  f.clock.advance(1500);
  const p = f.s().position;
  f.clock.time += 10000;
  f.clock.advance(0);
  assert.equal(f.s().status, "stale");
  assert.equal(f.s().position.x, p.x);
  assert.equal(f.clock.timers.size, 0);
});
test("retargeting between edges preserves exact position, including repeated rerouting and one-way direction", () => {
  const f = fixture();
  ack(f);
  f.clock.advance(2250);
  const x = f.s().position.x,
    old = f.s().guidance;
  f.c.setTarget("a");
  assert.equal(f.s().position.x, x);
  assert.equal(f.s().route.nodes[0].x, x);
  assert.equal(f.c.continue(old ?? {}), false);
  ack(f);
  f.clock.advance(2000);
  const x2 = f.s().position.x;
  assert.ok(x2 < x);
  f.c.setTarget("e");
  assert.equal(f.s().route.nodes[0].x, x2);
  assert.equal(f.s().position.x, x2);
  const directed = {
    ...graph,
    edges: graph.edges.map((e) => ({ ...e, oneWay: true })),
  };
  const d = fixture("simulation", directed);
  d.c.setTarget("e");
  ack(d);
  d.clock.advance(2500);
  d.c.setTarget("a");
  assert.equal(d.s().status, "no-route");
});
test("same/cross-floor/cross-building legs use separate transitions, end dwell and a single arrival", () => {
  for (const [from, to] of [
    ["room-B202", "room-B201"],
    ["lobby-b", "room-B201"],
    ["room-A101", "room-B201"],
  ]) {
    const f = fixture("simulation", hospitalMap, from);
    f.c.setTarget(to);
    const initial = f.s().route;
    for (let i = 0; i < initial.legs.length; i++) {
      const leg = f.s().route.legs[f.s().legIndex];
      const start = f.s().position;
      ack(f);
      f.clock.advance(1000);
      if (leg.action === "arrive") break;
      f.clock.advance(2500);
      if (leg.transition) assert.equal(f.s().position.spaceId, start.spaceId);
      f.clock.advance(2500);
      assert.equal(f.s().position.spaceId, leg.toSpace);
      assert.equal(f.s().status, "guidance");
    }
    assert.equal(f.s().status, "arrived");
    assert.equal(f.s().position.nodeId, to);
    f.c.pause();
    f.c.resume();
    f.clock.advance(2000);
    assert.equal(f.events.filter((e) => e.e === "arrived").length, 1);
    f.c.dispose();
  }
});
test("disposal/unsubscription and reentrant listeners cannot leak old ticks or update a new session", () => {
  const f = fixture();
  ack(f);
  const callbacks = [...f.clock.history];
  f.c.dispose();
  const count = f.events.length;
  callbacks.forEach((fn) => fn());
  f.c.start();
  f.c.reset("a");
  f.c.setTarget("e");
  assert.equal(f.events.length, count);
  assert.equal(f.clock.timers.size, 0);
  const g = fixture();
  let called = 0;
  const off = g.c.subscribe(() => called++);
  off();
  g.c.subscribe(() => g.c.dispose());
  g.c.subscribe((s) => {
    assert.equal(s.status, "disposed");
    called++;
  });
  g.c.start();
  g.clock.advance(50);
  assert.equal(called, 1);
  assert.equal(g.clock.timers.size, 0);
});
test("invalid config/origin and absent destinations do not create positions or false routes", () => {
  assert.throws(
    () => new DemoPositionSource(graph, "simulation", { originId: "missing" }),
  );
  assert.throws(
    () =>
      new DemoPositionSource(graph, "simulation", {
        originId: "a",
        config: { tickMs: 0 },
      }),
  );
  const f = fixture();
  const p = f.s().position;
  assert.throws(() => f.c.setOrigin("unknown"));
  assert.equal(f.s().position, p);
  f.c.setTarget("missing");
  assert.equal(f.s().status, "no-route");
  assert.equal(f.s().guidance, null);
});

test("starting after a long idle refreshes timestamps without a false signal loss", () => {
  const f = fixture();
  f.clock.advance(20000);
  f.c.start();
  f.clock.advance(50);
  assert.equal(f.s().status, "guidance");
  assert.equal(f.s().position.availability, "available");
  assert.equal(f.s().position.timestamp, f.clock.now());
  f.c.dispose();
});
test("six languages cover simulation controls and temporary reroute origins", () => {
  const f = fixture();
  ack(f);
  f.clock.advance(2500);
  f.c.setTarget("e");
  for (const locale of ["vi", "en", "zh", "ko", "ja", "ru"]) {
    assert.deepEqual(
      Object.keys(positionCopy[locale]),
      Object.keys(positionCopy.vi),
    );
    assert.ok(Object.values(positionCopy[locale]).every((text) => text.trim()));
  }
  const clock = new FakeClock(),
    c = new DemoPositionSource(hospitalMap, "simulation", { clock });
  c.setTarget("room-B201");
  c.start();
  c.continue(c.getSnapshot().guidance);
  clock.advance(2500);
  c.setTarget("room-A101");
  for (const locale of ["vi", "en", "zh", "ko", "ja", "ru"])
    assert.equal(routeLanguage(c.getSnapshot().route, locale), locale);
  c.dispose();
  f.c.dispose();
});
