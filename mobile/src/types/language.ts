export type LanguageCode = 'vi' | 'en' | 'ja' | 'zh';

export interface Language {
  code: LanguageCode;
  name: string;        // e.g. "Tiếng Việt"
  nativeName: string;  // e.g. "Tiếng Việt", "English", "日本語", "中文"
  flag: string;        // Flag emoji or asset key
  isRtl?: boolean;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'vi',
    name: 'Tiếng Việt',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'ja',
    name: 'Tiếng Nhật',
    nativeName: '日本語',
    flag: '🇯🇵',
  },
  {
    code: 'zh',
    name: 'Tiếng Trung',
    nativeName: '中文',
    flag: '🇨🇳',
  },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'vi';
