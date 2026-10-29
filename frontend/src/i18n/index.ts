import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';
import { loadSettings } from '../services/settings';

// Locales are flat key -> string maps; keys.json is the agreed key list (English drafts), so turn off key/namespace separators.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, mr: { translation: mr } },
  lng: loadSettings().lang,
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

const setHtmlLang = (lng: string) => document.documentElement.setAttribute('lang', lng);
setHtmlLang(i18n.language);
i18n.on('languageChanged', setHtmlLang);

export default i18n;
