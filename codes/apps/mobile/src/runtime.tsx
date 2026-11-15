import { deviceAudio } from "./deviceAudio";
import type { AudioLease } from "@hospital/shared";
import { normalizeLocale, speechLocale, voiceMatches } from "@hospital/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  type VisitEventPoll,
  createPresenceController,
  type PresenceHeartbeatV2,
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
let stopPresence = () => {};
let syncPresence = () => {};
let presencePaused = false;
export function stopNativePresence() { stopPresence(); }
export function pauseNativePresence() {
  const sync = syncPresence;
  presencePaused = true; sync();
  return () => { if (syncPresence === sync) { presencePaused = false; sync(); } };
}
export function NativePresence({ session, onExpired }: { session: Session | null; onExpired: () => void }) {
  const expired = useRef(onExpired); expired.current = onExpired;
  useEffect(() => {
    if (!session) return;
    presencePaused = false;
    // Capture this session's token; a delayed old flight cannot use a new token.
    const presenceApi = createApi(API_URL, () => session.token ?? null, true, () => currentLocale);
    const controller = createPresenceController({
      send: signal => presenceApi<PresenceHeartbeatV2>("/api/v2/presence/heartbeat", "POST", undefined, undefined, signal),
      unauthorized: error => error instanceof ApiError && error.problem.status === 401,
      onExpired: () => expired.current(),
    });
    let state = AppState.currentState;
    const sync = () => controller.setActive(!presencePaused && state === "active");
    syncPresence = sync; stopPresence = controller.stop;
    const listener = AppState.addEventListener("change", next => { state = next; sync(); });
    sync();
    return () => {
      controller.stop(); listener.remove();
      if (syncPresence === sync) { syncPresence = () => {}; stopPresence = () => {}; }
    };
  }, [session?.sessionId, session?.token]);
  return null;
}
export async function saveSession(s: Session | null) {
  if (currentSessionId !== (s?.sessionId ?? null)) stopNativePresence();
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
  configLocale?: Locale;
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
      if (AppState.currentState !== "active") return;
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
    let timer: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      clearInterval(timer);
      if (poll && AppState.currentState === "active")
        timer = setInterval(() => void load(), 5000);
    };
    startPolling();
    const listener = AppState.addEventListener("change", (state) => {
      clearInterval(timer);
      if (state === "active") void load();
      else {
        abort?.abort();
        seq.current++;
        setLoading(false);
        setStale(true);
      }
      startPolling();
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
    refresh: useCallback(() => setRevision((r) => r + 1), []),
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
  const { api, locale, t, session } = useNative();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const seq = useRef(0);
  const lease = useRef<AudioLease | null>(null);
  const release = () => {
    lease.current?.release();
    lease.current = null;
  };
  const stopEngine = async () => {
    const owned = lease.current;
    try {
      if (owned?.valid() || deviceAudio.priority() === null)
        await Speech.stop();
    } finally {
      owned?.release();
      if (lease.current === owned) lease.current = null;
    }
  };
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const invalidate = () => {
    seq.current++;
    request.current?.abort();
    clearTimeout(timer.current);
  };
  const stop = async () => {
    invalidate();
    const generation = ++seq.current;
    setPlaying(false);
    setLoading(false);
    try {
      await stopEngine();
    } catch (e) {
      if (seq.current === generation) setError(localizedError(e, locale));
    }
  };
  useEffect(() => {
    invalidate();
    void stopEngine().catch(() => {});
    setPlaying(false);
    setLoading(false);
    setError("");
    setText("");
    const listener = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state !== "active") void stop();
    });
    return () => {
      listener.remove();
      invalidate();
      void stopEngine().catch(() => {});
    };
  }, [context, locale, session.sessionId]);
  const play = async (
    path: string,
    body: unknown = {},
    announcement?: { ticket: string; room: string; called: boolean },
  ) => {
    if (AppState.currentState !== "active") return;
    invalidate();
    lease.current = deviceAudio.acquire(
      "journey",
      () => {
        void stop();
      },
      15000,
    );
    const controller = new AbortController();
    request.current = controller;
    // Capture this playback before the first await so cancellation cannot be lost.
    const generation = ++seq.current;
    const valid = () =>
      seq.current === generation &&
      lease.current?.valid() === true &&
      AppState.currentState === "active";
    setLoading(true);
    setPlaying(false);
    setError("");
    try {
      await Speech.stop();
      if (!valid()) return;
      const n = await api<Narration>(
        path,
        "POST",
        body,
        undefined,
        controller.signal,
      );
      if (!valid()) return;
      const labels = translator(normalizeLocale(n.language));
      const spoken = announcement
        ? `${labels("ticket")}: ${announcement.ticket}. ${labels("room")}: ${announcement.room}. ${announcement.called ? labels("proceed") + " " : ""}${n.text}`
        : n.text;
      setText(spoken);
      const voices = await Speech.getAvailableVoicesAsync();
      if (!valid()) return;
      const voice = voices.find((v) => voiceMatches(v.language, n.language));
      if (!voice) {
        release();
        setError(t("audioError"));
        return;
      }
      setPlaying(true);
      timer.current = setTimeout(() => {
        if (!valid()) return;
        void stop();
        setError(t("audioError"));
      }, 3000);
      Speech.speak(spoken, {
        onStart: () => {
          if (valid()) clearTimeout(timer.current);
        },
        language: speechLocale(n.language),
        voice: voice.identifier,
        onDone: () => {
          if (valid()) {
            clearTimeout(timer.current);
            setPlaying(false);
            release();
          }
        },
        onStopped: () => {
          if (valid()) {
            clearTimeout(timer.current);
            setPlaying(false);
            release();
          }
        },
        onError: () => {
          if (!valid()) return;
          clearTimeout(timer.current);
          setError(t("audioError"));
          setPlaying(false);
          release();
        },
      });
    } catch (e) {
      if (valid()) {
        clearTimeout(timer.current);
        setPlaying(false);
        release();
        setError(localizedError(e, locale));
      }
    } finally {
      if (seq.current === generation) setLoading(false);
    }
  };
  return { play, stop, error, playing, loading, text, foreground };
}

