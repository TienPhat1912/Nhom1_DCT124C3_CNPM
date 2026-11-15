import test from "node:test";
import assert from "node:assert/strict";
import { createAudioCoordinator } from "../../packages/shared/src/audioCoordinator.ts";

function fixture() {
  const timers = new Map();
  let id = 0;
  const coordinator = createAudioCoordinator({
    setTimeout: (callback, ms) => {
      timers.set(++id, { callback, ms });
      return id;
    },
    clearTimeout: (timer) => timers.delete(timer),
  });
  return { coordinator, timers };
}

test("Journey preempts route, and a route cannot interrupt an active call", () => {
  const { coordinator: c, timers } = fixture();
  let stopped = 0;
  const route = c.acquire("route", () => stopped++);
  const call = c.acquire("journey", () => stopped++);
  assert.equal(stopped, 1);
  assert.equal(route.valid(), false);
  assert.equal(call.valid(), true);
  assert.equal(
    c.acquire("route", () => stopped++),
    null,
  );
  assert.equal(stopped, 1);
  assert.equal(timers.size, 1);
  call.release();
  assert.equal(c.priority(), null);
  assert.ok(c.acquire("route", () => stopped++));
  c.dispose();
  assert.equal(timers.size, 0);
});

test("late release and timeout callbacks cannot release a new owner's audio", () => {
  const { coordinator: c, timers } = fixture();
  const old = c.acquire("route", () => {});
  const oldTimeout = [...timers.values()][0].callback;
  const call = c.acquire("journey", () => {});
  old.release();
  oldTimeout();
  assert.equal(call.valid(), true);
  call.release();
  assert.equal(timers.size, 0);
});

test("silent engine timeout returns ownership once and removes timer", () => {
  const { coordinator: c, timers } = fixture();
  let cancelled = 0,
    notifications = 0;
  const unsubscribe = c.subscribe(() => notifications++);
  const lease = c.acquire("journey", () => cancelled++, 45000);
  const timer = [...timers.values()][0];
  assert.equal(timer.ms, 45000);
  timer.callback();
  timer.callback();
  lease.release();
  assert.equal(cancelled, 1);
  assert.equal(notifications, 2);
  assert.equal(lease.valid(), false);
  assert.equal(timers.size, 0);
  unsubscribe();
  c.dispose();
});

test("cancellation may release its own lease without affecting the replacement", () => {
  const { coordinator: c } = fixture();
  let old;
  old = c.acquire("route", () => old.release());
  const current = c.acquire("journey", () => {});
  assert.equal(current.valid(), true);
  assert.equal(c.priority(), "journey");
  c.dispose();
});

test("engine or subscriber exceptions cannot strand ownership or timers", () => {
  const { coordinator: c, timers } = fixture();
  let notifications = 0;
  c.subscribe(() => {
    throw new Error("Unmounted UI");
  });
  c.subscribe(() => notifications++);
  c.acquire("route", () => {
    throw new Error("Engine stop failed");
  });
  const call = c.acquire("journey", () => {});
  assert.equal(call.valid(), true);
  call.release();
  assert.equal(notifications, 3);
  assert.equal(timers.size, 0);
});
