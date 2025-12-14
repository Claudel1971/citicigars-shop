import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import i18n from '../i18n';

const languages = [
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
];

const LanguageSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLangCode, setCurrentLangCode] = useState(i18n.language || 'fr');

  useEffect(() => {
    const handleLangChange = (lng) => {
      setCurrentLangCode(lng);
    };
    i18n.on('languageChanged', handleLangChange);
    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, []);

  const currentLang = languages.find(l => l.code === currentLangCode) || languages[0];

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 p-2 hover:bg-accent rounded-full transition-colors text-primary"
        aria-label="Select language"
      >
        <Globe className="h-5 w-5" />
        <span className="text-xs font-medium">{currentLang.label}</span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-md shadow-lg min-w-[100px]">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  currentLangCode === lang.code ? 'bg-accent font-medium' : ''
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
