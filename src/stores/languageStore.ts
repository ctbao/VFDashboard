import { atom, onMount } from "nanostores";

export type Language = "vi" | "en";

const LANG_KEY = "vf_language";

export const currentLanguage = atom<Language>("vi");

onMount(currentLanguage, () => {
  if (typeof window === "undefined") return;

  try {
    const saved = window.localStorage.getItem(LANG_KEY) as Language | null;
    if (saved === "vi" || saved === "en") {
      currentLanguage.set(saved);
      document.documentElement.lang = saved;
    } else {
      // Auto-detect from browser on first visit
      const browserLang = navigator.language || "";
      const detected: Language = browserLang.toLowerCase().startsWith("vi")
        ? "vi"
        : "en";
      currentLanguage.set(detected);
      document.documentElement.lang = detected;
      window.localStorage.setItem(LANG_KEY, detected);
    }
  } catch (e) {
    // localStorage unavailable — fall back to default store value
  }
});

export function setLanguage(lang: Language): void {
  currentLanguage.set(lang);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      // localStorage unavailable — preference won't persist, but UI still updates
    }
    document.documentElement.lang = lang;
  }
}
