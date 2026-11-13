import test from "node:test";
import assert from "node:assert/strict";
import { all, deferred, find, loadNative, nativeHarness, tick } from "./native-harness.mjs";

const state = loadNative("receptionState.ts");
const locale = { vi: "Tiếng Việt", en: "English", zh: "简体中文", ja: "日本語" };
class ApiError extends Error { constructor(problem) { super(problem.title); this.problem = problem; } }
const shared = { ApiError, dateText: x => x, languages: Object.entries(locale).map(([code, label]) => ({ code, label })),
  localizeText: x => x, isLocale: x => ["vi", "en", "zh", "ja", "ko", "ru"].includes(x), translator: () => key => key };
const session = { sessionId: "fixture-session", role: "Patient", isGuest: true, expiresAt: "2030-01-01T00:00:00Z" };
const profile = { name: "Synthetic Guest", contact: "synthetic-contact" };
const config = { prdV2Enabled: true, departments: [{ id: "department", active: true, nameVi: "Fixture clinic" }] };
const renderProps = { onVisit() {}, onProfile() {} };
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
const plain = value => JSON.parse(JSON.stringify(value));
function memory() {
  const values = new Map();
  const storage = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  return { values, storage, store: state.createReceptionStore(storage) };
}
function fixture({ store = memory().store, api = async () => ({ id: "request" }), ...overrides } = {}) {
  const runtime = { config, locale: "en", session, t: key => key, api, ...overrides };
  const records = { profile, rows: [], detail: null, legacy: null, legacyRows: [], paths: [] };
  const resource = path => { records.paths.push(path); return { data: path === "/api/auth/profile" ? records.profile
    : path?.startsWith("/api/v2/requests?") ? records.rows
      : path?.startsWith("/api/v2/requests/") ? records.detail
        : path?.startsWith("/api/requests/") ? records.legacy
          : path?.startsWith("/api/requests?") ? records.legacyRows : null,
  error: null, loading: false, refresh() {} }; };
  const h = nativeHarness("ReceptionV2.tsx", { "@hospital/shared": shared, "./runtime": {
    useNative: () => runtime, useLoad: resource, receptionStore: store,
  } });
  return { ...h, runtime, records, store };
}
const btn = (tree, text) => find(tree, n => n.type === "Btn" && n.props.children === text);
const input = (tree, text) => find(tree, n => n.type === "Input" && n.props.label === text);
const choice = (tree, text) => find(tree, n => n.type === "Choice" && n.props.label === text);
async function ready(h, props = renderProps) { h.render("ReceptionV2", props); await settle(); return h.render("ReceptionV2", props); }

test("draft storage serializes writes and another session never inherits content or selected Visit", async () => {
  const { storage, store } = memory();
  const gate = deferred(); let calls = 0;
  const save = storage.setItemAsync;
  storage.setItemAsync = async (...args) => { if (++calls === 1) await gate.promise; await save(...args); };
  const first = store.save("one", { ...state.emptyReception("en"), description: "first" });
  const last = store.save("one", { ...state.emptyReception("en"), description: "  最後\n  " });
  await tick(); assert.equal(calls, 1); gate.resolve(); await Promise.all([first, last]);
  assert.equal((await store.read("one", "vi")).description, "  最後\n  ");
  assert.equal((await store.read("two", "en")).description, "");
  await store.saveVisit("one", "visit"); assert.equal(await store.readVisit("two"), null);
  await store.clear("one"); assert.equal(await store.readVisit("one"), null);
  assert.equal((await store.read("one", "en")).description, "");
});

test("form has four V2 fields, preserves raw text/source across UI language changes and omits booking/link/QR", async () => {
  const calls = [];
  const h = fixture({ api: async (...args) => { calls.push(args); return { id: "request" }; } });
  let tree = await ready(h);
  assert.equal(input(tree, "name"), undefined);
  assert.equal(input(tree, "requests"), undefined);
  assert.equal(btn(tree, "appointment"), undefined); assert.equal(btn(tree, "activate"), undefined);
  const original = "  原文\nNative original  ";
  input(tree, "description").props.onChangeText(original);
  choice(tree, "简体中文").props.onPress();
  choice(tree, "Fixture clinic").props.onPress();
  h.runtime.locale = "vi";
  tree = h.render("ReceptionV2", renderProps);
  assert.equal(input(tree, "description").props.value, original);
  assert.equal(choice(tree, "简体中文").props.selected, true);
  btn(tree, "sendRequest").props.onPress(); await settle();
  assert.equal(calls.length, 1); assert.equal(calls[0][0], "/api/v2/requests");
  assert.deepEqual(plain(calls[0][2]), { contact: "synthetic-contact", description: original, preferredDepartmentId: "department", sourceLanguage: "zh" });
  assert.equal((await h.store.read(session.sessionId, "en")).requestId, "request");
});

