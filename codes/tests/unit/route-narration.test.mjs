import test from "node:test";
import assert from "node:assert/strict";
import { createRouteNarration } from "../../packages/shared/src/routeNarration.ts";
import { createAudioCoordinator } from "../../packages/shared/src/audioCoordinator.ts";
import { DemoPositionSource } from "../../packages/shared/src/positionSource.ts";
function fixture() {
  let time = 10000,
    id = 0;
  const timers = new Map(),
    calls = [];
  const clock = {
    now: () => time,
    setTimeout: (fn, ms) => {
      timers.set(++id, { fn, at: time + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const advance = (ms) => {
    const end = time + ms;
    for (;;) {
      const first = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > end) break;
      time = first[1].at;
      timers.delete(first[0]);
      first[1].fn();
    }
    time = end;
  };
  const graph = {
    nodes: ["a", "b"].map((id, i) => ({
      id,
      x: i * 100,
      y: 0,
      building: "A",
      floor: "0",
      spaceId: "floor:A:0",
      kind: "checkpoint",
      nameVi: id,
      nameEn: id,
    })),
    edges: [{ id: "ab", from: "a", to: "b", kind: "walk", weight: 100 }],
  };
  const source = new DemoPositionSource(graph, "simulation", {
      clock,
      originId: "a",
    }),
    audio = createAudioCoordinator(clock);
  let errors = 0;
  const guide = createRouteNarration(
    source,
    audio,
    {
      speak(snapshot, done, failed) {
        const call = { snapshot, done, failed, stopped: false };
        calls.push(call);
        return () => {
          call.stopped = true;
        };
      },
    },
    clock,
    () => errors++,
  );
  source.setTarget("b");
  return { source, audio, guide, calls, advance, errors: () => errors };
}
test("long speech waits beyond dwell; arrival is narrated once; muted guidance still advances", () => {
  const f = fixture();
  f.guide.start();
  f.advance(6000);
  assert.equal(f.source.getSnapshot().position.x, 0);
  assert.equal(f.calls.length, 1);
  f.calls[0].done();
  f.advance(5000);
  assert.equal(f.calls.length, 2);
  assert.equal(f.source.getSnapshot().status, "guidance");
  f.calls[1].done();
  f.advance(1000);
  assert.equal(f.source.getSnapshot().status, "arrived");
  assert.equal(f.calls.length, 2);
  f.guide.dispose();
  f.source.dispose();
  const m = fixture();
  m.guide.setMuted(true);
  m.guide.start();
  m.advance(7000);
  assert.equal(m.source.getSnapshot().status, "arrived");
  assert.equal(m.calls.length, 0);
  m.guide.dispose();
  m.source.dispose();
});
test("failed/silent engine falls back to text; stale speech cannot advance a replacement route", () => {
  const f = fixture();
  f.guide.start();
  const old = f.calls[0];
  f.source.setTarget("a");
  old.done();
  assert.equal(f.source.getSnapshot().status, "guidance");
  f.calls.at(-1).failed();
  f.advance(1000);
  assert.equal(f.source.getSnapshot().status, "arrived");
  assert.equal(f.errors(), 1);
  f.guide.dispose();
  f.source.dispose();
  const t = fixture();
  t.guide.start();
  t.advance(15000);
  assert.equal(t.errors(), 1);
  assert.equal(t.source.getSnapshot().status, "moving");
  assert.equal(t.audio.priority(), null);
  t.guide.dispose();
  t.source.dispose();
});
test("Journey preemption freezes motion and resumes with a fresh prompt; dispose rejects callbacks", () => {
  const f = fixture();
  f.guide.start();
  f.calls[0].done();
  f.advance(2500);
  const x = f.source.getSnapshot().position.x;
  const lease = f.audio.acquire("journey", () => {});
  assert.equal(f.source.getSnapshot().status, "paused");
  f.advance(3000);
  assert.equal(f.source.getSnapshot().position.x, x);
  lease.release();
  f.advance(0);
  assert.equal(f.source.getSnapshot().status, "guidance");
  assert.equal(f.calls.length, 2);
  f.calls[1].done();
  f.advance(1000);
  assert.equal(f.source.getSnapshot().status, "moving");
  f.guide.dispose();
  f.source.dispose();
  f.calls[1].done();
  assert.equal(f.source.getSnapshot().status, "disposed");
});

test("manual replay holds an acknowledged muted prompt without duplicating progress", () => {
  const f = fixture();
  f.guide.setMuted(true);
  f.guide.start();
  f.advance(500);
  const token = f.source.getSnapshot().guidance;
  f.guide.replay();
  f.advance(6000);
  assert.equal(f.source.getSnapshot().position.x, 0);
  assert.deepEqual(f.source.getSnapshot().guidance, token);
  f.calls[0].done();
  f.advance(6000);
  assert.equal(f.source.getSnapshot().status, "arrived");
  assert.equal(f.calls.length, 1);
  f.guide.dispose();
  f.source.dispose();
});
test("signal recovery during a priority interruption still requires explicit resume", () => {
  const f = fixture();
  f.guide.start();
  const lease = f.audio.acquire("journey", () => {});
  f.source.setSignal("unavailable");
  f.source.setSignal("available");
  lease.release();
  f.advance(10000);
  assert.equal(f.source.getSnapshot().status, "paused");
  assert.equal(f.calls.length, 1);
  f.guide.resume();
  assert.equal(f.calls.length, 2);
  f.guide.dispose();
  f.source.dispose();
});

test("priority release cannot enqueue old route speech before an unmount completes", () => {
  const f = fixture();
  f.guide.start();
  const lease = f.audio.acquire("journey", () => {});
  lease.release();
  f.guide.dispose();
  f.source.dispose();
  f.advance(1);
  assert.equal(f.calls.length, 1);
});
