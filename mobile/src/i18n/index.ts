import { LanguageCode, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../types';
import vi from './locales/vi.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

type LocaleDictionary = typeof vi;

export const dictionaries: Record<LanguageCode, LocaleDictionary> = {
  vi,
  en,
  ja,
  zh,
};

/**
 * Hàm lấy chuỗi bản địa hóa theo dot notation key (ví dụ: 'home.title', 'auth.login')
 * Nếu không tìm thấy ở ngôn ngữ hiện tại, sẽ fallback về ngôn ngữ mặc định (vi).
 */
export function translate(key: string, lang: LanguageCode = DEFAULT_LANGUAGE): string {
  const dictionary = dictionaries[lang] || dictionaries[DEFAULT_LANGUAGE];
  const keys = key.split('.');

  let current: any = dictionary;
  for (const part of keys) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback về default language nếu tìm trong ngôn ngữ phụ không có
      let fallbackCurrent: any = dictionaries[DEFAULT_LANGUAGE];
      for (const fbPart of keys) {
        if (fallbackCurrent && typeof fallbackCurrent === 'object' && fbPart in fallbackCurrent) {
          fallbackCurrent = fallbackCurrent[fbPart];
        } else {
          return key; // Trả về key nếu không tìm thấy
        }
      }
      return typeof fallbackCurrent === 'string' ? fallbackCurrent : key;
    }
  }

  return typeof current === 'string' ? current : key;
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
