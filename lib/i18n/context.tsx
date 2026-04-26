"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { DICT, type Language, type TranslationKey } from "./dictionary"

const LANGUAGE_STORAGE_KEY = "layout_language"
const DEFAULT_LANGUAGE: Language = "ko"

type LanguageContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === "ko" || saved === "en") setLanguageState(saved)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    }
  }

  const toggleLanguage = () => setLanguage(language === "ko" ? "en" : "ko")

  const t = (key: TranslationKey): string => {
    const pack = DICT[language] as Record<string, string>
    return pack[key] ?? DICT.ko[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within <LanguageProvider>")
  return ctx
}

export function useT() {
  return useLanguage().t
}
