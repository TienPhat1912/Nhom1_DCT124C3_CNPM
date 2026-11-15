import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  createRouteNarration,
  type DemoPositionSource,
  type Locale,
} from "@hospital/shared";
import { routeSpeechAdapter } from "./routeSpeechAdapter";
import { deviceAudio } from "./deviceAudio";
export function useRouteNarration(
  controller: DemoPositionSource | null,
  locale: Locale,
  autoplay: boolean,
  labelsReady = true,
) {
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(!autoplay);
  const ref = useRef<ReturnType<typeof createRouteNarration> | null>(null);
  const running = useRef(true);
  useEffect(() => {
    setMuted(!autoplay);
  }, [autoplay]);
  useEffect(() => {
    if (!controller) return;
    const adapter = routeSpeechAdapter(locale);
    const guide = createRouteNarration(
      controller,
      deviceAudio,
      {
        speak(snapshot, done, failed) {
          setError(false);
          return adapter.speak(snapshot, done, failed);
        },
      },
      {
        now: () => Date.now(),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      },
      () => setError(true),
    );
    ref.current = guide;
    const visible = AppState.currentState === "active";
    if (running.current && visible && labelsReady) {
      guide.setMuted(muted);
      guide.start();
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        running.current = false;
        guide.pause();
      }
    });
    const off = () => subscription.remove();
    return () => {
      if (labelsReady)
        running.current = ["guidance", "moving"].includes(
          controller.getSnapshot().status,
        );
      off();
      guide.dispose();
      controller.pause();
      ref.current = null;
    };
  }, [controller, locale, labelsReady]);
  useEffect(() => {
    ref.current?.setMuted(muted);
  }, [muted]);
  return {
    error,
    muted,
    setMuted,
    start() {
      if (!labelsReady) return;
      running.current = true;
      setError(false);
      ref.current?.resume();
    },
    pause() {
      running.current = false;
      ref.current?.pause();
    },
    replay() {
      if (!labelsReady) return;
      setError(false);
      ref.current?.replay();
    },
  };
}
