import { speechLocale, voiceMatches } from "@hospital/shared";
import { useEffect, useRef, useState } from "react";
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
    window.speechSynthesis?.cancel();
    setPlaying(false);
  };
  useEffect(() => {
    generation.current++;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setError("");
    return () => {
      generation.current++;
      window.speechSynthesis?.cancel();
    };
  }, [text, locale]);
  const play = () => {
    stop();
    setError("");
    const seq = generation.current;
    try {
      if (!text || !window.speechSynthesis) throw new Error("unavailable");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLocale(locale);
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => voiceMatches(v.lang, locale));
      if (voices.length && !voice) throw new Error("unavailable");
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.onend = () => {
        if (seq === generation.current) setPlaying(false);
      };
      utterance.onerror = (event) => {
        if (seq !== generation.current) return;
        setPlaying(false);
        if (event.error !== "canceled" && event.error !== "interrupted")
          setError(unavailable);
      };
      setPlaying(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlaying(false);
      setError(unavailable);
    }
  };
  return { play, stop, playing, error };
}
