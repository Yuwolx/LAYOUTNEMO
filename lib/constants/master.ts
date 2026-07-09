/**
 * 마스터 계정 단일 소스.
 *
 * 마스터 계정은 서비스 운영자 본인 계정으로:
 * - AI 월 사용량 한도(quota)를 우회한다
 * - "준비 중" 게이트가 걸린 기능(개인 인사이트 등)을 즉시 사용한다
 *
 * 이메일은 클라이언트 번들에도 포함되므로 비밀값이 아니라 식별자로만 쓴다.
 * 권한 부여 자체는 항상 서버(세션의 auth.getUser() 이메일)에서 판정한다.
 */
export const MASTER_EMAILS = ["gurwns199@gachon.ac.kr"] as const

export function isMasterEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return (MASTER_EMAILS as readonly string[]).includes(normalized)
}
