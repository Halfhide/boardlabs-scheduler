import { useContext } from 'react';
import { LanguageContext } from './context';

/**
 * Access the active language: { t, lang, setLang, dateLocale }.
 * `t(key, params)` resolves a UI string; `dateLocale` is the matching
 * date-fns locale for format()/formatDistanceToNow() calls.
 */
export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used inside LanguageProvider');
  }
  return context;
}

/**
 * Translate an error thrown by poll helpers: errors carry a `code`
 * matching a dictionary key (plus optional params); anything else
 * falls back to the given generic message key.
 */
export function translateError(t, err, fallbackKey = 'actionFailed') {
  if (err?.code && t(err.code) !== err.code) {
    return t(err.code, err.params);
  }
  return t(fallbackKey);
}
