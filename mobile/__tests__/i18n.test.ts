import { translate, dictionaries, SUPPORTED_LANGUAGES } from '../src/i18n';

describe('i18n Tests', () => {
  test('all supported languages have corresponding dictionaries', () => {
    SUPPORTED_LANGUAGES.forEach((lang) => {
      expect(dictionaries[lang.code]).toBeDefined();
    });
  });

  test('translate returns correct string in Vietnamese', () => {
    expect(translate('common.appName', 'vi')).toBe('Thuyết Minh Tự Động');
    expect(translate('auth.login', 'vi')).toBe('Đăng nhập');
  });

  test('translate returns correct string in English', () => {
    expect(translate('common.appName', 'en')).toBe('Audio Guide');
    expect(translate('auth.login', 'en')).toBe('Sign In');
  });

  test('translate returns correct string in Japanese', () => {
    expect(translate('common.appName', 'ja')).toBe('音声ガイド');
    expect(translate('auth.login', 'ja')).toBe('ログイン');
  });

  test('translate returns correct string in Chinese', () => {
    expect(translate('common.appName', 'zh')).toBe('语音导览');
    expect(translate('auth.login', 'zh')).toBe('登录');
  });

  test('translate falls back gracefully for unknown keys', () => {
    expect(translate('non.existing.key', 'vi')).toBe('non.existing.key');
  });
});
