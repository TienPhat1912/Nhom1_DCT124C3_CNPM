import {
  routeInstructions,
  routeLanguage,
  speechLocale,
  voiceMatches,
  type Locale,
  type RouteSpeechAdapter,
} from "@hospital/shared";
import { deviceAudio } from "./deviceAudio";
import * as Speech from "expo-speech";
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
  void (async () => {
    try {
      await Speech.stop();
      if (!live) return;
      const voices = await Speech.getAvailableVoicesAsync();
      if (!live) return;
      const voice = voices.find((v) => voiceMatches(v.language, locale));
      if (!voice || !text.trim()) throw new Error("voiceUnavailable");
      Speech.speak(text, {
        language: speechLocale(locale),
        voice: voice.identifier,
        rate: 0.9,
        onDone: success,
        onError: error,
        onStopped: error,
      });
    } catch {
      error();
    }
  })();
  return () => {
    live = false;
    if (deviceAudio.priority() !== "journey")
      void Speech.stop().catch(() => {});
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
