import { displayLocale, isLegacyLocale } from "../../packages/shared/src/locales.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the native components with device services replaced. Device layout,
// SecureStore persistence and audible speech still require Android acceptance.
function harness(file, modules = {}) {
  const states = [], refs = [], effects = [], memos = [], pendingEffects = [];
  let stateIndex, refIndex, effectIndex, memoIndex;
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const react = {
    useState(initial) {
      const i = stateIndex++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: initial => refs[refIndex++] ??= { current: initial },
    useEffect(callback, dependencies) {
      const i = effectIndex++;
      if (!effects[i] || dependencies.some((value, j) => value !== effects[i].dependencies[j]))
        pendingEffects.push(() => {
          effects[i]?.cleanup?.();
          effects[i] = { dependencies, cleanup: callback() };
        });
    },
    useMemo(callback, dependencies) {
      const i = memoIndex++;
      if (!memos[i] || dependencies.some((value, j) => value !== memos[i].dependencies[j]))
        memos[i] = { dependencies, value: callback() };
      return memos[i].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
  };
  const ui = Object.fromEntries(['Btn', 'Card', 'Choice', 'Feedback', 'Input', 'Txt', 'Badge', 'LoadingState', 'DestinationBlock'].map(name => [name, name]));
  const stubs = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      AppState: { addEventListener: () => ({ remove() {} }) },
      View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
      KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' },
      Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    },
    '@hospital/shared': { translator: () => key => key, displayLocale, isLegacyLocale, isLocale: value => ['vi', 'en'].includes(value), localizeText: text => text, dateText: () => 'fixture-date', ApiError: class extends Error {} },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-secure-store': { getItemAsync: async () => null, setItemAsync: async () => {} },
    'expo-speech': { stop: async () => {} },
    'expo-camera': {},
    'react-native-qrcode-svg': 'QRCode',
    './ui': { ...ui, styles: {}, colors: {} },
    './LanguagePicker': { LanguagePicker: 'LanguagePicker' },
    './Auth': { Auth: 'Auth' },
    './Reception': { Reception: 'Reception' },
    './Journey': { Journey: 'Journey', ScanTicket: 'ScanTicket', DirectionsScreen: 'DirectionsScreen' },
    './Records': { Help: 'Help', Notifications: 'Notifications', ProfileScreen: 'ProfileScreen', Results: 'Results' },
    './HospitalMap': { HospitalMap: 'HospitalMap' },
    './VisitTicket': { VisitTicket: 'VisitTicket' },
    './receptionState': { visitFromEntry: () => null },
    ...modules,
  };
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL(`../../apps/mobile/src/${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, URL, URLSearchParams, setTimeout: () => 1, setInterval: () => 1, clearTimeout() {}, clearInterval() {},
    require: name => { assert.ok(name in stubs, name); return stubs[name]; },
  });
  return {
    render(component, props = {}) {
      stateIndex = refIndex = effectIndex = memoIndex = 0;
      const tree = exports[component](props);
      while (pendingEffects.length) pendingEffects.shift()();
      return tree;
    },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (Array.isArray(tree)) return tree.map(child => find(child, predicate)).find(Boolean) ?? null;
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const guest = { sessionId: 'guest-session', patientId: 'guest-patient', isGuest: true, role: 'Patient', expiresAt: '2030-01-01T00:00:00Z', token: 'guest-token' };
const account = { ...guest, sessionId: 'account-session', patientId: 'account-patient', isGuest: false, token: 'account-token' };

for (const mode of ['register', 'login', 'recover']) {
  test(`native ${mode} uses its independent endpoint and accepts only the returned session`, async () => {
    const calls = [], sessions = [];
    const h = harness('Auth.tsx', { './runtime': { useAction: () => ({ run: async (path, body) => {
      calls.push({ path, body });
      return mode !== 'recover' ? account : { session: guest, visitId: 'original-visit' };
    } }) } });
    const props = { locale: 'en', setLocale() {}, onSession: async s => sessions.push(s) };
    let tree = h.render('Auth', props);
    if (mode !== 'login') find(tree, node => node.type === (mode === 'register' ? 'Choice' : 'Btn') && (node.props.label ?? node.props.children) === mode).props.onPress();
    tree = h.render('Auth', props);
    const input = (label, value) => find(tree, node => node.type === 'Input' && node.props.label === label).props.onChangeText(value);
    if (mode !== 'recover') {
      input('email', 'independent@example.test'); input('password', 'IndependentPassword123');
      if (mode === 'register') { input('name', 'Same Guest Name'); input('contact', 'same-contact'); }
    } else input('recoveryCode', 'verified-recovery-code');
    tree = h.render('Auth', props);
    // The first primary button submits; the other Recover button only selects the mode.
    const submit = find(tree, node => node.type === 'Btn' && !node.props.secondary);
    await submit.props.onPress();
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, `/api/auth/${mode}`);
    assert.equal('claim' in calls[0].body || 'patientId' in calls[0].body, false);
    assert.deepEqual(sessions, [mode !== 'recover' ? account : guest]);
  });
}

test('native session changes unmount private screens and stop audio before device storage completes', async () => {
  let stops = 0, finishStorage;
  const saved = [];
  const context = { Provider: 'NativeProvider' };
  const h = harness('App.tsx', {
    'expo-speech': { stop: async () => { stops++; } },
    './runtime': {
      NativePresence: "NativePresence", stopNativePresence() {}, pauseNativePresence: () => () => {},
      journeyStore: { saveConfig: async () => {} },
      NativeContext: context, setApiLocale() {}, localizedError: () => '',
      nativeApi: async () => ({ demo: false }), restoreSession: async () => guest,
      saveSession: async s => { saved.push(s); await new Promise(resolve => { finishStorage = resolve; }); },
    },
  });
  h.render('default'); await tick();
  const provider = find(h.render('default'), node => node.type === 'NativeProvider');
  assert.equal(provider.props.value.session.patientId, guest.patientId);
  const switchSession = provider.props.value.updateSession;
  const pending = switchSession(account);
  await tick();
  assert.equal(stops, 1);
  const changing = h.render('default');
  assert.equal(find(changing, node => node.type === 'NativeProvider'), null);
  assert.ok(find(changing, node => node.type === 'Auth'));
  finishStorage(); await pending;
  const next = find(h.render('default'), node => node.type === 'NativeProvider');
  assert.equal(next.props.value.session.patientId, account.patientId);
  assert.equal(next.props.children.key, account.sessionId, 'Private screen state is recreated for the new session');
  const logout = next.props.value.updateSession(null);
  await tick();
  assert.equal(stops, 2);
  assert.equal(find(h.render('default'), node => node.type === 'NativeProvider'), null);
  finishStorage(); await logout;
  assert.deepEqual(saved, [account, null]);
});

test('native completed Guest Journey offers results without a link invitation', () => {
  const h = harness('Journey.tsx', { './runtime': {
    useNative: () => ({ t: key => key, locale: 'en', session: guest }),
    useLoad: () => ({ data: { id: 'visit', ticketNumber: 'H-fixture', journeyStatus: 'Completed', steps: [] } }),
    useAction: () => ({}), useNarration: () => ({}), useVisitEvents: () => {},
  } });
  const tree = h.render('Journey', { id: 'visit', onResults() {} });
  assert.ok(find(tree, node => node.type === 'Btn' && node.props.children === 'results'));
  assert.equal(find(tree, node => /linkAccount|optionalAccount/.test(String(node.props.children))), null);
});
