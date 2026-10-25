import { localizeText } from "./localizedText.ts";
import { normalizeLocale, speechLocale } from "./locales.ts";
import type { ApiProblem } from "./types";
export class ApiError extends Error {
  constructor(public problem: ApiProblem) {
    super(problem.detail);
  }
}
export type ApiClient = ReturnType<typeof createApi>;
export function createApi(
  base: string,
  token: () => string | null = () => null,
  native = false,
  language: () => string = () => "vi",
) {
  return async function api<T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    const cancel = () => abort.abort();
    signal?.addEventListener("abort", cancel);
    try {
      const bearer = token();
      const response = await fetch(base + path, {
        method,
        credentials: "include",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Hospital-Client": "1",
          "X-Hospital-Language": language(),
          ...(native ? { "X-Client": "native" } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body === undefined || method === "GET" || method === "HEAD"
          ? {}
          : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({
          title: response.status === 429 ? "rateLimit" : "serverError",
          status: response.status,
          detail: response.statusText,
        }));
        throw new ApiError(problem);
      }
      return (await response.json()) as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError({
        title: "connection",
        status: 0,
        detail:
          "Connection failed or timed out. The operation has not been confirmed.",
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  };
}
export function qrToken(
  value: string,
  purpose: "ticket" | "reception",
): string {
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return new URLSearchParams(url.hash.slice(1)).get(purpose) ?? "";
  } catch {
    return "";
  }
}
export function displayName(
  value: { nameVi: string; nameEn?: string; name?: string },
  language: string,
) {
  return language === "vi"
    ? value.nameVi
    : (value.name ?? localizeText(value.nameVi, normalizeLocale(language)));
}
export function dateText(value: string | null | undefined, language: string) {
  return value
    ? new Date(
        value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)
          ? value
          : value + "Z",
      ).toLocaleString(speechLocale(language), {
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "—";
}
