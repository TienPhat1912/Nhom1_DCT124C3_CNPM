import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";
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
export const nativeApi = createApi(API_URL, () => currentToken, true);
export async function saveSession(s: Session | null) {
  currentToken = s?.token ?? null;
  if (currentToken)
    await SecureStore.setItemAsync("hospital.token", currentToken);
  else await SecureStore.deleteItemAsync("hospital.token");
}
export async function restoreSession() {
  currentToken = await SecureStore.getItemAsync("hospital.token");
  if (!currentToken) return null;
  try {
    const s = await nativeApi<Session>("/api/auth/session");
    return { ...s, token: currentToken };
  } catch (e) {
    if (e instanceof ApiError && e.problem.status === 401)
      await saveSession(null);
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
export function useLoad<T>(path: string | null, poll = false) {
  const { api } = useNative();
  const [snapshot, setSnapshot] = useState<{
    path: string;
    data: T;
    updatedAt: string;
  } | null>(null);
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
          setSnapshot({ path, data, updatedAt: new Date().toISOString() });
          setError(null);
        }
      } catch (e) {
        if (active && id === seq.current) setError(e);
      } finally {
        if (active && id === seq.current) setLoading(false);
      }
    };
    void load();
    const timer = poll
      ? setInterval(() => {
          if (AppState.currentState === "active") void load();
        }, 5000)
      : undefined;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      active = false;
      abort?.abort();
      clearInterval(timer);
      listener.remove();
    };
  }, [path, poll, revision, api]);
  return {
    data: snapshot?.path === path ? snapshot.data : null,
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
    seq.current++;
    await Speech.stop();
    setPlaying(false);
  };
  useEffect(() => {
    seq.current++;
    void Speech.stop();
    setPlaying(false);
    return () => {
      seq.current++;
      void Speech.stop();
    };
  }, [context, locale]);
  const play = async (path: string, body: unknown = {}) => {
    await stop();
    const generation = seq.current;
    setLoading(true);
    setError("");
    try {
      const n = await api<Narration>(path, "POST", body);
      if (seq.current !== generation) return;
      const voices = await Speech.getAvailableVoicesAsync();
      const voice = voices.find((v) =>
        v.language.toLowerCase().startsWith(n.language),
      );
      if (!voice) {
        setError(t("audioError"));
        return;
      }
      setPlaying(true);
      Speech.speak(n.text, {
        language: n.language,
        voice: voice.identifier,
        onDone: () => setPlaying(false),
        onStopped: () => setPlaying(false),
        onError: () => {
          setError(t("audioError"));
          setPlaying(false);
        },
      });
    } catch (e) {
      setError(localizedError(e, locale));
    } finally {
      setLoading(false);
    }
  };
  return { play, stop, error, playing, loading };
}
