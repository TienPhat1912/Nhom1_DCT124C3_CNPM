import test from "node:test";
import assert from "node:assert/strict";
import { nativeHarness, deferred, tick, find } from "./native-harness.mjs";

function clock() {
  let id = 0;
  const tasks = new Map();
  return {
    tasks,
    setTimeout: (fn, ms) => {
      tasks.set(++id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => tasks.delete(id),
    async next() {
      const [id, task] = tasks.entries().next().value ?? [];
      if (!task) return;
      tasks.delete(id);
      await task.fn();
      await tick();
    },
  };
}
function events() {
  const time = clock(),
    listeners = new Set(),
    calls = [];
  const state = {
    currentState: "active",
    addEventListener: (_, cb) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    },
  };
  const runtime = {
    locale: "en",
    session: { sessionId: "one" },
    api: async (...args) => {
      calls.push(args);
      return result;
    },
  };
  let handler = runtime.api;
  const stableApi = (...args) => handler(...args);
  Object.defineProperty(runtime, "api", {
    get: () => stableApi,
    set: (value) => {
      handler = value;
    },
  });
  let result = {
    visitId: "v1",
    cursor: "v1:9007199254740993",
    reset: true,
    pollAfterMs: 1000,
    state: { examStatus: "Waiting" },
    events: [],
  };
  let refreshes = 0;
  const refresh = () => refreshes++;
  class ApiError extends Error {
    constructor(problem) {
      super();
      this.problem = problem;
    }
  }
  const h = nativeHarness(
    "runtime.tsx",
    {
      react: { createContext: () => ({}), useContext: () => runtime },
      "@hospital/shared": { createApi: () => () => {}, ApiError },
      "./journeyState": { createJourneyStore: () => ({}) },
      "./receptionState": { createReceptionStore: () => ({}) },
      "react-native": { AppState: state },
    },
    time,
  );
  return {
    h,
    runtime,
    calls,
    time,
    ApiError,
    get refreshes() {
      return refreshes;
    },
    get result() {
      return result;
    },
    set result(value) {
      result = value;
    },
    render(id = "v1") {
      h.render("useVisitEvents", id, refresh);
    },
    change(value) {
      state.currentState = value;
      for (const cb of listeners) cb(value);
    },
    get listeners() {
      return listeners.size;
    },
  };
}

test("event cursor stays opaque; repeated/stale deliveries cannot refresh or replay history", async () => {
  const f = events();
  f.render();
  await tick();
  assert.equal(f.refreshes, 1);
  f.result = {
    ...f.result,
    reset: false,
    events: [
      { id: "old", visitId: "v1", stale: true, expiresAt: "2099-01-01" },
      { id: "expired", visitId: "v1", stale: false, expiresAt: "2000-01-01" },
      { id: "fresh", visitId: "v1", stale: false, expiresAt: "2099-01-01" },
    ],
  };
  await f.time.next();
  assert.match(f.calls.at(-1)[0], /after=v1%3A9007199254740993/);
  assert.equal(f.refreshes, 2);
  await f.time.next();
  assert.equal(f.refreshes, 2);
  f.h.unmount();
  assert.equal(f.time.tasks.size, 0);
  assert.equal(f.listeners, 0);
});

test("background aborts polling, foreground bootstraps, reconnect retries without overlapping", async () => {
  const f = events(),
    gate = deferred();
  f.runtime.api = (...args) => {
    f.calls.push(args);
    return gate.promise;
  };
  f.render();
  f.render();
  assert.equal(f.calls.length, 1);
  f.change("background");
  assert.equal(f.calls[0][4].aborted, true);
  gate.resolve(f.result);
  await tick();
  assert.equal(f.refreshes, 0);
  assert.equal(f.time.tasks.size, 0);
  f.runtime.api = async (...args) => {
    f.calls.push(args);
    return f.result;
  };
  f.change("active");
  await tick();
  assert.equal(f.calls.at(-1)[0], "/api/visits/v1/events");
  f.runtime.api = async () => {
    throw new Error("offline");
  };
  await f.time.next();
  assert.equal([...f.time.tasks.values()][0].ms, 5000);
  f.runtime.api = async (...args) => {
    f.calls.push(args);
    return f.result;
  };
  await f.time.next();
  assert.equal([...f.time.tasks.values()][0].ms, 1000);
  f.h.unmount();
});

test("session/Visit replacement cancels old responses; invalid cursor reboots", async () => {
  const f = events(),
    gate = deferred();
  f.runtime.api = (...args) => {
    f.calls.push(args);
    return gate.promise;
  };
  f.render();
  f.runtime.session = { sessionId: "two" };
  f.result = { ...f.result, visitId: "v2" };
  f.runtime.api = async (...args) => {
    f.calls.push(args);
    return f.result;
  };
  f.render("v2");
  await tick();
  const count = f.refreshes;
  gate.resolve({ ...f.result, visitId: "v1" });
  await tick();
  assert.equal(f.refreshes, count);
  assert.equal(f.calls[0][4].aborted, true);
  f.runtime.api = async () => {
    throw new f.ApiError({ title: "invalidCursor" });
  };
  await f.time.next();
  f.runtime.api = async (...args) => {
    f.calls.push(args);
    return f.result;
  };
  await f.time.next();
  assert.equal(f.calls.at(-1)[0], "/api/visits/v2/events");
  f.h.unmount();
});

function journey() {
  const time = clock(),
    calls = [],
    keys = [];
  const runtime = { locale: "en", session: { sessionId: "one" }, t: (x) => x };
  const resource = {
    stale: false,
    data: {
      id: "v1",
      version: 1,
      examStatus: "Waiting",
      journeyStatus: "Active",
      ticketNumber: "A101-007",
      currentStepId: "s1",
      steps: [
        {
          id: "s1",
          kind: "Consultation",
          text: "Approved",
          templateVersion: 1,
          destination: { room: "A101" },
          queueStatus: "Waiting",
          queueNumber: "OLD",
        },
      ],
    },
  };
  let stops = 0;
  const speech = {
    foreground: true,
    play: async (...args) => {
      calls.push(args);
    },
    stop: async () => stops++,
  };
  const h = nativeHarness(
    "Journey.tsx",
    {
      "./runtime": {
        useNative: () => runtime,
        useLoad: () => resource,
        useVisitEvents() {},
        useNarration: (key) => {
          keys.push(key);
          return speech;
        },
      },
      "@hospital/shared": { dateText: (x) => x, displayName: (d) => d.room },
      "react-native": { View: "View", Switch: "Switch" },
    },
    time,
  );
  return {
    time,
    calls,
    keys,
    runtime,
    resource,
    speech,
    get stops() {
      return stops;
    },
    h,
    render: () => h.render("Journey", { id: resource.data.id }),
  };
}

test("normal Visit polling pauses in background, rejects the aborted response and revalidates on foreground", async () => {
  const gate = deferred();
  const intervals = new Map();
  // A separate harness is needed to inject interval controls before module load.
  let state = "active",
    change,
    calls = 0,
    signal;
  const runtime = {
    locale: "en",
    session: { sessionId: "one" },
    api: async (...args) => {
      calls++;
      signal = args[4];
      return calls === 1 ? gate.promise : { version: 2 };
    },
  };
  const h = nativeHarness(
    "runtime.tsx",
    {
      react: { createContext: () => ({}), useContext: () => runtime },
      "@hospital/shared": { createApi: () => () => {} },
      "./journeyState": { createJourneyStore: () => ({}) },
      "./receptionState": { createReceptionStore: () => ({}) },
      "react-native": {
        AppState: {
          get currentState() {
            return state;
          },
          addEventListener: (_, cb) => {
            change = (value) => {
              state = value;
              cb(value);
            };
            return { remove() {} };
          },
        },
      },
    },
    {
      setInterval: (fn) => {
        intervals.set(1, fn);
        return 1;
      },
      clearInterval: (id) => intervals.delete(id),
    },
  );
  const render = () => h.render("useLoad", "/api/visits/v1", true);
  render();
  await tick();
  assert.equal(calls, 1);
  change("background");
  assert.equal(signal.aborted, true);
  assert.equal(intervals.size, 0);
  gate.resolve({ version: 1 });
  await tick();
  assert.equal(render().data, null);
  change("active");
  await tick();
  assert.equal(render().data.version, 2);
  assert.equal(intervals.size, 1);
  h.unmount();
  assert.equal(intervals.size, 0);
});

test("Journey auto/manual/dedup follows content and doctor acceptance, not Visit.Version or legacy queue", async () => {
  const f = journey();
  f.render();
  await f.time.next();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][2].ticket, "A101-007");
  const key = f.keys.at(-1);
  f.resource.data.version++;
  f.resource.data.steps[0].queueStatus = "Called";
  f.render();
  await f.time.next();
  assert.equal(f.calls.length, 1);
  assert.equal(f.keys.at(-1), key);
  f.resource.data.examStatus = "InConsultation";
  f.render();
  await f.time.next();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1][2].called, true);
  let tree = f.render();
  find(tree, (n) => n.type === "Switch").props.onValueChange(false);
  f.resource.data.steps[0].id = "s2";
  f.resource.data.currentStepId = "s2";
  tree = f.render();
  await f.time.next();
  assert.equal(f.calls.length, 2);
  assert.equal(f.stops, 1);
  find(
    tree,
    (n) => n.type === "Btn" && n.props.children === "listen",
  ).props.onPress();
  assert.equal(f.calls.length, 3);
  f.h.unmount();
});

test("stale/background content is silent; foreground uses refreshed language and step snapshot", async () => {
  const f = journey();
  f.resource.stale = true;
  f.render();
  await f.time.next();
  assert.equal(f.calls.length, 0);
  f.resource.stale = false;
  f.speech.foreground = false;
  f.render();
  await f.time.next();
  assert.equal(f.calls.length, 0);
  f.runtime.locale = "vi";
  f.speech.foreground = true;
  f.render();
  await f.time.next();
  assert.equal(f.calls[0][1].language, "vi");
  f.resource.data.examStatus = "";
  f.resource.data.steps[0].kind = "Service";
  f.resource.data.steps[0].destination.room = "LAB1";
  f.render();
  await f.time.next();
  assert.equal(f.calls.at(-1)[2].ticket, "OLD");
  assert.equal(f.calls.at(-1)[2].room, "LAB1");
  f.h.unmount();
});
