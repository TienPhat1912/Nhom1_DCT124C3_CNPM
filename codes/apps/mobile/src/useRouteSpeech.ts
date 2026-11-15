import { deviceAudio } from "./deviceAudio";
import type { AudioLease } from "@hospital/shared";
import { speechLocale, voiceMatches } from "@hospital/shared";
import { useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { AppState } from "react-native";
import type { Locale } from "@hospital/shared";

export function useRouteSpeech(
  text: string,
  locale: Locale,
  unavailable: string,
) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const lease = useRef<AudioLease | null>(null);
  const release = () => {
    lease.current?.release();
    lease.current = null;
  };
  const stop = () => {
    generation.current++;
    if (lease.current?.valid() || deviceAudio.priority() === null)
      void Speech.stop().catch(() => {});
    release();
    setPlaying(false);
  };
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    generation.current++;
    if (lease.current?.valid() || deviceAudio.priority() === null)
      void Speech.stop().catch(() => {});
    release();
    setPlaying(false);
    setError("");
    return () => {
      subscription.remove();
      generation.current++;
      if (lease.current?.valid() || deviceAudio.priority() === null)
        void Speech.stop().catch(() => {});
      release();
    };
  }, [text, locale]);
  const play = async () => {
    stop();
    lease.current = deviceAudio.acquire("route", stop, 15000);
    if (!lease.current) {
      setError(unavailable);
      return;
    }
    const seq = ++generation.current;
    setError("");
    try {
      await Speech.stop();
      if (seq !== generation.current || !text) return;
      const voices = await Speech.getAvailableVoicesAsync();
      if (seq !== generation.current) return;
      const voice = voices.find((v) => voiceMatches(v.language, locale));
      if (!voice) throw new Error("unavailable");
      setPlaying(true);
      Speech.speak(text, {
        language: speechLocale(locale),
        voice: voice.identifier,
        rate: 0.9,
        onDone: () => {
          if (seq === generation.current) {
            setPlaying(false);
            release();
          }
        },
        onStopped: () => {
          if (seq === generation.current) {
            setPlaying(false);
            release();
          }
        },
        onError: () => {
          if (seq === generation.current) {
            setPlaying(false);
            release();
            setError(unavailable);
          }
        },
      });
    } catch {
      if (seq === generation.current) {
        release();
        setPlaying(false);
        setError(unavailable);
      }
    }
  };
  return { play, stop, playing, error };
}
