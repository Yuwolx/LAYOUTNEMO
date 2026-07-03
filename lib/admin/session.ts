import { createHmac, timingSafeEqual } from "crypto"

/**
 * 어드민 세션 쿠키 값.
 *
 * 과거: sha256(ADMIN_PASSWORD) 고정 토큰 — 서버측 만료가 없어 쿠키가 한 번
 * 유출되면 비밀번호를 바꾸기 전까지 영구히 유효했다.
 * 현재: HMAC 서명된 만료시각 토큰(`<expiresAt>.<sig>`) — 서버가 만료를 강제하고,
 * 서명 키(ADMIN_SESSION_SECRET, 없으면 ADMIN_PASSWORD)를 바꾸면 기존 토큰이
 * 전부 무효화된다. 상태 저장 없이(서버리스) 동작한다.
 */

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ""
}

function sign(expiresAt: number): string {
  return createHmac("sha256", sessionSecret()).update(`admin-session:${expiresAt}`).digest("hex")
}

export function createAdminSessionToken(maxAgeSeconds: number): string {
  const expiresAt = Date.now() + maxAgeSeconds * 1000
  return `${expiresAt}.${sign(expiresAt)}`
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token || !sessionSecret()) return false
  const dot = token.indexOf(".")
  if (dot <= 0) return false
  const expiresAt = Number(token.slice(0, dot))
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false
  return safeEqual(token.slice(dot + 1), sign(expiresAt))
}

/** 문자열 비교 시간이 내용에 따라 달라지지 않는 비교 (자격증명·토큰 비교용) */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // timingSafeEqual 은 같은 길이만 받으므로, 더미 비교로 시간을 균일화하고 false
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
