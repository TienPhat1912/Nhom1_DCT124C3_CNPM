import type { Locale } from "./types";

// Legacy content/preferences remain readable; new UI offers only the PRD set.
export const supportedLanguages = [
  { code: "vi", label: "Tiếng Việt", speech: "vi-VN" },
  { code: "en", label: "English", speech: "en-US" },
  { code: "zh", label: "简体中文", speech: "zh-CN" },
  { code: "ko", label: "한국어", speech: "ko-KR" },
  { code: "ja", label: "日本語", speech: "ja-JP" },
  { code: "ru", label: "Русский", speech: "ru-RU" },
] as const;
export const languages = supportedLanguages.filter(
  (language) => language.code !== "ko" && language.code !== "ru",
);
export const isLegacyLocale = (value: unknown) =>
  value === "ko" || value === "ru";
export const displayLocale = (value: unknown): Locale =>
  languages.find((language) => language.code === value)?.code ?? "vi";
export function isLocale(value: unknown): value is Locale {
  return supportedLanguages.some((l) => l.code === value);
}
export const normalizeLocale = (value: unknown): Locale =>
  isLocale(value) ? value : "vi";
export const speechLocale = (locale: string) =>
  supportedLanguages.find((l) => l.code === locale)?.speech ?? "vi-VN";
export function voiceMatches(voice: string, locale: string) {
  const tag = voice.toLowerCase().replaceAll("_", "-");
  if (locale === "zh")
    return (
      ["zh-cn", "zh-hans", "cmn-cn", "cmn-hans"].some(
        (prefix) => tag === prefix || tag.startsWith(prefix + "-"),
      ) || tag === "zh"
    );
  return tag === locale || tag.startsWith(locale + "-");
}
