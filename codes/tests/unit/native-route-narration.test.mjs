import test from "node:test";
import assert from "node:assert/strict";
import {
  nativeHarness,
  loadNative,
  tick,
  deferred,
} from "./native-harness.mjs";
import * as maps from "../../packages/shared/src/hospitalMap.ts";
import * as locales from "../../packages/shared/src/locales.ts";
import { createRouteNarration } from "../../packages/shared/src/routeNarration.ts";
import { createAudioCoordinator } from "../../packages/shared/src/audioCoordinator.ts";
import { DemoPositionSource } from "../../packages/shared/src/positionSource.ts";
function fixture(origin = "gate-1", target = "room-B201", autoplay = true) {
  let time = 10000,
    id = 0;
  const timers = new Map(),
    calls = [],
    listeners = new Set();
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
  const audio = createAudioCoordinator(clock),
    shared = { ...maps, ...locales, createRouteNarration };
  const speech = {
    stop: async () => {},
    getAvailableVoicesAsync: async () => [
      { language: "en-US", identifier: "en" },
    ],
    speak: (text, options) => calls.push({ text, options }),
  };
  const modules = {
    "@hospital/shared": shared,
    "./deviceAudio": { deviceAudio: audio },
    "expo-speech": speech,
  };
  const globals = {
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  };
  const adapter = loadNative("routeSpeechAdapter.ts", modules, globals);
  const c = new DemoPositionSource(maps.hospitalMap, "simulation", {
    clock,
    originId: origin,
  });
  c.setTarget(target);
  const h = nativeHarness(
    "useRouteNarration.ts",
    {
      ...modules,
      "./routeSpeechAdapter": adapter,
      "react-native": {
        AppState: {
          currentState: "active",
          addEventListener: (_, fn) => {
            listeners.add(fn);
            return { remove: () => listeners.delete(fn) };
          },
        },
      },
    },
    globals,
  );
  const render = (locale = "en", labelsReady = true) =>
    h.render("useRouteNarration", c, locale, autoplay, labelsReady);
  render();
  return {
    c,
    h,
    calls,
    audio,
    advance,
    timers,
    speech,
    adapter,
    render,
    listeners,
  };
}
test("native Expo adapter and hook narrate same/cross-floor/cross-building legs before moving and arrive once", async () => {
  for (const origin of ["room-B202", "lobby-b", "room-A101"]) {
    const f = fixture(origin),
      legs = f.c.getSnapshot().route.legs;
    for (const leg of legs) {
      await tick();
      const call = f.calls.at(-1);
      assert.ok(call);
      assert.equal(f.c.getSnapshot().status, "guidance");
      assert.equal(f.c.getSnapshot().position.spaceId, leg.fromSpace);
      call.options.onDone();
      f.advance(1000);
      if (leg.action !== "arrive") f.advance(5000);
    }
    assert.equal(f.c.getSnapshot().status, "arrived");
    assert.equal(f.calls.length, legs.length);
    assert.equal(f.c.getSnapshot().position.nodeId, "room-B201");
    f.h.unmount();
    f.c.dispose();
    assert.equal(f.timers.size, 0);
  }
});
test("native muted source moves without speech; background cancels voice and requires explicit resume", async () => {
  const muted = fixture("room-B202", "room-B201", false);
  await tick();
  muted.advance(40000);
  assert.equal(muted.calls.length, 0);
  assert.equal(muted.c.getSnapshot().status, "arrived");
  muted.h.unmount();
  muted.c.dispose();
  const f = fixture();
  await tick();
  const old = f.calls[0];
  for (const listener of f.listeners) listener("background");
  assert.equal(f.c.getSnapshot().status, "paused");
  old.options.onDone();
  f.advance(30000);
  assert.equal(f.c.getSnapshot().status, "paused");
  assert.equal(f.calls.length, 1);
  for (const listener of f.listeners) listener("active");
  assert.equal(f.c.getSnapshot().status, "paused");
  f.render().start();
  await tick();
  assert.equal(f.calls.length, 2);
  f.h.unmount();
  f.c.dispose();
});
test("native pending voices are invalidated by destination change, timeout and disposal", async () => {
  const f = fixture();
  const wait = deferred();
  f.speech.getAvailableVoicesAsync = () => wait.promise;
  await tick();
  f.c.setTarget("room-A101");
  wait.resolve([{ language: "en-US", identifier: "en" }]);
  await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.c.getSnapshot().route.nodes.at(-1).id, "room-A101");
  f.advance(15000);
  assert.equal(f.render().error, true);
  assert.equal(f.c.getSnapshot().status, "moving");
  const last = f.calls[0];
  f.h.unmount();
  f.c.dispose();
  last.options.onDone();
  await tick();
  assert.equal(f.timers.size, 0);
});

test("native locale waits for matching config labels and preserves the current position session", async () => {
  const f = fixture();
  await tick();
  f.calls[0].options.onDone();
  f.advance(3000);
  const before = f.c.getSnapshot().position;
  f.render("vi", false);
  f.advance(5000);
  assert.equal(f.calls.length, 1);
  assert.equal(f.c.getSnapshot().position.x, before.x);
  assert.equal(f.c.getSnapshot().position.y, before.y);
  f.speech.getAvailableVoicesAsync = async () => [
    { language: "vi-VN", identifier: "vi" },
  ];
  f.render("vi", true);
  await tick();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].options.language, "vi-VN");
  assert.equal(f.c.getSnapshot().position.sessionId, before.sessionId);
  f.calls[0].options.onDone();
  f.advance(1000);
  assert.equal(f.c.getSnapshot().status, "guidance");
  f.calls[1].options.onDone();
  f.advance(1000);
  assert.equal(f.c.getSnapshot().status, "moving");
  f.h.unmount();
  f.c.dispose();
});
