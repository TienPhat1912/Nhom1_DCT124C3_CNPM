import type { PresenceHeartbeatV2 } from "./types";

export type PresenceController = {
  setActive(active: boolean): void;
  stop(): void;
};

// Platform adapters own foreground/session boundaries. A generation guards late
// replies even if a transport ignores AbortSignal; only one current flight/timer.
export function createPresenceController(options: {
  send(signal: AbortSignal): Promise<PresenceHeartbeatV2>;
  unauthorized(error: unknown): boolean;
  onExpired(): void;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}): PresenceController {
  const schedule =
    options.schedule ??
    ((callback, milliseconds) => {
      const timer = setTimeout(callback, milliseconds);
      return () => clearTimeout(timer);
    });
  let active = false,
    stopped = false,
    generation = 0,
    interval = 15000;
  let cancelTimer: (() => void) | undefined;
  let flight: AbortController | undefined;
  const cancel = () => {
    generation++;
    cancelTimer?.();
    cancelTimer = undefined;
    flight?.abort();
    flight = undefined;
  };
  const stop = () => {
    stopped = true;
    active = false;
    cancel();
  };
  const beat = async () => {
    if (!active || stopped || flight) return;
    const current = generation;
    const controller = new AbortController();
    flight = controller;
    try {
      const response = await options.send(controller.signal);
      if (current !== generation || stopped || !active) return;
      if (
        Number.isFinite(response?.heartbeatSeconds) &&
        response.heartbeatSeconds >= 5 &&
        response.heartbeatSeconds <= 300
      )
        interval = response.heartbeatSeconds * 1000;
    } catch (error) {
      if (
        current === generation &&
        active &&
        !stopped &&
        options.unauthorized(error)
      ) {
        stop();
        options.onExpired();
        return;
      }
    } finally {
      if (current === generation && active && !stopped) {
        flight = undefined;
        cancelTimer = schedule(() => {
          cancelTimer = undefined;
          void beat();
        }, interval);
      }
    }
  };
  return {
    setActive(value) {
      if (stopped || value === active) return;
      cancel();
      active = value;
      if (active) void beat();
    },
    stop,
  };
}
