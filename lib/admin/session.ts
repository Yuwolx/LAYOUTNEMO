import { createHash } from "crypto"

/**
 * 어드민 세션 쿠키 값.
 * ADMIN_PASSWORD를 그대로 쿠키에 넣으면 쿠키 유출 = 비밀번호 유출이 되므로,
 * 해시값을 쿠키로 쓴다 — 유출되어도 원본 비밀번호를 복원할 수 없다.
 */
export function getAdminSessionToken(): string {
  return createHash("sha256").update(`admin-session:${process.env.ADMIN_PASSWORD}`).digest("hex")
}
