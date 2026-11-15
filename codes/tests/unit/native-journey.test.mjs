import test from "node:test";
import assert from "node:assert/strict";
import {
  all,
  deferred,
  find,
  loadNative,
  nativeHarness,
  tick,
} from "./native-harness.mjs";

const state = loadNative("journeyState.ts");
const reception = loadNative("receptionState.ts");
const session = {
  sessionId: "one",
  role: "Patient",
  token: "secret-token",
  expiresAt: "2099-01-01T00:00:00Z",
};
const path = "/api/visits/visit?language=en";
const snapshot = (version, examStatus = "Waiting") => ({
  path,
  data: { id: "visit", version, examStatus },
  updatedAt: "2026-11-15T01:00:00Z",
});
function memory() {
  const values = new Map();
  const storage = {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      assert.ok(
        Buffer.byteLength(value) < 2048,
        "SecureStore entry must fit multibyte content",
      );
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  };
  return { values, storage, store: state.createJourneyStore(storage) };
}
const settle = async () => {
  for (let i = 0; i < 30; i++) await tick();
};
const plain = (value) => JSON.parse(JSON.stringify(value));

for (const kind of ["Guest", "Account"])
  test(`${kind} restart restores encrypted snapshot, rejects rollback and clears at session boundary`, async () => {
    const m = memory();
    const s = { ...session, isGuest: kind === "Guest" };
    await m.store.open(s);
    const saved = snapshot(20, "InService");
    saved.data.instructions = "病院\u{1f3e5}説明".repeat(1000);
    await m.store.save(s.sessionId, saved);
    assert.equal(
      [...m.values.values()].some((raw) => raw.includes("secret-token")),
      false,
    );
    const restart = state.createJourneyStore(m.storage);
    assert.equal((await restart.readSession()).sessionId, s.sessionId);
    await restart.open(s);
    assert.deepEqual(plain(await restart.read(s.sessionId, path)), saved);
    await restart.save(s.sessionId, snapshot(1));
    assert.equal((await restart.read(s.sessionId, path)).data.version, 20);
    await restart.clear();
    await restart.open({ ...s, sessionId: "two" });
    await restart.save("one", snapshot(100));
    assert.equal(await restart.read("one", path), null);
    assert.equal(await restart.read("two", path), null);
    await restart.clear();
    assert.equal(m.values.size, 0);
  });

test("interrupted bank write keeps the last committed snapshot across process death", async () => {
  const m = memory();
  await m.store.open(session);
  await m.store.save("one", snapshot(4));
  const write = m.storage.setItemAsync;
  m.storage.setItemAsync = async (key, value) => {
    if (/\.\d\.0$/.test(key)) throw new Error("Device storage interrupted");
    return write(key, value);
  };
  await assert.rejects(m.store.save("one", snapshot(5)));
  const restarted = state.createJourneyStore(m.storage);
  m.storage.setItemAsync = write;
  await restarted.open(session);
  assert.equal((await restarted.read("one", path)).data.version, 4);
  await restarted.clear();
  assert.equal(m.values.size, 0);
});

test("logout queued behind an in-flight write removes its chunks and rejects late writes", async () => {
  const m = memory();
  await m.store.open(session);
  const write = m.storage.setItemAsync,
    gate = deferred();
  let blocked = false;
  m.storage.setItemAsync = async (key, value) => {
    if (!blocked) {
      blocked = true;
      await gate.promise;
    }
    return write(key, value);
  };
  const saving = m.store.save("one", snapshot(10));
  await tick();
  const clearing = m.store.clear();
  const late = m.store.save("one", snapshot(11));
  gate.resolve();
  await Promise.all([saving, clearing, late]);
  assert.equal(m.values.size, 0);
});

