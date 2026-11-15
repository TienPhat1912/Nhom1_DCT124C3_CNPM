import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  normalizeLocale,
  speechLocale,
  translator,
  voiceMatches,
  type Narration,
} from "@hospital/shared";
import { api, errorText, useRuntime } from "./runtime";
import { deviceAudio } from "./deviceAudio";
import type { AudioLease } from "@hospital/shared";

export type Announcement = { ticket: string; room: string; called: boolean };

export function useSpeech(contextKey: string) {
  const { t, locale, session } = useRuntime();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const generation = useRef(0);
  const lease = useRef<AudioLease | null>(null);
  const pending = useRef<AbortController | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cache = useRef<{ key: string; narration: Narration } | null>(null);
  const stop = useCallback(() => {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    clearTimeout(timer.current);
    if (lease.current?.valid() || deviceAudio.priority() === null)
      window.speechSynthesis?.cancel();
    lease.current?.release();
    lease.current = null;
    currentUtterance.current = null;
    setPlaying(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    stop();
    cache.current = null;
    setError("");
    setText("");
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("hospital:expired", stop);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("hospital:expired", stop);
    };
  }, [contextKey, locale, session.sessionId, stop]);

  const play = useCallback(
    async (path: string, body?: unknown, announcement?: Announcement) => {
      stop();
      lease.current = deviceAudio.acquire("journey", stop, 15000);
      setError("");
      setLoading(true);
      const seq = generation.current;
      const valid = () =>
        seq === generation.current &&
        !document.hidden &&
        lease.current?.valid() === true;
      const controller = new AbortController();
      pending.current = controller;
      try {
        const key = JSON.stringify([path, body]);
        const n =
          cache.current?.key === key
            ? cache.current.narration
            : await api<Narration>(
                path,
                "POST",
                body ?? {},
                undefined,
                controller.signal,
              );
        if (!valid()) return;
        cache.current = { key, narration: n };
        const labels = translator(normalizeLocale(n.language));
        const spoken = announcement
          ? `${labels("ticket")}: ${announcement.ticket}. ${labels("room")}: ${announcement.room}. ${announcement.called ? labels("proceed") + " " : ""}${n.text}`
          : n.text;
        setText(spoken);
        const synth = window.speechSynthesis;
        if (!synth || !window.SpeechSynthesisUtterance || !n.text?.trim())
          throw new Error("unavailable");
        let voices = synth.getVoices();
        if (!voices.length) {
          // Voice inventories can arrive after the first render on real browsers.
          await new Promise<void>((resolve) => {
            const finish = () => {
              clearTimeout(wait);
              synth.removeEventListener?.("voiceschanged", finish);
              controller.signal.removeEventListener("abort", finish);
              resolve();
            };
            const wait = setTimeout(finish, 750);
            synth.addEventListener?.("voiceschanged", finish);
            controller.signal.addEventListener("abort", finish, { once: true });
          });
          if (!valid()) return;
          voices = synth.getVoices();
        }
        const voice = voices.find((v) => voiceMatches(v.lang, n.language));
        if (!voice) throw new Error("voiceUnavailable");
        const utterance = new SpeechSynthesisUtterance(spoken);
        currentUtterance.current = utterance;
        utterance.lang = speechLocale(n.language);
        utterance.voice = voice;
        utterance.onstart = () => {
          if (valid()) clearTimeout(timer.current);
        };
        utterance.onend = () => {
          if (!valid()) return;
          clearTimeout(timer.current);
          setPlaying(false);
          lease.current?.release();
          lease.current = null;
        };
        utterance.onerror = (event) => {
          if (!valid()) return;
          clearTimeout(timer.current);
          setPlaying(false);
          lease.current?.release();
          lease.current = null;
          if (event.error !== "canceled" && event.error !== "interrupted")
            setError(t("audioError"));
        };
        // Some engines silently reject autoplay without dispatching an error.
        timer.current = setTimeout(() => {
          if (!valid()) return;
          stop();
          setError(t("audioError"));
        }, 2500);
        setPlaying(true);
        synth.speak(utterance);
      } catch (e) {
        if (valid()) {
          clearTimeout(timer.current);
          setPlaying(false);
          lease.current?.release();
          lease.current = null;
          setError(
            e instanceof ApiError ? errorText(e, locale) : t("audioError"),
          );
        }
      } finally {
        if (seq === generation.current) setLoading(false);
      }
    },
    [locale, t, stop],
  );
  return { play, stop, playing, error, loading, text };
}