/** PB-023 stream: only the visible Journey owns a fast polling loop. */
export function useVisitEvents(id: string | null, refresh: () => void) {
  const { api, session } = useNative();
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    let cursor: string | undefined;
    let previous: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: AbortController | undefined;
    const seen = new Set<string>();
    const poll = async () => {
      if (!mounted || AppState.currentState !== "active" || pending) return;
      const controller = new AbortController();
      pending = controller;
      let delay = 5000;
      try {
        const value = await api<VisitEventPoll>(
          `/api/visits/${id}/events${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (!mounted || controller.signal.aborted || value.visitId !== id)
          return;
        const state = JSON.stringify(value.state);
        let fresh = false;
        for (const event of value.reset ? [] : value.events) {
          if (seen.has(event.id)) continue;
          seen.add(event.id);
          if (
            event.visitId === id &&
            !event.stale &&
            Date.parse(event.expiresAt) > Date.now()
          )
            fresh = true;
        }
        if (state !== previous || fresh) refresh();
        if (seen.size > 200) seen.clear();
        previous = state;
        cursor = value.cursor;
        delay = Math.max(1000, Math.min(10000, value.pollAfterMs || 1000));
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.problem.title === "invalidCursor"
        )
          cursor = undefined;
      } finally {
        if (pending === controller) pending = undefined;
        if (mounted && AppState.currentState === "active")
          timer = setTimeout(() => void poll(), delay);
      }
    };
    const listener = AppState.addEventListener("change", (state) => {
      clearTimeout(timer);
      if (state === "active") {
        refresh(); // Revalidate language/content before any resumed playback.
        void poll();
      } else {
        cursor = undefined;
        seen.clear();
        pending?.abort();
      }
    });
    void poll();
    return () => {
      mounted = false;
      clearTimeout(timer);
      pending?.abort();
      listener.remove();
    };
  }, [id, session.sessionId, api, refresh]);
}
