import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getSavedLanguage } from '@/services/language-storage';

import en from './en.json';
import ka from './ka.json';

// Georgian if the phone is set to Georgian, English for everything else
const deviceLanguage = getLocales()[0]?.languageCode;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ka: { translation: ka },
  },
  lng: deviceLanguage === 'ka' ? 'ka' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// A language the user picked earlier wins over the phone language
void getSavedLanguage().then((saved) => {
  if (saved !== null && saved !== i18n.language) {
    void i18n.changeLanguage(saved);
  }
});

export default i18n;