test("ambiguous network response survives remount and replays the original command/key without another request", async () => {
  const { store } = memory(); const calls = []; let committed = 0;
  const api = async (...args) => {
    calls.push(plain(args));
    if (calls.length === 1) { committed++; throw new ApiError({ title: "connection", status: 0 }); }
    assert.equal(args[3], calls[0][3]); return { id: "same-request" };
  };
  const h = fixture({ store, api }); let tree = await ready(h);
  input(tree, "description").props.onChangeText("  Retry unchanged\n  ");
  tree = h.render("ReceptionV2", renderProps);
  btn(tree, "sendRequest").props.onPress(); await settle(); h.unmount();
  const restored = fixture({ store, api, locale: "ja" }); tree = await ready(restored);
  assert.equal(input(tree, "description").props.value, "  Retry unchanged\n  ");
  assert.equal(input(tree, "description").props.editable, false);
  assert.equal(choice(tree, "English").props.disabled, true);
  btn(tree, "retry").props.onPress(); await settle();
  assert.equal(committed, 1); assert.deepEqual(calls[1], calls[0]);
  assert.equal((await store.read(session.sessionId, "vi")).pending, null);
});

test("storage failure prevents transmission until the same command can be persisted", async () => {
  const { storage, store } = memory(); let calls = 0;
  const h = fixture({ store, api: async () => { calls++; return { id: "request" }; } });
  let tree = await ready(h); const save = storage.setItemAsync;
  storage.setItemAsync = async () => { throw new Error("Device storage unavailable"); };
  btn(tree, "sendRequest").props.onPress(); await settle(); assert.equal(calls, 0);
  storage.setItemAsync = save; tree = h.render("ReceptionV2", renderProps);
  btn(tree, "retry").props.onPress(); await settle(); assert.equal(calls, 1);
});

test("unmount during persistence cannot send old Patient data using a newly switched session", async () => {
  const { storage, store } = memory(); const gate = deferred(); let calls = 0;
  const h = fixture({ store, api: async () => { calls++; return {}; } });
  const tree = await ready(h); storage.setItemAsync = async () => gate.promise;
  btn(tree, "sendRequest").props.onPress(); await tick(); h.unmount(); gate.resolve(); await settle();
  assert.equal(calls, 0);
});

test("Guest profile completion is required; unsupported locale requires an explicit source choice", async () => {
  const h = fixture({ locale: "ko" }); h.records.profile = { ...profile, name: "" };
  let opened = 0; const props = { onVisit() {}, onProfile() { opened++; } };
  const tree = await ready(h, props);
  assert.equal(btn(tree, "sendRequest").props.disabled, true);
  btn(tree, "profile").props.onPress(); assert.equal(opened, 1);
  assert.equal(all(tree, n => n.type === "Choice" && n.props.selected && Object.values(locale).includes(n.props.label)).length, 0);
});

for (const contract of ["prd-v2", "legacy"]) test(`pending ${contract} conflict opens the authorized existing request and leaves the draft intact`, async () => {
  const h = fixture({ api: async () => { throw new ApiError({ title: "pendingRequestExists", status: 409,
    existingRequestId: "existing", existingRequestContract: contract }); } });
  let tree = await ready(h); btn(tree, "sendRequest").props.onPress(); await settle();
  tree = h.render("ReceptionV2", renderProps); btn(tree, "continueRequest").props.onPress(); await settle();
  const draft = await h.store.read(session.sessionId, "en");
  assert.equal(draft.requestId, "existing"); assert.equal(draft.requestContract, contract); assert.equal(draft.pending, null);
});

