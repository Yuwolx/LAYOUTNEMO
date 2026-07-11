"use client"

import { useEffect, useState } from "react"

/**
 * 앱 트리(page + 캔버스/다이얼로그)에서 렌더 중 예외가 나면 흰 화면 대신 이 폴백을 보여준다.
 * 저장된 데이터는 localStorage/클라우드에 그대로 있으므로, 다시 시도 or 새로고침으로 복구 가능.
 *
 * LanguageProvider 트리 밖에서 렌더될 수 있으므로 useLanguage 를 못 쓴다 —
 * 저장된 언어 설정(layout_language) → 브라우저 언어 순으로 직접 판별한다.
 */
const COPY = {
  ko: {
    title: "화면을 그리는 중 문제가 생겼어요",
    body: "저장된 내용은 그대로 있어요. 아래 버튼으로 다시 시도하거나 새로고침해 주세요. 계속 반복되면 잠시 후 다시 열어보세요.",
    retry: "다시 시도",
    reload: "새로고침",
  },
  en: {
    title: "Something went wrong while rendering",
    body: "Your data is safe. Try again or reload the page below. If it keeps happening, come back in a moment.",
    retry: "Try again",
    reload: "Reload",
  },
}

function detectLanguage(): "ko" | "en" {
  if (typeof window === "undefined") return "ko"
  try {
    const saved = localStorage.getItem("layout_language")
    if (saved === "en" || saved === "ko") return saved
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 브라우저 언어로 폴백
  }
  const prefersKorean = (navigator.languages ?? [navigator.language]).some((l) => l?.toLowerCase().startsWith("ko"))
  return prefersKorean ? "ko" : "en"
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copy] = useState(() => COPY[detectLanguage()])

  useEffect(() => {
    console.error("App render crashed:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf9] px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900">{copy.title}</h1>
        <p className="text-sm leading-relaxed text-zinc-600">{copy.body}</p>
        <div className="flex justify-center gap-2 pt-1">
          <button
            onClick={reset}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800"
          >
            {copy.retry}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {copy.reload}
          </button>
        </div>
      </div>
    </div>
  )
}
