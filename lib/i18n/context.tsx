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
    if (saved === "ko" || saved === "en") {
      setLanguageState(saved)
      return
    }
    // 첫 방문(저장값 없음): OS/브라우저 언어를 따른다 — 한국어 계열이 아니면 영어.
    // (해외 방문자가 한국어 화면을 만나지 않도록. 명시 저장은 안 해 이후 OS 변경도 반영.)
    const prefersKorean = (navigator.languages ?? [navigator.language]).some((l) => l?.toLowerCase().startsWith("ko"))
    if (!prefersKorean) setLanguageState("en")
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