test("active Visit conflict navigates to its authorized Visit without submitting again", async () => {
  const opened = []; let calls = 0;
  const props = { onVisit: id => opened.push(id) };
  const h = fixture({ api: async () => { calls++; throw new ApiError({ title: "activeVisitExists", status: 409, existingVisitId: "existing-visit" }); } });
  let tree = await ready(h, props); btn(tree, "sendRequest").props.onPress(); await settle();
  tree = h.render("ReceptionV2", props); btn(tree, "continueVisit").props.onPress();
  assert.deepEqual(opened, ["existing-visit"]); assert.equal(calls, 1);
});

test("poll/focus confirmation moves to Journey exactly once and sends no redeem command", async () => {
  const { store } = memory(); await store.save(session.sessionId, { ...state.emptyReception("en"), requestId: "request" });
  const opened = [], calls = []; const props = { onVisit: id => opened.push(id) };
  const h = fixture({ store, api: async path => { calls.push(path); } }); await ready(h, props);
  h.records.detail = { id: "request", status: "Confirmed", visitId: "visit", description: "raw", sourceLanguage: "en" };
  h.render("ReceptionV2", props); h.render("ReceptionV2", props);
  assert.deepEqual(opened, ["visit"]); assert.deepEqual(calls, []);
});

test("ticket view renders the issued snapshots/date/number and has no QR or mutation on V2", () => {
  const ticket = { number: "001", issuedOn: "2026-11-14", patientSnapshot: { name: "Historical name", contact: "contact" },
    clinicSnapshot: { nameVi: "Historical clinic", room: "101", building: "A", floor: "1" }, doctorSnapshot: { name: "Historical doctor" } };
  let calls = 0;
  const h = nativeHarness("VisitTicket.tsx", { "@hospital/shared": shared, "./runtime": {
    useNative: () => ({ t: key => key, locale: "en" }), useLoad: path => { calls++; assert.equal(path, "/api/visits/visit/ticket"); return { data: ticket }; },
  } });
  const tree = h.render("VisitTicket", { id: "visit" });
  assert.ok(JSON.stringify(tree).includes("Historical name")); assert.ok(JSON.stringify(tree).includes("2026-11-14"));
  assert.equal(find(tree, n => n.type === "QRCode" || n.type === "Btn"), undefined); assert.equal(calls, 1);
});

test("Entry accepts visit navigation hints and rejects malformed IDs", () => {
  const id = "00000000-0000-0000-0000-000000000001";
  assert.equal(state.visitFromEntry(`hguide://entry?visit=${id}`), id);
  assert.equal(state.visitFromEntry(`https://example.test/#visit=${id}`), id);
  assert.equal(state.visitFromEntry("hguide://entry?visit=other/path"), null);
  assert.equal(state.visitFromEntry("not a URL"), null);
});

for (const permitted of [true, false]) test(`warm/cold Visit Entry enforces backend access (${permitted ? "allowed" : "denied"})`, async () => {
  const store = memory().store, calls = []; let cleared = 0;
  const id = "00000000-0000-0000-0000-000000000001";
  const runtime = { session, config, t: key => key, locale: "en", api: async path => {
    calls.push(path); if (!permitted) throw new ApiError({ title: "forbidden", status: 403 }); return { id };
  } };
  const h = nativeHarness("App.tsx", { "@hospital/shared": shared, "./receptionState": state, "./runtime": {
    useNative: () => runtime, useLoad: () => ({ data: [] }), useAction: () => ({}), receptionStore: store,
  } });
  const props = { pending: `visit:${id}`, clearPending() { cleared++; } };
  h.render("PatientApp", props); await settle(); const tree = h.render("PatientApp", props);
  assert.deepEqual(calls, [`/api/visits/${id}`]); assert.equal(cleared, permitted ? 1 : 0);
  assert.equal(!!find(tree, n => n.type === "Journey"), permitted);
  assert.equal(await store.readVisit(session.sessionId), permitted ? id : null);
});

test("cold start restores the last selected Visit for this session", async () => {
  const store = memory().store; await store.saveVisit(session.sessionId, "last-visit");
  const h = nativeHarness("App.tsx", { "@hospital/shared": shared, "./receptionState": state, "./runtime": {
    useNative: () => ({ session, config, locale: "en", t: key => key }), useLoad: () => ({ data: [] }), useAction: () => ({}), receptionStore: store,
  } });
  const props = { pending: null, clearPending() {} }; h.render("PatientApp", props); await settle();
  assert.equal(find(h.render("PatientApp", props), n => n.type === "Journey").props.id, "last-visit");
});