class ApiError extends Error {
  constructor(problem) {
    super(problem.title);
    this.problem = problem;
  }
}
const shared = {
  ApiError,
  normalizeLocale: (x) => x,
  translator: () => (key) => key,
  dateText: (x) => x,
  displayName: (d) => d.nameVi,
  qrToken: (x) => x,
};
function runtimeHarness({
  api = async () => snapshot(1).data,
  memory: m = memory(),
} = {}) {
  let listener;
  const context = { session, locale: "en", api };
  const h = nativeHarness("runtime.tsx", {
    react: { createContext: () => ({}), useContext: () => context },
    "@hospital/shared": { ...shared, createApi: () => api },
    "expo-secure-store": m.storage,
    "./journeyState": state,
    "./receptionState": reception,
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: (_, cb) => {
          listener = cb;
          return { remove() {} };
        },
      },
    },
  });
  return {
    ...h,
    context,
    memory: m,
    foreground: () => listener("active"),
    resource: () => h.render("useLoad", path, true, true),
  };
}

test("native useLoad keeps data stale on loss, remounts cache, and rejects delayed/lower versions", async () => {
  let data = snapshot(10, "InConsultation").data,
    failure = false,
    slow = null;
  const api = async () => {
    if (slow) return slow.promise;
    if (failure) throw new ApiError({ status: 0 });
    return data;
  };
  const h = runtimeHarness({ api });
  await h.exports.saveSession(session);
  h.resource();
  await settle();
  let r = h.resource();
  assert.equal(r.data.version, 10);
  assert.equal(r.stale, false);
  failure = true;
  h.foreground();
  await settle();
  assert.equal(h.resource().data.version, 10);
  assert.ok(h.resource().error);
  h.unmount();
  const restart = runtimeHarness({ api, memory: h.memory });
  await restart.exports.restoreSession();
  restart.resource();
  await settle();
  assert.equal(restart.resource().data.examStatus, "InConsultation");
  assert.equal(restart.resource().stale, true);
  failure = false;
  data = snapshot(1).data;
  restart.foreground();
  await settle();
  assert.equal(restart.resource().data.version, 10);
  slow = deferred();
  const delayed = slow;
  restart.foreground();
  slow = null;
  data = snapshot(11, "InService").data;
  restart.foreground();
  await settle();
  delayed.resolve(snapshot(2).data);
  await settle();
  assert.equal(restart.resource().data.version, 11);
  assert.equal(restart.resource().stale, false);
  restart.unmount();
});

for (const status of [0, 401, 403])
  test(`restart handles API status ${status} without treating auth denial as offline permission`, async () => {
    const m = memory();
    await m.store.open(session);
    await m.store.save("one", snapshot(2));
    await m.storage.setItemAsync("hospital.token", session.token);
    const h = runtimeHarness({
      memory: m,
      api: async () => {
        throw new ApiError({ status });
      },
    });
    if (status === 0)
      assert.equal((await h.exports.restoreSession()).sessionId, "one");
    else {
      await assert.rejects(h.exports.restoreSession());
      assert.equal(await h.exports.journeyStore.readSession(), null);
      assert.equal(m.values.has("hospital.token"), false);
    }
  });

test("expired cached session cannot reopen offline records", async () => {
  const m = memory();
  await m.store.open({ ...session, expiresAt: "2000-01-01T00:00:00Z" });
  await m.storage.setItemAsync("hospital.token", session.token);
  const h = runtimeHarness({
    memory: m,
    api: async () => {
      throw new ApiError({ status: 0 });
    },
  });
  await assert.rejects(h.exports.restoreSession());
  assert.equal(await h.exports.journeyStore.readSession(), null);
});

