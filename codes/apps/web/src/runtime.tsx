import { normalizeLocale } from "@hospital/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  createApi,
  translator,
  type Configuration,
  type Locale,
  type Session,
} from "@hospital/shared";

const client = createApi(
  "",
  () => null,
  false,
  () => normalizeLocale(localStorage.getItem("hospital.language")),
);
export const api: typeof client = async (...args) => {
  try {
    return await client(...args);
  } catch (e) {
    if (e instanceof ApiError && e.problem.title === "sessionExpired")
      window.dispatchEvent(new Event("hospital:expired"));
    throw e;
  }
};
// Tab-local snapshots are removed at every authentication boundary.
export function clearOfflineSnapshots() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (
        key.startsWith("hospital.cache:") ||
        key === "hospital.offline-session"
      )
        sessionStorage.removeItem(key);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}
export function rememberSession(session: Session) {
  try {
    sessionStorage.setItem(
      "hospital.offline-session",
      JSON.stringify({ ...session, token: undefined }),
    );
  } catch {
    /* Offline reload is optional when storage is unavailable. */
  }
}
export function offlineSession(): Session | null {
  try {
    const session = JSON.parse(
      sessionStorage.getItem("hospital.offline-session") ?? "null",
    ) as Session | null;
    if (
      session?.role === "Patient" &&
      Date.parse(
        session.expiresAt.endsWith("Z")
          ? session.expiresAt
          : session.expiresAt + "Z",
      ) > Date.now()
    )
      return session;
  } catch {
    /* Ignore invalid or expired snapshots. */
  }
  clearOfflineSnapshots();
  return null;
}
export type Runtime = {
  session: Session;
  config: Configuration;
  configLocale?: Locale;
  locale: Locale;
  setLocale: (l: Locale) => void;
  setSession: (s: Session | null) => void;
  t: (s: string) => string;
};
export const RuntimeContext = createContext<Runtime | null>(null);
export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("Runtime context missing");
  return value;
}
function aggregateVersion(data: unknown) {
  return data && typeof data === "object" && "version" in data
    ? Number(data.version)
    : 0;
}
function resourceIdentity(value: string) {
  const url = new URL(value, "http://hospital.local");
  url.searchParams.delete("language");
  return url.href;
}
export function useResource<T>(
  path: string | null,
  poll = false,
  keepPreviousOnLanguageChange = false,
  cacheScope?: string,
) {
  const locale = useContext(RuntimeContext)?.locale;
  if (path && locale && !/[?&]language=/.test(path))
    path += `${path.includes("?") ? "&" : "?"}language=${locale}`;
  const [state, setState] = useState<{
    path: string;
    data: T;
    updated: Date;
  } | null>(null);
  const [stale, setStale] = useState(false);
  const latest = useRef<{ path: string; data: T } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  useEffect(() => {
    if (!path) return;
    const cacheKey = cacheScope ? `hospital.cache:${cacheScope}:${path}` : null;
    if (cacheKey) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const snapshot = JSON.parse(cached) as { data: T; updated: string };
          const previous = latest.current;
          if (!(
            previous &&
            resourceIdentity(previous.path) === resourceIdentity(path) &&
            aggregateVersion(previous.data) > aggregateVersion(snapshot.data)
          )) {
            latest.current = { path, data: snapshot.data };
            setState({
              path,
              data: snapshot.data,
              updated: new Date(snapshot.updated),
            });
            setStale(true);
          }
        }
      } catch {
        /* Storage is optional; fetching still works. */
      }
    }
    let active = true;
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const seq = ++sequence.current;
      setLoading(true);
      try {
        const data = await api<T>(
          path,
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (active && seq === sequence.current) {
          // Request ordering alone cannot prevent an older server snapshot from
          // replacing a newer aggregate (for example after reconnecting).
          const previous = latest.current;
          if (
            cacheScope &&
            previous &&
            resourceIdentity(previous.path) === resourceIdentity(path) &&
            aggregateVersion(data) < aggregateVersion(previous.data)
          )
            return;
          const updated = new Date();
          latest.current = { path, data };
          setState({ path, data, updated });
          setStale(false);
          if (cacheKey) {
            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({ data, updated }),
              );
            } catch {
              /* Private mode or a full cache must not break the screen. */
            }
          }
          setError(null);
        }
      } catch (e) {
        if (active && seq === sequence.current) setError(e);
      } finally {
        if (active && seq === sequence.current) setLoading(false);
      }
    };
    void load();
    const timer = poll
      ? setInterval(() => {
          if (document.visibilityState === "visible") void load();
        }, 5000)
      : undefined;
    const offline = () => setStale(true);
    window.addEventListener("offline", offline);
    window.addEventListener("online", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", load);
      window.removeEventListener("focus", load);
    };
  }, [path, poll, tick, cacheScope]);
  // Keep mounted screens while translating the same resource. Other query
  // changes (including pagination) and different records still clear old data.
  const visible =
    state &&
    path &&
    (state.path === path ||
      (keepPreviousOnLanguageChange &&
        resourceIdentity(state.path) === resourceIdentity(path)));
  return {
    data: visible ? state.data : null,
    dataLocale: visible
      ? normalizeLocale(
          new URLSearchParams(state.path.split("?")[1] ?? "").get("language"),
        )
      : null,
    updated: visible ? state.updated : null,
    error,
    stale: !!visible && (stale || state?.path !== path),
    loading,
    refresh,
  };
}
export function useMutation() {
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
    try {
      if (retry.current?.signature !== signature) {
        // Unlike randomUUID, getRandomValues also works on HTTP LAN origins.
        const key = Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        retry.current = { signature, key };
      }
      const result = await api<T>(path, method, body, retry.current.key);
      retry.current = null;
      setOk(true);
      return result;
    } catch (e) {
      setError(e);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    run,
    busy,
    error,
    ok,
    clear: () => {
      setError(null);
      setOk(false);
    },
  };
}
export function errorText(error: unknown, locale: Locale): string {
  const t = translator(locale);
  if (error instanceof ApiError) {
    const translated = t(error.problem.title);
    return translated === error.problem.title
      ? error.problem.detail
      : translated;
  }
  return t("connection");
}
