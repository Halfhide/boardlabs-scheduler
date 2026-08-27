import { useCallback, useMemo } from 'react';
import { pl, enUS } from 'date-fns/locale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LanguageContext } from './context';
import { translate, LANGUAGES } from './translations';

const DATE_LOCALES = { en: enUS, pl: pl };

// A ?lang=en|pl query param wins once, then is stripped from the
// URL. The landing links to the app with it (its language choice
// lives on another origin, so this is the handoff): a reader of the
// Polish landing page gets the Polish app, whatever this origin's
// stored language says.
function langFromUrl() {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('lang');
    if (!LANGUAGES.includes(param)) return null;
    url.searchParams.delete('lang');
    window.history.replaceState({}, '', url);
    // Written straight into storage (same JSON shape useLocalStorage
    // uses) so the provider's initializer below picks it up even
    // when a different language was stored before
    window.localStorage.setItem('language', JSON.stringify(param));
    return param;
  } catch {
    return null;
  }
}

function detectLanguage() {
  try {
    return navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'en';
  }
}

const urlLang = langFromUrl();

function LanguageProvider({ children }) {
  const [storedLang, setLang] = useLocalStorage('language', urlLang || detectLanguage());
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
