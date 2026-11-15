import {
  routeInstructions,
  routeLanguage,
  speechLocale,
  voiceMatches,
  type Locale,
  type RouteSpeechAdapter,
} from "@hospital/shared";
import { deviceAudio } from "./deviceAudio";

export function speakRouteText(
  text: string,
  locale: Locale,
  done: () => void,
  failed: () => void,
) {
  let live = true;
  const success = () => {
    if (live) done();
  };
  const error = () => {
    if (live) failed();
  };
  let wait: ReturnType<typeof setTimeout> | undefined;
  let waiting = false;
  const speak = () => {
    if (!live) return;
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const voice = voices.find((v) => voiceMatches(v.lang, locale));
      if (!voice || !text.trim()) throw new Error("voiceUnavailable");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLocale(locale);
      utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.onend = success;
      utterance.onerror = error;
      synth.speak(utterance);
    } catch {
      error();
    }
  };
  const voicesChanged = () => {
    if (!waiting) return;
    waiting = false;
    clearTimeout(wait);
    window.speechSynthesis?.removeEventListener?.(
      "voiceschanged",
      voicesChanged,
    );
    speak();
  };
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) error();
  else if (window.speechSynthesis.getVoices().length) speak();
  else {
    waiting = true;
    window.speechSynthesis.addEventListener?.("voiceschanged", voicesChanged);
    wait = setTimeout(voicesChanged, 750);
  }
  return () => {
    live = false;
    clearTimeout(wait);
    window.speechSynthesis?.removeEventListener?.(
      "voiceschanged",
      voicesChanged,
    );
    if (deviceAudio.priority() !== "journey") window.speechSynthesis?.cancel();
  };
}
export function routeSpeechAdapter(locale: Locale): RouteSpeechAdapter {
  return {
    speak(snapshot, done, failed) {
      const language = routeLanguage(snapshot.route, locale);
      const text = snapshot.route
        ? routeInstructions(snapshot.route, language)[snapshot.legIndex]
        : "";
      return speakRouteText(text, language, done, failed);
    },
  };
}
