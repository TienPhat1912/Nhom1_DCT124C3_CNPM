import { useEffect } from "react";
import { ApiError, type VisitEventPoll } from "@hospital/shared";
import { api, useRuntime } from "./runtime";

/** Only the mounted, visible journey owns fast polling. Cursors stay opaque. */
export function useVisitEvents(id: string | null, refresh: () => void) {
  const { session } = useRuntime();
  useEffect(() => {
    if (!id) return;
    let active = true;
    let cursor: string | undefined;
    let state: string | undefined;
    const seen = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: AbortController | undefined;
    const poll = async () => {
      if (!active || document.hidden || pending) return;
      const controller = new AbortController();
      pending = controller;
      let delay = 5000;
      try {
        const result = await api<VisitEventPoll>(
          `/api/visits/${id}/events${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (!active || controller.signal.aborted || result.visitId !== id)
          return;
        const next = JSON.stringify(result.state);
        // The operational snapshot is authoritative. Never read historical
        // Vietnamese guidance aloud, or treat every event key as a queue call.
        let fresh = false;
        for (const event of result.reset ? [] : result.events) {
          if (seen.has(event.id)) continue;
          seen.add(event.id);
          if (
            event.visitId === id &&
            !event.stale &&
            Date.parse(event.expiresAt) > Date.now()
          )
            fresh = true;
        }
        if (seen.size > 200) seen.clear();
        if (next !== state || fresh) refresh();
        state = next;
        cursor = result.cursor;
        delay = Math.max(1000, Math.min(10000, result.pollAfterMs || 1000));
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.problem.title === "invalidCursor"
        )
          cursor = undefined;
        // Normal resource polling remains available during delivery outages.
      } finally {
        if (pending === controller) pending = undefined;
        if (active && !document.hidden)
          timer = setTimeout(() => void poll(), delay);
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (document.hidden) {
        pending?.abort();
        cursor = undefined;
        seen.clear();
      } else void poll();
    };
    void poll();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      pending?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [id, session.sessionId, refresh]);
}