test("session changes erase prior session draft/selection while profile updates preserve them", async () => {
  const { storage } = memory();
  const runtime = loadNative("runtime.tsx", { react: { createContext: () => ({}) }, "react-native": {},
    "expo-secure-store": storage, "expo-speech": {}, "./receptionState": state,
    "@hospital/shared": { ...shared, createApi: () => () => {} },
  });
  await runtime.saveSession({ ...session, token: "synthetic-token" });
  await runtime.receptionStore.save(session.sessionId, { ...state.emptyReception("en"), description: "private draft" });
  await runtime.receptionStore.saveVisit(session.sessionId, "visit");
  await runtime.saveSession({ ...session, token: "synthetic-token", name: "Updated" });
  assert.equal((await runtime.receptionStore.read(session.sessionId, "en")).description, "private draft");
  await runtime.saveSession(null);
  assert.equal((await runtime.receptionStore.read(session.sessionId, "en")).description, "");
  assert.equal(await runtime.receptionStore.readVisit(session.sessionId), null);
});

test("changing UI locale keeps the mounted Patient screen while localized configuration refreshes", async () => {
  const store = memory().store, slowConfig = deferred();
  const h = nativeHarness("App.tsx", { "@hospital/shared": shared, "./receptionState": state,
    "react-native": { View: "View", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "android" },
      Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) } },
    "expo-secure-store": { getItemAsync: async () => "en", setItemAsync: async () => {} },
    "./runtime": { NativeContext: { Provider: "Provider" }, nativeApi: async path => path.includes("language=vi") ? slowConfig.promise : config,
      restoreSession: async () => session, setApiLocale() {}, receptionStore: store },
  });
  h.render("default"); await settle();
  const before = find(h.render("default"), n => n.type === "Provider"); assert.ok(before);
  before.props.value.setLocale("vi");
  const after = find(h.render("default"), n => n.type === "Provider");
  assert.ok(after, "Pending config must not unmount the private screen and its draft");
  assert.equal(after.props.children.key, before.props.children.key);
  assert.equal(after.props.value.locale, "vi"); slowConfig.resolve(config); h.unmount();
});

test("verified recovery navigates to the returned Visit after saving its new session", async () => {
  const calls = [];
  const h = nativeHarness("Auth.tsx", { "@hospital/shared": shared, "./runtime": {
    useAction: () => ({ run: async () => ({ session, visitId: "recovered-visit" }) }),
  } });
  const props = { locale: "en", setLocale() {}, onSession: async () => { calls.push("session"); }, onRecovered: id => calls.push(id) };
  let tree = h.render("Auth", props); btn(tree, "recover").props.onPress();
  tree = h.render("Auth", props); input(tree, "recoveryCode").props.onChangeText("synthetic-code");
  tree = h.render("Auth", props); find(tree, n => n.type === "Btn" && !n.props.secondary).props.onPress(); await settle();
  assert.deepEqual(calls, ["session", "recovered-visit"]);
});

test("legacy history paginates independently when the V2 list is empty and remains read-only", async () => {
  const h = fixture(); let tree = await ready(h);
  h.records.legacyRows = Array.from({ length: 100 }, (_, i) => ({ id: `old-${i}`, name: `Legacy ${i}`, status: "Submitted", sourceLanguage: null }));
  h.records.legacy = { name: "Legacy", status: "Submitted", description: "  Legacy original  ", messages: [] };
  btn(tree, "legacyRecords").props.onPress(); tree = h.render("ReceptionV2", renderProps);
  const next = all(tree, n => n.type === "Btn" && n.props.children === "nextPage").at(-1);
  assert.equal(next.props.disabled, false); next.props.onPress();
  tree = h.render("ReceptionV2", renderProps); assert.ok(h.records.paths.includes("/api/requests?offset=100"));
  assert.ok(h.records.paths.includes("/api/v2/requests?offset=0"));
  choice(tree, "Legacy 0 · Submitted").props.onPress(); await settle();
  tree = h.render("ReceptionV2", renderProps);
  assert.ok(JSON.stringify(tree).includes("  Legacy original  "));
  assert.equal(btn(tree, "supplement"), undefined); assert.equal(find(tree, n => n.type === "QRCode"), undefined);
});
