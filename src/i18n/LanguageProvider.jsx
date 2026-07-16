import { useCallback, useMemo } from 'react';
import { pl, enUS } from 'date-fns/locale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LanguageContext } from './context';
import { translate, LANGUAGES } from './translations';

const DATE_LOCALES = { en: enUS, pl: pl };

function detectLanguage() {
  try {
    return navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'en';
  }
}

function LanguageProvider({ children }) {
  const [storedLang, setLang] = useLocalStorage('language', detectLanguage());
  const lang = LANGUAGES.includes(storedLang) ? storedLang : 'en';

  const t = useCallback((key, params) => translate(lang, key, params), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, dateLocale: DATE_LOCALES[lang] }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageProvider;
