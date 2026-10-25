import type { Locale } from "./types";

export const languages = [
  { code: "vi", label: "Tiếng Việt", speech: "vi-VN" },
  { code: "en", label: "English", speech: "en-US" },
  { code: "zh", label: "简体中文", speech: "zh-CN" },
  { code: "ko", label: "한국어", speech: "ko-KR" },
  { code: "ja", label: "日本語", speech: "ja-JP" },
  { code: "ru", label: "Русский", speech: "ru-RU" },
] as const;
export function isLocale(value: unknown): value is Locale {
  return languages.some((l) => l.code === value);
}
export const normalizeLocale = (value: unknown): Locale =>
  isLocale(value) ? value : "vi";
export const speechLocale = (locale: string) =>
  languages.find((l) => l.code === locale)?.speech ?? "vi-VN";
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
