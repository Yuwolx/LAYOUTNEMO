/**
 * LAYOUTNEMO 서비스워커 — PWA 오프라인 + 캐시 전략.
 *
 * 전략 (배포가 잦은 프로젝트라 "옛 버전이 계속 보이는" 사고를 피하는 게 최우선):
 * - 페이지 내비게이션(HTML): network-first — 온라인이면 항상 최신 배포를 받고,
 *   오프라인일 때만 캐시로 폴백. 서비스워커 버전 갱신 문제의 대부분을 회피한다.
 * - /_next/static (해시된 불변 자산) + /icons: cache-first — 내용이 바뀌면 URL 이 바뀐다.
 * - /api, /auth: 가로채지 않음 — AI 응답·동기화·로그인이 캐시되면 안 된다.
 * - 크로스 오리진(Supabase, Google 등): 가로채지 않음.
 */
const VERSION = "v1"
const PAGE_CACHE = `pages-${VERSION}`
const STATIC_CACHE = `static-${VERSION}`
const KNOWN_CACHES = [PAGE_CACHE, STATIC_CACHE]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add("/"))
      // 첫 방문 중 오프라인 전환 대비 프리캐시. 실패해도 설치는 계속.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return

  // HTML 내비게이션: network-first, 오프라인이면 캐시 폴백.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/")),
        ),
    )
    return
  }

  // 불변 정적 자산: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            return response
          }),
      ),
    )
  }
  // 그 외(이미지 등)는 브라우저 기본 처리에 맡긴다.
})
