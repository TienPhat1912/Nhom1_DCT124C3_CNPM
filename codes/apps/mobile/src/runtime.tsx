import { normalizeLocale, speechLocale, voiceMatches } from "@hospital/shared";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";
import {
  createJourneyStore,
  olderSnapshot,
  resourceIdentity,
  sessionValid,
  type JourneySnapshot,
} from "./journeyState";
import { createReceptionStore } from "./receptionState";
import {
  ApiError,
  createApi,
  translator,
  type ApiClient,
  type Configuration,
  type Locale,
  type Narration,
  type Session,
} from "@hospital/shared";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:5280";
export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:5180";
let currentToken: string | null = null;
let currentSessionId: string | null = null;
export const receptionStore = createReceptionStore(SecureStore);
export const journeyStore = createJourneyStore(SecureStore);
let currentLocale = "vi";
export const setApiLocale = (language: string) => {
  currentLocale = normalizeLocale(language);
};
export const nativeApi = createApi(
  API_URL,
  () => currentToken,
  true,
  () => currentLocale,
);
export async function saveSession(s: Session | null) {
  currentToken = s?.token ?? null;
  if (currentSessionId && currentSessionId !== s?.sessionId)
    await receptionStore.clear(currentSessionId);
  if (s) await journeyStore.open(s);
  else await journeyStore.clear();
  currentSessionId = s?.sessionId ?? null;
  if (currentToken)
    await SecureStore.setItemAsync("hospital.token", currentToken);
  else await SecureStore.deleteItemAsync("hospital.token");
}
export async function restoreSession() {
  currentToken = await SecureStore.getItemAsync("hospital.token");
  if (!currentToken) {
    const previous = await journeyStore.readSession();
    if (previous) await receptionStore.clear(previous.sessionId);
    await journeyStore.clear();
    return null;
  }
  try {
    const s = await nativeApi<Session>("/api/auth/session");
    const restored = { ...s, token: currentToken };
    await saveSession(restored);
    return restored;
  } catch (e) {
    if (e instanceof ApiError && e.problem.status === 0) {
      const cached = await journeyStore.readSession();
      if (cached && sessionValid(cached)) {
        currentSessionId = cached.sessionId;
        await journeyStore.open(cached);
        return { ...cached, token: currentToken };
      }
    }
    if (e instanceof ApiError && [0, 401, 403].includes(e.problem.status)) {
      const previous = await journeyStore.readSession();
      if (previous) await receptionStore.clear(previous.sessionId);
      await saveSession(null);
    }
    throw e;
  }
}
export type NativeRuntime = {
  session: Session;
  config: Configuration;
  locale: Locale;
  setLocale: (l: Locale) => void;
  updateSession: (s: Session | null) => Promise<void>;
  api: ApiClient;
  t: (key: string) => string;
  scale: number;
};
export const NativeContext = createContext<NativeRuntime | null>(null);
export function useNative() {
  const c = useContext(NativeContext);
  if (!c) throw new Error("Missing native context");
  return c;
}
export function useLoad<T>(path: string | null, poll = false, persist = false) {
  const { api, locale, session } = useNative();
  if (path && !/[?&]language=/.test(path))
    path += `${path.includes("?") ? "&" : "?"}language=${locale}`;
  const [snapshot, setSnapshot] = useState<{
    path: string;
    data: T;
    updatedAt: string;
  } | null>(null);
  const latest = useRef<JourneySnapshot<T> | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let abort: AbortController | undefined;
    const load = async () => {
      abort?.abort();
      abort = new AbortController();
      const id = ++seq.current;
      setLoading(true);
      try {
        const data = await api<T>(
          path,
          "GET",
          undefined,
          undefined,
          abort.signal,
        );
        if (active && id === seq.current) {
          if (persist && olderSnapshot(latest.current, path, data)) {
            setStale(true);
            return;
          }
          const next = { path, data, updatedAt: new Date().toISOString() };
          latest.current = next;
          setSnapshot(next);
          setStale(false);
          if (persist)
            void journeyStore.save(session.sessionId, next).catch(() => {});
          setError(null);
        }
      } catch (e) {
        if (active && id === seq.current) {
          if (
            e instanceof ApiError &&
            [401, 403, 404].includes(e.problem.status)
          ) {
            latest.current = null;
            setSnapshot(null);
            if (persist)
              void journeyStore
                .discard(session.sessionId, path)
                .catch(() => {});
          }
          setError(e);
        }
      } finally {
        if (active && id === seq.current) setLoading(false);
      }
    };
    const restore = async () => {
      if (persist) {
        try {
          const saved = await journeyStore.read<T>(session.sessionId, path);
          if (
            active &&
            saved &&
            !olderSnapshot(latest.current, path, saved.data)
          ) {
            latest.current = saved;
            setSnapshot(saved);
            setStale(true);
          }
        } catch {
          /* An unavailable cache must not prevent an online read. */
        }
      }
      if (active) void load();
    };
    void restore();
    const timer = poll
      ? setInterval(() => {
          if (AppState.currentState === "active") void load();
        }, 5000)
      : undefined;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
      else setStale(true);
    });
    return () => {
      active = false;
      abort?.abort();
      clearInterval(timer);
      listener.remove();
    };
  }, [path, poll, revision, api, persist, session.sessionId]);
  const visible =
    snapshot &&
    path &&
    (snapshot.path === path ||
      (persist && resourceIdentity(snapshot.path) === resourceIdentity(path)));
  return {
    data: visible ? snapshot.data : null,
    stale: !!visible && (stale || snapshot?.path !== path),
    updatedAt: snapshot?.updatedAt ?? null,
    error,
    loading,
    refresh: () => setRevision((r) => r + 1),
  };
}
export function useAction(api: ApiClient = nativeApi) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  const pending = useRef(false);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const run = async <T,>(
    path: string,
    body: unknown = {},
    method = "POST",
  ): Promise<T | undefined> => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setOk(false);
    const signature = path + method + JSON.stringify(body);
    if (retry.current?.signature !== signature)
      retry.current = {
        signature,
        key: `native-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    try {
      const r = await api<T>(path, method, body, retry.current.key);
      retry.current = null;
      setOk(true);
      return r;
    } catch (e) {
      setError(e);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { run, busy, error, ok };
}
export function localizedError(e: unknown, locale: Locale) {
  const t = translator(locale);
  return e instanceof ApiError
    ? t(e.problem.title) === e.problem.title
      ? e.problem.detail
      : t(e.problem.title)
    : t("connection");
}
export function useNarration(context: string) {
  const { api, locale, t } = useNative();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const stop = async () => {
    const generation = ++seq.current;
    setPlaying(false);
    setLoading(false);
    try {
      await Speech.stop();
    } catch (e) {
      if (seq.current === generation) setError(localizedError(e, locale));
    }
  };
  useEffect(() => {
    seq.current++;
    void Speech.stop().catch(() => {});
    setPlaying(false);
    setLoading(false);
    setError("");
    return () => {
      seq.current++;
      void Speech.stop().catch(() => {});
    };
  }, [context, locale]);
  const play = async (path: string, body: unknown = {}) => {
    // Capture this playback before the first await so cancellation cannot be lost.
    const generation = ++seq.current;
    setLoading(true);
    setPlaying(false);
    setError("");
    try {
      await Speech.stop();
      if (seq.current !== generation) return;
      const n = await api<Narration>(path, "POST", body);
      if (seq.current !== generation) return;
      const voices = await Speech.getAvailableVoicesAsync();
      if (seq.current !== generation) return;
      const voice = voices.find((v) => voiceMatches(v.language, n.language));
      if (!voice) {
        setError(t("audioError"));
        return;
      }
      setPlaying(true);
      Speech.speak(n.text, {
        language: speechLocale(n.language),
        voice: voice.identifier,
        onDone: () => {
          if (seq.current === generation) setPlaying(false);
        },
        onStopped: () => {
          if (seq.current === generation) setPlaying(false);
        },
        onError: () => {
          if (seq.current !== generation) return;
          setError(t("audioError"));
          setPlaying(false);
        },
      });
    } catch (e) {
      if (seq.current === generation) {
        setPlaying(false);
        setError(localizedError(e, locale));
      }
    } finally {
      if (seq.current === generation) setLoading(false);
    }
  };
  return { play, stop, error, playing, loading };
}
