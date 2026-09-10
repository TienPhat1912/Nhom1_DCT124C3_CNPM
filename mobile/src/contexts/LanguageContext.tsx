import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageCode, Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../types';
import { translate } from '../i18n';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  currentLanguageInfo: Language;
  supportedLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translate(key, language);
  };

  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguageInfo,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage phải được sử dụng bên trong LanguageProvider');
  }
  return context;
};
