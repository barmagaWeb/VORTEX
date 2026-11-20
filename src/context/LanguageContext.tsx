import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Language } from '../types';
import { translations } from '../constants/translations';

interface LanguageContextType {
  language: Language;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations.en, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const applyLanguageToDOM = (lang: Language) => {
  const root = document.documentElement;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  root.setAttribute('lang', lang);
  root.setAttribute('dir', dir);
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('vortex_lang');
      return saved === 'ar' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const direction: 'ltr' | 'rtl' = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = direction === 'rtl';

  useEffect(() => {
    applyLanguageToDOM(language);
    try {
      localStorage.setItem('vortex_lang', language);
    } catch {
      /* Storage may be disabled. */
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    applyLanguageToDOM(lang);
    setLanguageState(lang);
    try {
      localStorage.setItem('vortex_lang', lang);
    } catch {
      /* Storage may be disabled. */
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      applyLanguageToDOM(next);
      try {
        localStorage.setItem('vortex_lang', next);
      } catch {
        /* Storage may be disabled. */
      }
      return next;
    });
  }, []);

  const t = (key: keyof typeof translations.en, params?: Record<string, string | number>): string => {
    const langDict = translations[language] || translations.en;
    const template = (langDict[key] as string) || (translations.en[key] as string) || String(key);
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };

  return (
    <LanguageContext.Provider value={{ language, direction, isRTL, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
