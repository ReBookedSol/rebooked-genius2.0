import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LanguageToggleProps {
  value?: 'en' | 'af';
  onChange?: (language: 'en' | 'af') => void;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ value, onChange }) => {
  const contextLanguage = useLanguage();

  // Use provided value/onChange or fall back to context
  const language = value !== undefined ? value : contextLanguage.language;
  const setLanguage = onChange !== undefined ? onChange : contextLanguage.setLanguage;

  const languages = [
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
    { code: 'af' as const, label: 'Afrikaans', flag: '🇿🇦' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-full"
    >
      <Select value={language} onValueChange={(value) => setLanguage(value as 'en' | 'af')}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </motion.div>
  );
};
