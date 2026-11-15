import { test } from "node:test";
import assert from "node:assert/strict";
import { createPresenceController } from "../../packages/shared/src/presence.ts";
import { nativeHarness, deferred, tick } from "./native-harness.mjs";

const heartbeat = {
  lastSeenAt: "2026-11-15T00:00:00Z",
  heartbeatSeconds: 15,
  ttlSeconds: 60,
};
function clock() {
  let now = 0;
  const jobs = new Set();
  return {
    schedule(fn, delay) {
      const job = { fn, at: now + delay };
      jobs.add(job);
      return () => jobs.delete(job);
    },
    async advance(milliseconds) {
      const end = now + milliseconds;
      for (;;) {
        const next = [...jobs].toSorted((a, b) => a.at - b.at)[0];
        if (!next || next.at > end) break;
        now = next.at;
        jobs.delete(next);
        next.fn();
        await tick();
      }
      now = end;
      await tick();
    },
    jobs,
  };
}
test("foreground cadence is single-flight; pause/resume and cleanup never duplicate timers", async () => {
  const time = clock(),
    signals = [];
  const controller = createPresenceController({
    schedule: time.schedule,
    send: async (signal) => {
      signals.push(signal);
      return heartbeat;
    },
    unauthorized: () => false,
    onExpired() {},
  });
  controller.setActive(false);
  assert.equal(signals.length, 0);
  controller.setActive(true);
  controller.setActive(true);
  await tick();
  assert.equal(signals.length, 1);
  assert.equal(time.jobs.size, 1);
  await time.advance(14999);
  assert.equal(signals.length, 1);
  await time.advance(1);
  assert.equal(signals.length, 2);
  controller.setActive(false);
  await time.advance(60000);
  assert.equal(signals.length, 2);
  controller.setActive(true);
  await tick();
  assert.equal(signals.length, 3);
  controller.stop();
  await time.advance(60000);
  assert.equal(signals.length, 3);
  assert.equal(time.jobs.size, 0);
});
test("late old-session failures cannot expire a resumed session or change its server-configured cadence", async () => {
  const time = clock(),
    old = deferred();
  let calls = 0,
    expired = 0;
  const signals = [];
  const controller = createPresenceController({
    schedule: time.schedule,
    send: (signal) => {
      signals.push(signal);
      return ++calls === 1
        ? old.promise
        : Promise.resolve({ ...heartbeat, heartbeatSeconds: 30 });
    },
    unauthorized: (e) => e.status === 401,
    onExpired: () => expired++,
  });
  controller.setActive(true);
  await time.advance(60000);
  assert.equal(calls, 1);
  controller.setActive(false);
  assert.equal(signals[0].aborted, true);
  controller.setActive(true);
  await tick();
  assert.equal(calls, 2);
  old.reject({ status: 401 });
  await tick();
  assert.equal(expired, 0);
  await time.advance(15000);
  assert.equal(calls, 2);
  await time.advance(15000);
  assert.equal(calls, 3);
  controller.stop();
});
test("network failure retries; current 401 expires once and stops", async () => {
  const time = clock();
  let calls = 0,
    expired = 0;
  const controller = createPresenceController({
    schedule: time.schedule,
    send: async () => {
      throw { status: ++calls === 1 ? 0 : 401 };
    },
    unauthorized: (e) => e.status === 401,
    onExpired: () => expired++,
  });
  controller.setActive(true);
  await tick();
  assert.equal(expired, 0);
  await time.advance(15000);
  assert.equal(expired, 1);
  controller.setActive(true);
  await time.advance(60000);
  assert.equal(calls, 2);
  assert.equal(time.jobs.size, 0);
});

class ApiError extends Error {
  constructor(status) {
    super("synthetic");
    this.problem = { status };
  }
}
function nativeFixture(send = async () => heartbeat) {
  const time = clock(),
    requests = [],
    listeners = new Set();
  let expired = 0;
  const appState = {
    currentState: "active",
    addEventListener(_, callback) {
      listeners.add(callback);
      return { remove: () => listeners.delete(callback) };
    },
  };
  const h = nativeHarness("runtime.tsx", {
    react: { createContext: () => ({}) },
    "react-native": { AppState: appState },
    "./deviceAudio": { deviceAudio: {} },
    "./journeyState": {
      createJourneyStore: () => ({
        open: async () => {},
        clear: async () => {},
      }),
    },
    "./receptionState": {
      createReceptionStore: () => ({ clear: async () => {} }),
    },
    "expo-secure-store": {
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    },
    "@hospital/shared": {
      normalizeLocale: (x) => x,
      ApiError,
      createPresenceController: (options) =>
        createPresenceController({ ...options, schedule: time.schedule }),
      createApi: (base, token) => async (path, method, body, key, signal) => {
        const record = { token: token(), path, method, body, key, signal };
        requests.push(record);
        return send(record, requests.length);
      },
    },
  });
  return {
    ...h,
    time,
    requests,
    listeners,
    onExpired: () => expired++,
    expired: () => expired,
    state(value) {
      appState.currentState = value;
      for (const listener of listeners) listener(value);
    },
  };
}
const session = { sessionId: "one", token: "token-one" };
test("native runtime stops background heartbeat, resumes immediately and cleans up re-renders/unmount", async () => {
  const h = nativeFixture();
  const props = { session, onExpired: h.onExpired };
  h.render("NativePresence", props);
  await tick();
  h.render("NativePresence", { ...props });
  assert.equal(h.requests.length, 1);
  assert.equal(h.listeners.size, 1);
  assert.equal(h.requests[0].path, "/api/v2/presence/heartbeat");
  assert.equal(h.requests[0].body, undefined);
  assert.equal(h.requests[0].key, undefined);
  h.state("inactive");
  h.state("background");
  await h.time.advance(60000);
  assert.equal(h.requests.length, 1);
  h.state("active");
  await tick();
  assert.equal(h.requests.length, 2);
  await h.time.advance(15000);
  assert.equal(h.requests.length, 3);
  h.unmount();
  await h.time.advance(60000);
  assert.equal(h.requests.length, 3);
  assert.equal(h.listeners.size, 0);
});
test("native session storage/switch aborts the old token synchronously and ignores delayed 401", async () => {
  const old = deferred();
  const h = nativeFixture((_, count) =>
    count === 1 ? old.promise : Promise.resolve(heartbeat),
  );
  await h.exports.saveSession(session);
  h.render("NativePresence", { session, onExpired: h.onExpired });
  const next = { sessionId: "two", token: "token-two" };
  const saving = h.exports.saveSession(next);
  assert.equal(h.requests[0].signal.aborted, true);
  await saving;
  h.render("NativePresence", { session: next, onExpired: h.onExpired });
  await tick();
  old.reject(new ApiError(401));
  await tick();
  assert.equal(h.expired(), 0);
  await h.time.advance(15000);
  assert.deepEqual(
    h.requests.map((r) => r.token),
    ["token-one", "token-two", "token-two"],
  );
  const resume = h.exports.pauseNativePresence();
  await h.time.advance(30000);
  assert.equal(h.requests.length, 3);
  resume();
  await tick();
  assert.equal(h.requests.length, 4);
  h.exports.stopNativePresence();
  await h.time.advance(30000);
  assert.equal(h.requests.length, 4);
  h.unmount();
});