test("Journey renders all four exam states separately and keeps service/return destinations and ticket", () => {
  const makeStep = (id, kind, room, status = "Ready") => ({
    id,
    kind,
    status,
    destination: { nameVi: room, room },
    queueNumber: "OTHER",
    canCompleteGuidance: true,
  });
  let visit;
  const runtime = {
    ...shared,
    t: (key) => key,
    locale: "en",
    api: async () => {},
    session,
  };
  const h = nativeHarness("Journey.tsx", {
    "@hospital/shared": shared,
    "./runtime": {
      useNative: () => runtime,
      useLoad: () => ({ data: visit }),
      useAction: () => ({}),
      useNarration: () => ({}),
      useVisitEvents: () => {},
    },
  });
  const props = { id: "visit", onHelp() {}, onResults() {}, onDirections() {} };
  let steps = [makeStep("initial", "Consultation", "A101")];
  const stages = [
    "Waiting",
    "InConsultation",
    "InService",
    "Waiting",
    "InConsultation",
    "InService",
    "Waiting",
    "InConsultation",
    "Completed",
  ];
  for (const status of stages) {
    if (status === "InService" || (status === "Waiting" && steps.length > 1)) {
      steps = [
        ...steps.map((s) => ({ ...s, status: "Completed" })),
        makeStep(
          `s${steps.length}`,
          status === "InService" ? "Service" : "ReturnConsultation",
          status === "InService" ? "LAB" : "A101",
        ),
      ];
    }
    if (status === "Completed")
      steps = [
        ...steps.map((s) => ({ ...s, status: "Completed" })),
        makeStep("cashier", "Settlement", "CASHIER"),
      ];
    visit = {
      id: "visit",
      examStatus: status,
      status: "Active",
      journeyStatus: "Active",
      ticketNumber: "A101-007",
      steps,
      currentStepId: steps.at(-1).id,
    };
    const tree = h.render("Journey", props),
      json = all(tree, (n) => n.type === "Txt")
        .map((n) => JSON.stringify(n.props.children))
        .join(" ");
    assert.ok(
      find(tree, (n) => n.type === "Badge" && n.props.value === status),
    );
    assert.ok(
      json.includes("examStatus") &&
        json.includes("visitStatus") &&
        json.includes("journeyStatus"),
    );
    assert.equal(
      all(
        tree,
        (n) =>
          n.type === "Btn" &&
          /activate|completeJourney|linkAccount/.test(n.props.children),
      ).length,
      0,
    );
    const destination = find(tree, (n) => n.type === "DestinationBlock");
    assert.equal(
      destination.props.destination.room,
      steps.at(-1).destination.room,
    );
    assert.ok(json.includes("A101-007"));
    assert.ok(!json.includes("OTHER"));
    for (const label of ["listen", "navigate", "help"])
      assert.ok(
        find(tree, (n) => n.type === "Btn" && n.props.children === label),
      );
  }
  visit = {
    ...visit,
    status: "Closed",
    journeyStatus: "Completed",
    currentStepId: null,
    steps: steps.map((s) => ({ ...s, status: "Completed" })),
  };
  const done = h.render("Journey", props);
  assert.ok(
    find(done, (n) => n.type === "Btn" && n.props.children === "results"),
  );
  assert.equal(
    all(done, (n) => n.type === "Badge" && n.props.value === "Completed")
      .length,
    steps.length + 2,
  );
  assert.equal(
    find(done, (n) => n.type === "DestinationBlock"),
    undefined,
  );
});

test("authorization denial hides and discards a previously cached Journey", async () => {
  let denied = false;
  const h = runtimeHarness({
    api: async () => {
      if (denied) throw new ApiError({ status: 403 });
      return snapshot(10).data;
    },
  });
  await h.exports.saveSession(session);
  h.resource();
  await settle();
  assert.equal(h.resource().data.version, 10);
  denied = true;
  h.foreground();
  await settle();
  assert.equal(h.resource().data, null);
  assert.equal(await h.exports.journeyStore.read("one", path), null);
  h.unmount();
});

