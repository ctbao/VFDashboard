import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// English namespaces
import enCommon from "./locales/en/common.json";
import enLogin from "./locales/en/login.json";
import enDashboard from "./locales/en/dashboard.json";
import enVehicle from "./locales/en/vehicle.json";
import enTelemetry from "./locales/en/telemetry.json";
import enAbout from "./locales/en/about.json";

// Vietnamese namespaces
import viCommon from "./locales/vi/common.json";
import viLogin from "./locales/vi/login.json";
import viDashboard from "./locales/vi/dashboard.json";
import viVehicle from "./locales/vi/vehicle.json";
import viTelemetry from "./locales/vi/telemetry.json";
import viAbout from "./locales/vi/about.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        login: enLogin,
        dashboard: enDashboard,
        vehicle: enVehicle,
        telemetry: enTelemetry,
        about: enAbout,
      },
      vi: {
        common: viCommon,
        login: viLogin,
        dashboard: viDashboard,
        vehicle: viVehicle,
        telemetry: viTelemetry,
        about: viAbout,
      },
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "vf_language",
      caches: ["localStorage"],
    },
    fallbackLng: "vi",
    defaultNS: "common",
    ns: ["common", "login", "dashboard", "vehicle", "telemetry", "about"],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
