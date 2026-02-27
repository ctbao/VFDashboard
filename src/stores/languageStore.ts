import { atom, onMount } from "nanostores";

export type Language = "vi" | "en";

const LANG_KEY = "vf_language";

export const currentLanguage = atom<Language>("vi");

onMount(currentLanguage, () => {
  if (typeof window === "undefined") return;

  const saved = window.localStorage.getItem(LANG_KEY) as Language | null;
  if (saved === "vi" || saved === "en") {
    currentLanguage.set(saved);
  } else {
    // Auto-detect from browser on first visit
    const browserLang = navigator.language || "";
    const detected: Language = browserLang.toLowerCase().startsWith("vi")
      ? "vi"
      : "en";
    currentLanguage.set(detected);
    window.localStorage.setItem(LANG_KEY, detected);
  }
});

export function setLanguage(lang: Language): void {
  currentLanguage.set(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }
}
