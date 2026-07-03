"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

/**
 * PWA 설치 프롬프트 캡처 + 상태 훅.
 *
 * Chrome/Edge 는 설치 가능해지면 `beforeinstallprompt` 를 딱 한 번 쏜다.
 * 이 이벤트는 React 마운트보다 먼저 발생할 수 있어 모듈 평가 시점에 리스너를 건다.
 * preventDefault 로 브라우저 자동 미니배너를 막고, 사용자가 About 의
 * "앱으로 설치" 버튼을 눌렀을 때 우리가 프롬프트를 띄운다.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    notify()
  })
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function usePWAInstall() {
  // 원클릭 설치 가능 여부 (beforeinstallprompt 를 잡아둔 상태).
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferredPrompt !== null,
    () => false,
  )

  // iOS(iPadOS 포함) / 이미 standalone 실행 중 여부 — 클라이언트에서만 판별.
  const [env, setEnv] = useState({ isIOS: false, isStandalone: false })
  useEffect(() => {
    const ua = navigator.userAgent
    // iPadOS 는 UA 가 Macintosh 로 나오므로 터치점 수로 구분.
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
    setEnv({ isIOS, isStandalone })
  }, [])

  const promptInstall = useCallback(async () => {
    const evt = deferredPrompt
    if (!evt) return
    await evt.prompt()
    await evt.userChoice
    // 프롬프트는 1회용 — 수락/거절과 무관하게 소진된다.
    deferredPrompt = null
    notify()
  }, [])

  return { canPrompt, isIOS: env.isIOS, isStandalone: env.isStandalone, promptInstall }
}
