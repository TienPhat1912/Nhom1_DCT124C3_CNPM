import { useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import type { Locale } from "@hospital/shared";

export function useRouteSpeech(
  text: string,
  locale: Locale,
  unavailable: string,
) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    void Speech.stop().catch(() => {});
    setPlaying(false);
  };
  useEffect(() => {
    generation.current++;
    void Speech.stop().catch(() => {});
    setPlaying(false);
    setError("");
    return () => {
      generation.current++;
      void Speech.stop().catch(() => {});
    };
  }, [text, locale]);
  const play = async () => {
    const seq = ++generation.current;
    setError("");
    try {
      await Speech.stop();
      if (seq !== generation.current || !text) return;
      const voices = await Speech.getAvailableVoicesAsync();
      if (seq !== generation.current) return;
      const voice = voices.find((v) =>
        v.language.toLowerCase().startsWith(locale),
      );
      if (!voice) throw new Error("unavailable");
      setPlaying(true);
      Speech.speak(text, {
        language: locale === "vi" ? "vi-VN" : "en-US",
        voice: voice.identifier,
        rate: 0.9,
        onDone: () => {
          if (seq === generation.current) setPlaying(false);
        },
        onStopped: () => {
          if (seq === generation.current) setPlaying(false);
        },
        onError: () => {
          if (seq === generation.current) {
            setPlaying(false);
            setError(unavailable);
          }
        },
      });
    } catch {
      if (seq === generation.current) {
        setPlaying(false);
        setError(unavailable);
      }
    }
  };
  return { play, stop, playing, error };
}
