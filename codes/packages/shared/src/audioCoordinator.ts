/** One device speech engine, with Journey/calls taking priority over navigation. */
export type AudioPriority = "route" | "journey";
export type AudioLease = {
  valid: () => boolean;
  release: () => void;
};
export type AudioClock = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (timer: unknown) => void;
};

export function createAudioCoordinator(
  clock: AudioClock = {
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (timer) =>
      clearTimeout(timer as ReturnType<typeof setTimeout>),
  },
) {
  let current: {
    priority: AudioPriority;
    cancel: () => void;
    token: symbol;
    timer: unknown;
  } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* A failed UI subscriber cannot retain the audio engine. */
      }
    }
  };
  const revoke = () => {
    const old = current;
    if (!old) return;
    current = null;
    clock.clearTimeout(old.timer);
    // Clear ownership before invoking application code: cancellation callbacks
    // may synchronously release the old lease or inspect the current owner.
    try {
      old.cancel();
    } catch {
      /* Ownership must still be returned if an engine fails to stop. */
    }
  };
  return {
    priority: () => current?.priority ?? null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    acquire(
      priority: AudioPriority,
      cancel: () => void,
      timeoutMs = 30000,
    ): AudioLease | null {
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
        throw new Error("Invalid speech timeout");
      if (current?.priority === "journey" && priority === "route") return null;
      revoke();
      const token = Symbol(priority);
      const owner = { priority, cancel, token, timer: undefined as unknown };
      current = owner;
      owner.timer = clock.setTimeout(() => {
        if (current?.token !== token) return;
        try {
          revoke();
        } finally {
          notify();
        }
      }, timeoutMs);
      const lease: AudioLease = {
        valid: () => current?.token === token,
        release: () => {
          if (current?.token !== token) return;
          clock.clearTimeout(current.timer);
          current = null;
          notify();
        },
      };
      notify();
      return lease;
    },
    dispose() {
      try {
        revoke();
      } finally {
        notify();
        listeners.clear();
      }
    },
  };
}
