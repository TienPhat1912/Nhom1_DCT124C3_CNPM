import test from "node:test";
import assert from "node:assert/strict";
import {
  languages,
  displayLocale,
  isLegacyLocale,
  isLocale,
} from "../../packages/shared/src/locales.ts";
import { nativeHarness, all, find, tick } from "./native-harness.mjs";
const shared = {
  languages,
  displayLocale,
  isLegacyLocale,
  isLocale,
  translator: (locale) => (key) => `${locale}:${key}`,
  localizeText: (text) => text,
  ApiError: class extends Error {},
};
for (const { code } of languages)
  test(`native picker ${code}: four options and selection callback`, () => {
    const choices = [];
    const h = nativeHarness("LanguagePicker.tsx", {
      "@hospital/shared": shared,
    });
    const tree = h.render("LanguagePicker", {
      locale: code,
      onChange: (value) => choices.push(value),
    });
    const rows = all(tree, (node) => node.type === "Choice");
    assert.deepEqual(
      rows.map((row) => row.props.label),
      languages.map((language) => language.label),
    );
    assert.equal(rows.filter((row) => row.props.selected).length, 1);
    for (const row of rows) row.props.onPress();
    assert.deepEqual(choices, ["vi", "en", "zh", "ja"]);
  });
for (const saved of ["vi", "en", "zh", "ja", "ko", "ru"])
  test(`native restart ${saved}: display fallback preserves session/storage and language switch does not save a Visit`, async () => {
    const original = {
      sessionId: "legacy-session",
      token: "original-token",
      language: saved,
      role: "Patient",
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const storage = new Map([
      ["hospital.language", saved],
      ["history", "unchanged-visit-and-steps"],
    ]);
    const calls = [],
      locales = [],
      sessions = [];
    const h = nativeHarness("App.tsx", {
      "@hospital/shared": shared,
      "react-native": {
        Linking: {
          getInitialURL: async () => null,
          addEventListener: () => ({ remove() {} }),
        },
        AppState: { addEventListener: () => ({ remove() {} }) },
        Platform: { OS: "android" },
      },
      "expo-secure-store": {
        getItemAsync: async (key) => storage.get(key) ?? null,
        setItemAsync: async (key, value) => storage.set(key, value),
      },
      "expo-speech": { stop: async () => {} },
      "./runtime": {
        NativeContext: { Provider: "NativeProvider" },
        nativeApi: async (...args) => {
          calls.push(args);
          return { departments: [], locations: [], services: [] };
        },
        restoreSession: async () => original,
        saveSession: async (value) => sessions.push(value),
        setApiLocale: (value) => locales.push(value),
        journeyStore: {
          saveConfig: async () => {},
          readConfig: async () => null,
        },
      },
      "./receptionState": { visitFromEntry: () => null },
    });
    h.render("default");
    for (let i = 0; i < 10; i++) await tick();
    let tree = h.render("default");
    let provider = find(tree, (node) => node.type === "NativeProvider");
    assert.equal(provider.props.value.locale, displayLocale(saved));
    assert.equal(provider.props.value.session, original);
    assert.equal(storage.get("hospital.language"), saved);
    assert.equal(
      !!find(
        tree,
        (node) =>
          node.type === "Txt" &&
          node.props.children === "vi:legacyLanguageNotice",
      ),
      isLegacyLocale(saved),
    );
    for (const { code } of languages) {
      provider.props.value.setLocale(code);
      tree = h.render("default");
      provider = find(tree, (node) => node.type === "NativeProvider");
      assert.equal(provider.props.value.locale, code);
      assert.equal(provider.props.value.session, original);
    }
    assert.equal(storage.get("history"), "unchanged-visit-and-steps");
    assert.deepEqual(sessions, []);
    assert.ok(
      calls.every(
        ([path, method]) => path.startsWith("/api/config?language=") && !method,
      ),
    );
    assert.equal(locales.at(-1), "ja");
    h.unmount();
  });
