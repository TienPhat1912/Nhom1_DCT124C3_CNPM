import { createAudioCoordinator } from "../../packages/shared/src/audioCoordinator.ts";
import { createRouteNarration } from "../../packages/shared/src/routeNarration.ts";
import { DemoPositionSource } from "../../packages/shared/src/positionSource.ts";
import { hospitalMap } from "../../packages/shared/src/hospitalMap.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real hook without starting React Native or producing device audio.
const source = readFileSync(
  new URL("../../apps/mobile/src/runtime.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const localeExports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../../packages/shared/src/locales.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports: localeExports },
);
const narration = {
  text: "Approved test instruction",
  language: "vi",
  revision: 1,
};
const voices = [{ language: "vi-VN", identifier: "test-voice" }];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness() {
  const states = [],
    refs = [],
    effects = [],
    pendingEffects = [],
    spoken = [];
  let stateIndex,
    refIndex,
    effectIndex,
    mounted = true,
    updatesAfterUnmount = 0;
  let context = "initial",
    locale = "vi";
  const runtime = {
    session: { sessionId: "patient-one" },
    locale,
    t: (key) => key,
    api: async () => narration,
  };
  const speech = {
    stop: async () => {},
    getAvailableVoicesAsync: async () => voices,
    speak: (text, options) => spoken.push({ text, options }),
  };
  const listeners = new Set();
  const appState = {
    currentState: "active",
    addEventListener: (_, cb) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    },
  };
  const timers = new Map();
  let nextTimer = 0;
  const audio = createAudioCoordinator({
    setTimeout: (fn, ms) => {
      timers.set(++nextTimer, { fn, ms });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const stubs = {
    "./deviceAudio": { deviceAudio: audio },
    react: {
      createContext: () => ({}),
      useContext: () => runtime,
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [
          states[index],
          (value) => {
            if (!mounted) updatesAfterUnmount++;
            states[index] =
              typeof value === "function" ? value(states[index]) : value;
          },
        ];
      },
      useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
      useEffect: (callback, dependencies) => {
        const index = effectIndex++;
        if (
          !effects[index] ||
          dependencies.some(
            (value, i) => value !== effects[index].dependencies[i],
          )
        ) {
          pendingEffects.push(() => {
            effects[index]?.cleanup?.();
            effects[index] = { dependencies, cleanup: callback() };
          });
        }
      },
    },
    "react-native": { AppState: appState },
    "expo-secure-store": {},
    "./journeyState": { createJourneyStore: () => ({}) },
    "./receptionState": { createReceptionStore: () => ({}) },
    "expo-speech": speech,
    "@hospital/shared": {
      ...localeExports,
      createApi: () => async () => {},
      translator: () => (key) => key,
      ApiError: class extends Error {},
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    process: { env: {} },
    AbortController,
    setTimeout: (cb) => {
      timers.set(++nextTimer, { fn: cb, ms: 3000 });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
    require: (name) => {
      assert.ok(name in stubs, name);
      return stubs[name];
    },
  });
  const render = (nextContext = context, nextLocale = locale) => {
    context = nextContext;
    locale = nextLocale;
    runtime.locale = locale;
    stateIndex = refIndex = effectIndex = 0;
    const result = exports.useNarration(context);
    while (pendingEffects.length) pendingEffects.shift()();
    return result;
  };
  render();
  return {
    speech,
    runtime,
    spoken,
    render,
    audio,
    appState(state) {
      appState.currentState = state;
      for (const cb of listeners) cb(state);
    },
    timeout(ms = 3000) {
      for (const [id, item] of [...timers])
        if (item.ms <= ms) {
          timers.delete(id);
          item.fn();
        }
    },
    get view() {
      return render();
    },
    get updatesAfterUnmount() {
      return updatesAfterUnmount;
    },
    unmount() {
      effects.forEach((effect) => effect.cleanup?.());
      mounted = false;
    },
  };
}

test("current narration selects its voice and completes normally", async () => {
  const h = harness();
  await h.view.play("/narration");
  assert.equal(h.spoken.length, 1);
  assert.equal(h.spoken[0].text, narration.text);
  assert.equal(h.spoken[0].options.voice, voices[0].identifier);
  assert.equal(h.view.loading, false);
  assert.equal(h.view.playing, true);
  h.spoken[0].options.onDone();
  assert.equal(h.view.playing, false);
});

test("stop during voice loading prevents delayed playback and clears busy state", async () => {
  const h = harness(),
    requested = deferred(),
    available = deferred();
  h.speech.getAvailableVoicesAsync = () => {
    requested.resolve();
    return available.promise;
  };
  const pending = h.view.play("/narration");
  await requested.promise;
  await h.view.stop();
  assert.equal(h.view.loading, false);
  available.resolve(voices);
  await pending;
  assert.equal(h.spoken.length, 0);
  assert.equal(h.view.playing, false);
});

test("unmount while voices load prevents playback and state updates", async () => {
  const h = harness(),
    requested = deferred(),
    available = deferred();
  h.speech.getAvailableVoicesAsync = () => {
    requested.resolve();
    return available.promise;
  };
  const pending = h.view.play("/narration");
  await requested.promise;
  h.unmount();
  available.resolve(voices);
  await pending;
  assert.equal(h.spoken.length, 0);
  assert.equal(h.updatesAfterUnmount, 0);
});

for (const change of ["context", "language"]) {
  test(`changing ${change} cancels narration waiting for voices`, async () => {
    const h = harness(),
      requested = deferred(),
      available = deferred();
    h.speech.getAvailableVoicesAsync = () => {
      requested.resolve();
      return available.promise;
    };
    const pending = h.view.play("/narration");
    await requested.promise;
    h.render(
      change === "context" ? "another-visit" : "initial",
      change === "language" ? "en" : "vi",
    );
    assert.equal(h.view.loading, false);
    available.resolve(voices);
    await pending;
    assert.equal(h.spoken.length, 0);
    assert.equal(h.view.playing, false);
    assert.equal(h.view.error, "");
  });
}

test("stop during the initial native stop prevents even starting the narration request", async () => {
  const h = harness(),
    stopping = deferred();
  let calls = 0;
  h.runtime.api = async () => {
    calls++;
    return narration;
  };
  h.speech.stop = () => stopping.promise;
  const pending = h.view.play("/narration");
  const cancelled = h.view.stop();
  stopping.resolve();
  await Promise.all([pending, cancelled]);
  assert.equal(calls, 0);
  assert.equal(h.spoken.length, 0);
  assert.equal(h.view.loading, false);
});

test("cancelled request failures cannot overwrite a newer request's error or loading state", async () => {
  const h = harness(),
    firstStarted = deferred(),
    secondStarted = deferred();
  const first = deferred(),
    second = deferred();
  h.runtime.api = (path) => {
    if (path === "/first") {
      firstStarted.resolve();
      return first.promise;
    }
    secondStarted.resolve();
    return second.promise;
  };
  const old = h.view.play("/first");
  await firstStarted.promise;
  const current = h.view.play("/second");
  await secondStarted.promise;
  first.reject(new Error("Cancelled request failed"));
  await old;
  assert.equal(h.view.error, "");
  assert.equal(h.view.loading, true);
  second.resolve(narration);
  await current;
  assert.equal(h.spoken.length, 1);
  assert.equal(h.view.playing, true);
});

test("callbacks from old playback cannot stop or report errors over new playback", async () => {
  const h = harness();
  await h.view.play("/first");
  const old = h.spoken[0].options;
  await h.view.play("/second");
  old.onDone();
  old.onStopped();
  old.onError();
  assert.equal(h.view.playing, true);
  assert.equal(h.view.error, "");
  h.spoken[1].options.onError();
  assert.equal(h.view.playing, false);
  assert.equal(h.view.error, "audioError");
});

test("a current request failure clears loading and allows a successful retry", async () => {
  const h = harness();
  h.runtime.api = async () => {
    throw new Error("Provider unavailable");
  };
  await h.view.play("/narration");
  assert.equal(h.view.loading, false);
  assert.equal(h.view.playing, false);
  assert.equal(h.view.error, "connection");
  h.runtime.api = async () => narration;
  await h.view.play("/narration");
  assert.equal(h.view.error, "");
  assert.equal(h.view.playing, true);
});

test("missing voices report an audio error without speaking", async () => {
  const h = harness();
  h.speech.getAvailableVoicesAsync = async () => [];
  await h.view.play("/narration");
  assert.equal(h.spoken.length, 0);
  assert.equal(h.view.error, "audioError");
  assert.equal(h.view.loading, false);
  assert.equal(h.view.text, narration.text);
});

test("background aborts an in-flight request even if the transport returns late", async () => {
  const h = harness(),
    response = deferred(),
    entered = deferred();
  let signal;
  h.runtime.api = (...args) => {
    signal = args[4];
    entered.resolve();
    return response.promise;
  };
  const pending = h.view.play("/narration");
  await entered.promise;
  h.appState("background");
  assert.equal(signal.aborted, true);
  response.resolve(narration);
  await pending;
  assert.equal(h.spoken.length, 0);
  assert.equal(h.view.foreground, false);
  await h.view.play("/narration");
  assert.equal(h.spoken.length, 0);
  h.appState("active");
  await h.view.play("/narration");
  assert.equal(h.spoken.length, 1);
});

test("switching sessions cancels pending narration without a changed Visit key", async () => {
  const h = harness(),
    response = deferred(),
    entered = deferred();
  h.runtime.api = () => {
    entered.resolve();
    return response.promise;
  };
  const pending = h.view.play("/narration");
  await entered.promise;
  h.runtime.session = { sessionId: "patient-two" };
  h.render();
  response.resolve(narration);
  await pending;
  assert.equal(h.spoken.length, 0);
  assert.equal(h.view.text, "");
});

test("announcement uses the actual response language, ticket and snapshot room", async () => {
  const h = harness();
  h.runtime.locale = "en";
  await h.view.play(
    "/narration",
    {},
    { ticket: "A101-007", room: "A101", called: true },
  );
  assert.equal(h.spoken[0].options.language, "vi-VN");
  assert.match(h.spoken[0].text, /A101-007.*A101.*Approved test instruction/);
  assert.equal(h.view.text, h.spoken[0].text);
});

test("silent engine fails visibly and stale watchdogs cannot stop a newer playback", async () => {
  const h = harness();
  await h.view.play("/first");
  h.spoken[0].options.onStart();
  h.timeout();
  assert.equal(h.view.playing, true);
  await h.view.play("/second");
  h.timeout();
  assert.equal(h.view.playing, false);
  assert.equal(h.view.error, "audioError");
  await h.view.play("/retry");
  assert.equal(h.view.error, "");
});

test("unmount aborts fetch and clears the engine watchdog", async () => {
  const h = harness();
  await h.view.play("/narration");
  h.unmount();
  h.timeout();
  h.spoken[0].options.onDone();
  assert.equal(h.updatesAfterUnmount, 0);
});

test("actual native Journey hook freezes route movement and returns ownership after its utterance", async () => {
  const h = harness();
  let time = 10000;
  const clock = {
    now: () => time,
    setTimeout: (fn, ms) => {
      if (ms === 0) queueMicrotask(fn);
      return 1;
    },
    clearTimeout() {},
  };
  const position = new DemoPositionSource(hospitalMap, "simulation", { clock });
  const calls = [];
  const guide = createRouteNarration(
    position,
    h.audio,
    {
      speak(snapshot, done) {
        calls.push({ snapshot, done });
        return () => {};
      },
    },
    clock,
  );
  position.setTarget("room-B201");
  guide.start();
  const token = position.getSnapshot().guidance;
  calls[0].done();
  time += 1000;
  position.continue(token);
  assert.equal(position.getSnapshot().status, "moving");
  await h.view.play("/priority-narration");
  assert.equal(position.getSnapshot().status, "paused");
  assert.equal(h.audio.priority(), "journey");
  h.spoken[0].options.onDone();
  await Promise.resolve();
  assert.equal(position.getSnapshot().status, "guidance");
  assert.equal(calls.length, 2);
  guide.dispose();
  position.dispose();
  h.unmount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.audio.priority(), null);
});
