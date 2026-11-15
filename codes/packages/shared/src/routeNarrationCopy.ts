import type { Locale } from "./types";
export const routeNarrationCopy = {
  vi: { auto: "Tự động đọc chỉ đường" },
  en: { auto: "Automatically read directions" },
  zh: { auto: "自动朗读路线" },
  ko: { auto: "길 안내 자동 읽기" },
  ja: { auto: "道案内を自動読み上げ" },
  ru: { auto: "Автоматически озвучивать маршрут" },
} satisfies Record<Locale, { auto: string }>;
