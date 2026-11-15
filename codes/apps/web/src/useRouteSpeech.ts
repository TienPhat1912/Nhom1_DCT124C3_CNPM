import { deviceAudio } from "./deviceAudio";
import type { AudioLease } from "@hospital/shared";
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
  const lease = useRef<AudioLease | null>(null);
  const release = () => {
    lease.current?.release();
    lease.current = null;
  };
  const stop = () => {
    generation.current++;
    if (lease.current?.valid() || deviceAudio.priority() === null)
      window.speechSynthesis?.cancel();
    release();
    setPlaying(false);
  };
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    generation.current++;
    if (lease.current?.valid() || deviceAudio.priority() === null)
      window.speechSynthesis?.cancel();
    release();
    setPlaying(false);
    setError("");
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      generation.current++;
      if (lease.current?.valid() || deviceAudio.priority() === null)
        window.speechSynthesis?.cancel();
      release();
    };
  }, [text, locale]);
  const play = () => {
    stop();
    lease.current = deviceAudio.acquire("route", stop, 15000);
    if (!lease.current) {
      setError(unavailable);
      return;
    }
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
        if (seq === generation.current) {
          setPlaying(false);
          release();
        }
      };
      utterance.onerror = (event) => {
        if (seq !== generation.current) return;
        setPlaying(false);
        release();
        if (event.error !== "canceled" && event.error !== "interrupted")
          setError(unavailable);
      };
      setPlaying(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      release();
      setPlaying(false);
      setError(unavailable);
    }
  };
  return { play, stop, playing, error };
}
