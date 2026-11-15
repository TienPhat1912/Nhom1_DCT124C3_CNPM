import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

export const tick = () => new Promise(resolve => setImmediate(resolve));
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function loadNative(file, modules = {}, globals = {}) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL(`../../apps/mobile/src/${file}`, import.meta.url), "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, URL, URLSearchParams, AbortController, process: { env: {} },
    setTimeout: () => 1, setInterval: () => 1, clearTimeout() {}, clearInterval() {},
    require: name => { assert.ok(name in modules, `Missing stub: ${name}`); return modules[name]; }, ...globals });
  return exports;
}
// Runs actual component code with controlled React hooks/device boundaries.
// This checks behavior, not native layout or real SecureStore; Android remains a required gate.
export function nativeHarness(file, modules = {}) {
  const states = [], refs = [], effects = [], memos = [], pending = [];
  let si, ri, ei, mi;
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const react = {
    useState(initial) {
      const i = si++;
      if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
    },
    useRef: initial => refs[ri++] ??= { current: initial },
    useEffect(callback, deps) {
      const i = ei++;
      if (!effects[i] || deps.some((d, n) => d !== effects[i].deps[n])) pending.push(() => {
        effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: callback() };
      });
    },
    useMemo(callback, deps) {
      const i = mi++;
      if (!memos[i] || deps.some((d, n) => d !== memos[i].deps[n])) memos[i] = { deps, value: callback() };
      return memos[i].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
  };
  const names = ["Btn", "Card", "Choice", "Feedback", "Input", "Txt", "Badge", "LoadingState", "DestinationBlock"];
  const ui = Object.fromEntries(names.map(n => [n, n]));
  const exports = loadNative(file, {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", ScrollView: "ScrollView", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator",
      KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "android" },
      BackHandler: { addEventListener: () => ({ remove() {} }) } },
    "./ui": { ...ui, styles: {}, colors: {} },
    "./LanguagePicker": { LanguagePicker: "LanguagePicker" },
    "./Auth": { Auth: "Auth" }, "./Reception": { Reception: "Reception" },
    "./Journey": { Journey: "Journey", ScanTicket: "ScanTicket", DirectionsScreen: "DirectionsScreen" },
    "./Records": { Help: "Help", Notifications: "Notifications", ProfileScreen: "ProfileScreen", Results: "Results" },
    "./HospitalMap": { HospitalMap: "HospitalMap" }, "./VisitTicket": { VisitTicket: "VisitTicket" },
    "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider", SafeAreaView: "SafeAreaView" },
    "expo-status-bar": { StatusBar: "StatusBar" }, "expo-secure-store": {}, "expo-speech": {},
    "expo-camera": {}, "react-native-qrcode-svg": "QRCode", ...modules,
    react: { ...react, ...modules.react },
  });
  return {
    render(component, ...args) {
      si = ri = ei = mi = 0;
      const tree = exports[component](...args);
      while (pending.length) pending.shift()();
      return tree;
    },
    unmount() { effects.forEach(e => e.cleanup?.()); },
    exports,
  };
}
export function all(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(n => all(n, predicate));
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}
export const find = (tree, predicate) => all(tree, predicate)[0];
