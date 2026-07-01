"use client"

import { useEffect } from "react"

/**
 * 앱 트리(page + 캔버스/다이얼로그)에서 렌더 중 예외가 나면 흰 화면 대신 이 폴백을 보여준다.
 * 저장된 데이터는 localStorage/클라우드에 그대로 있으므로, 다시 시도 or 새로고침으로 복구 가능.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App render crashed:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf9] px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900">화면을 그리는 중 문제가 생겼어요</h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          저장된 내용은 그대로 있어요. 아래 버튼으로 다시 시도하거나 새로고침해 주세요.
          계속 반복되면 잠시 후 다시 열어보세요.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <button
            onClick={reset}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800"
          >
            다시 시도
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  )
}
