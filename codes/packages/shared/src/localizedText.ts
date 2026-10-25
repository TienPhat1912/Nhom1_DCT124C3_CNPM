import phrases from "../data/translations.json" with { type: "json" };
import type { Locale } from "./types";

const dictionary: Record<string, Partial<Record<Locale, string>>> = phrases;
export function localizeText(source: string, locale: Locale) {
  return locale === "vi" ? source : (dictionary[source]?.[locale] ?? source);
}
export function localizedCopy<T extends Record<string, string>>(
  source: T,
  locale: Locale,
): T {
  return Object.fromEntries(
    Object.entries(source).map(([key, text]) => [
      key,
      localizeText(text, locale),
    ]),
  ) as T;
}
