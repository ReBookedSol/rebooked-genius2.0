import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, translations } from '@/translations';

export const useTranslation = () => {
  const { language } = useLanguage();

  const t = (key: string, defaultValue?: string): string => {
    return getTranslation(language, key, defaultValue);
  };

  // Helper to get array of translations (for suggested prompts, etc.)
  const tArray = (key: string): string[] => {
    try {
      const keys = key.split('.');
      let current: any = translations[language];
      for (const k of keys) {
        current = current[k];
      }
      return Array.isArray(current) ? current : [];
    } catch {
      return [];
    }
  };

  return { t, tArray, language };
};