test("native language change cannot restore lower aggregate versions from network or cache", async () => {
  let data = snapshot(10, "InConsultation").data;
  const h = runtimeHarness({ api: async () => data });
  await h.exports.saveSession(session);
  h.resource();
  await settle();
  const translatedPath = path.replace("language=en", "language=vi");
  data = snapshot(1).data;
  h.context.locale = "vi";
  h.render("useLoad", translatedPath, true, true);
  await settle();
  let r = h.render("useLoad", translatedPath, true, true);
  assert.equal(r.data.version, 10);
  assert.equal(r.stale, true);
  data = snapshot(11, "InService").data;
  h.foreground();
  await settle();
  r = h.render("useLoad", translatedPath, true, true);
  assert.equal(r.data.examStatus, "InService");
  assert.equal(r.stale, false);
  h.unmount();
});

for (const cached of [true, false])
  test(`offline deep link ${cached ? "opens only a previously authorized" : "rejects an unknown"} Visit`, async () => {
    const target = "01234567-1234-1234-1234-123456789012";
    const m = memory();
    await m.store.open(session);
    if (cached)
      await m.store.save("one", {
        ...snapshot(4),
        path: `/api/visits/${target}?language=en`,
      });
    const h = nativeHarness("App.tsx", {
      "@hospital/shared": { ...shared, localizeText: (x) => x },
      "./receptionState": reception,
      "./runtime": {
        useNative: () => ({
          session,
          config: { prdV2Enabled: true },
          locale: "en",
          t: (x) => x,
          api: async () => {
            throw new ApiError({ status: 0 });
          },
        }),
        useLoad: () => ({ data: [], refresh() {} }),
        useAction: () => ({}),
        journeyStore: m.store,
        receptionStore: {
          readVisit: async () => null,
          saveVisit: async () => {},
        },
      },
    });
    const props = { pending: `visit:${target}`, clearPending() {} };
    h.render("PatientApp", props);
    await settle();
    const tree = h.render("PatientApp", props);
    const journey = find(tree, (n) => n.type === "Journey");
    if (cached) assert.equal(journey.props.id, target);
    else {
      assert.equal(journey, undefined);
      assert.ok(find(tree, (n) => n.type === "Feedback" && n.props.error));
    }
    h.unmount();
  });

test("offline cold start restores the patient shell using cached configuration", async () => {
  const savedConfigs = [];
  const h = nativeHarness("App.tsx", {
    "@hospital/shared": { ...shared, isLocale: (x) => x === "en" },
    "./receptionState": reception,
    "react-native": {
      View: "View",
      ActivityIndicator: "ActivityIndicator",
      KeyboardAvoidingView: "KeyboardAvoidingView",
      Platform: { OS: "android" },
      AppState: { addEventListener: () => ({ remove() {} }) },
      Linking: {
        getInitialURL: async () => null,
        addEventListener: () => ({ remove() {} }),
      },
    },
    "expo-secure-store": { getItemAsync: async () => "en" },
    "./runtime": {
      NativeContext: { Provider: "Provider" },
      setApiLocale() {},
      nativeApi: async () => {
        throw new ApiError({ status: 0 });
      },
      restoreSession: async () => session,
      journeyStore: { readConfig: async () => ({ prdV2Enabled: true }),
        saveConfig: async (language, config) => { savedConfigs.push({ language, config }); } },
    },
  });
  h.render("default");
  await settle();
  const provider = find(h.render("default"), (n) => n.type === "Provider");
  assert.equal(provider.props.value.session.sessionId, session.sessionId);
  assert.equal(provider.props.value.config.prdV2Enabled, true);
  assert.equal(savedConfigs.at(-1).language, "en");
  h.unmount();
});

test("process restart uses the newest cached aggregate across languages", async () => {
  const m = memory();
  await m.store.open(session);
  await m.store.save("one", snapshot(2));
  const translated = {
    ...snapshot(10, "InService"),
    path: path.replace("language=en", "language=vi"),
  };
  await m.store.save("one", translated);
  const restarted = state.createJourneyStore(m.storage);
  await restarted.open(session);
  const read = await restarted.read("one", path);
  assert.equal(read.data.version, 10);
  assert.equal(read.path, translated.path);
});
