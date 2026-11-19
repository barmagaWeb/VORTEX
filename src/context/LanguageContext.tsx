import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Language } from '../types';
import { translations } from '../constants/translations';

interface LanguageContextType {
  language: Language;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations.en) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', direction);
    try { localStorage.setItem('vortex_lang', language); } catch { /* Storage may be disabled. */ }
  }, [language, direction]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  const t = (key: keyof typeof translations.en): string => {
    const langDict = translations[language] || translations.en;
    return (langDict[key] as string) || (translations.en[key] as string) || String(key);
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
