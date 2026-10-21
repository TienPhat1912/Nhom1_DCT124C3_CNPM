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

const client = createApi("");
export const api: typeof client = async (...args) => {
  try {
    return await client(...args);
  } catch (e) {
    if (e instanceof ApiError && e.problem.title === "sessionExpired")
      window.dispatchEvent(new Event("hospital:expired"));
    throw e;
  }
};
export type Runtime = {
  session: Session;
  config: Configuration;
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
export function useResource<T>(path: string | null, poll = false) {
  const [state, setState] = useState<{
    path: string;
    data: T;
    updated: Date;
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  useEffect(() => {
    if (!path) return;
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
          setState({ path, data, updated: new Date() });
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
    window.addEventListener("online", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("online", load);
      window.removeEventListener("focus", load);
    };
  }, [path, poll, tick]);
  return {
    data: state?.path === path ? state.data : null,
    updated: state?.path === path ? state.updated : null,
    error,
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
