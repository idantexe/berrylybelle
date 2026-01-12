import React, { createContext, useState, useContext, ReactNode } from 'react';
import { translations } from '../utils/translations';

type Language = 'en' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to Indonesian based on user request
  const [language, setLanguage] = useState<Language>('id');

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'id' : 'en');
  };

  const value = {
    language,
    setLanguage,
    t: translations[language],
    toggleLanguage
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};