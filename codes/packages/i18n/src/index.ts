import { vi } from './vi';
import { en } from './en';

export type Language = 'vi' | 'en';
export const translations = { vi, en };

export function getDictionary(lang: Language = 'vi') {
  return translations[lang] || translations.vi;
}

export * from './vi';
export * from './en';
