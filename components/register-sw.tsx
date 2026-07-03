"use client"

import { useEffect } from "react"

/** PWA 서비스워커 등록. 프로덕션에서만 — dev 는 HMR 과 캐시가 충돌한다. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err)
    })
  }, [])

  return null
}
