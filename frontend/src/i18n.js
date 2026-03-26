import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

const supportedLanguages = ["en", "fr"];
const fallbackLanguage = "en";

function getStoredLanguage() {
  try {
    const storedLanguage = localStorage.getItem("language");
    return supportedLanguages.includes(storedLanguage)
      ? storedLanguage
      : fallbackLanguage;
  } catch {
    return fallbackLanguage;
  }
}

function applyDocumentLanguage(language) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

const initialLanguage = getStoredLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: en,
    },
    fr: {
      translation: fr,
    },
  },
  lng: initialLanguage,
  fallbackLng: fallbackLanguage,
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

i18n.on("languageChanged", (language) => {
  const safeLanguage = supportedLanguages.includes(language)
    ? language
    : fallbackLanguage;

  try {
    localStorage.setItem("language", safeLanguage);
  } catch {
    // ignore storage errors
  }

  applyDocumentLanguage(safeLanguage);
});

applyDocumentLanguage(initialLanguage);

export default i18n;