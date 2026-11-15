import { createAudioCoordinator, type AudioLease } from "./audioCoordinator.ts";
import {
  DemoPositionSource,
  type PositionSnapshot,
  type PositionClock,
} from "./positionSource.ts";

export type RouteSpeechAdapter = {
  speak(
    snapshot: PositionSnapshot,
    done: () => void,
    failed: () => void,
  ): () => void;
};
/** Position/speech handshake. Platform adapters own voices and engine bindings. */
export function createRouteNarration(
  source: DemoPositionSource,
  audio: ReturnType<typeof createAudioCoordinator>,
  speech: RouteSpeechAdapter,
  clock: PositionClock,
  onError: () => void = () => {},
) {
  let generation = 0,
    active = false,
    muted = false,
    disposed = false;
  let resumeAfterPriority = false;
  let lease: AudioLease | null = null;
  let cancelSpeech: (() => void) | undefined;
  let timer: unknown;
  let pendingResume: unknown;
  let lastPrompt = "";
  const identity = (s: PositionSnapshot) => JSON.stringify(s.guidance);
  const stop = () => {
    generation++;
    if (pendingResume !== undefined) clock.clearTimeout(pendingResume);
    pendingResume = undefined;
    if (timer !== undefined) clock.clearTimeout(timer);
    timer = undefined;
    const cancel = cancelSpeech;
    cancelSpeech = undefined;
    try {
      cancel?.();
    } catch {
      /* Engine shutdown cannot retain ownership. */
    }
    const old = lease;
    lease = null;
    old?.release();
  };
  const play = (replay = false) => {
    const snapshot = source.getSnapshot();
    if (
      !active ||
      disposed ||
      audio.priority() === "journey" ||
      !snapshot.route ||
      ["paused", "lost", "stale", "no-route", "disposed"].includes(
        snapshot.status,
      ) ||
      snapshot.position.availability !== "available"
    )
      return;
    const key = identity(snapshot);
    if (!replay && (!snapshot.guidance || lastPrompt === key)) return;
    stop();
    const token = snapshot.guidance;
    if (replay && token) source.hold(token);
    if (!replay) lastPrompt = key;
    if (muted && !replay) {
      if (token) source.continue(token);
      return;
    }
    const seq = generation;
    let finished = false;
    const finish = (error: boolean) => {
      if (finished || disposed || seq !== generation) return;
      finished = true;
      stop();
      if (error) {
        try {
          onError();
        } catch {
          /* UI reporting is optional. */
        }
      }
      if (token && identity(source.getSnapshot()) === key)
        source.continue(token);
    };
    lease = audio.acquire(
      "route",
      stop,
      source.config.ttsTimeoutMs + source.config.tickMs,
    );
    if (!lease) return;
    timer = clock.setTimeout(() => finish(true), source.config.ttsTimeoutMs);
    try {
      const cancel = speech.speak(
        snapshot,
        () => finish(false),
        () => finish(true),
      );
      if (finished || seq !== generation) cancel();
      else cancelSpeech = cancel;
    } catch {
      finish(true);
    }
  };
  const offPosition = source.subscribe((s, event) => {
    if (["lost", "stale", "no-route", "disposed"].includes(s.status)) {
      active = false;
      resumeAfterPriority = false;
    }
    if (event === "guidance") {
      stop();
      if (active && audio.priority() === "journey") {
        resumeAfterPriority = true;
        source.pause();
      } else {
        if (active) source.start();
        play();
      }
    } else if (
      ["paused", "lost", "stale", "no-route", "disposed"].includes(s.status)
    )
      stop();
  });
  const offAudio = audio.subscribe(() => {
    if (disposed || !active) return;
    if (audio.priority() === "journey") {
      if (pendingResume !== undefined) {
        clock.clearTimeout(pendingResume);
        pendingResume = undefined;
        resumeAfterPriority = true;
      }
      const status = source.getSnapshot().status;
      if (status === "moving" || status === "guidance") {
        resumeAfterPriority = true;
        source.pause();
      }
    } else if (audio.priority() === null && resumeAfterPriority) {
      resumeAfterPriority = false;
      // Defer until React's unmount/session cleanup has had a chance to finish.
      pendingResume = clock.setTimeout(() => {
        pendingResume = undefined;
        const snapshot = source.getSnapshot();
        if (
          !disposed &&
          active &&
          audio.priority() === null &&
          snapshot.position.availability === "available" &&
          snapshot.status === "paused"
        )
          source.resume();
      }, 0);
    }
  });
  return {
    start() {
      if (disposed) return;
      active = true;
      if (audio.priority() === "journey") {
        resumeAfterPriority = true;
        source.pause();
      } else {
        source.start();
        play();
      }
    },
    pause() {
      active = false;
      resumeAfterPriority = false;
      stop();
      source.pause();
    },
    resume() {
      if (disposed) return;
      active = true;
      if (audio.priority() === "journey") {
        resumeAfterPriority = true;
        source.pause();
      } else {
        source.resume();
        play();
      }
    },
    replay() {
      play(true);
    },
    setMuted(value: boolean) {
      muted = value;
      if (value) {
        stop();
        const token = source.getSnapshot().guidance;
        if (active && token && audio.priority() !== "journey")
          source.continue(token);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      offPosition();
      offAudio();
      stop();
    },
  };
}
