import type { createSupabaseServerClient } from "@/lib/supabase/server"
import { isMasterEmail } from "@/lib/constants/master"

/**
 * AI 무료 플랜 월 사용량 한도.
 * - create: 블럭 생성 (자연어 → 구조화 블럭)
 * - tidy: 정리하기(Reflection) 종합 분석
 * 두 카운터는 별도 예산이며, user_profiles.ai_create_reset_at 월 경계를 공유한다.
 * pro 플랜은 DB 함수에서 무제한 처리된다.
 */
export const AI_LIMITS = { create: 300, tidy: 10 } as const
export type AIKind = keyof typeof AI_LIMITS

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * 크레딧 1 예약 (원자적 check-and-increment).
 * @returns true = 허용(차감 완료), false = 이번 달 한도 초과
 *
 * supabase 미구성/비로그인이면 한도 대상이 아니므로 true.
 * 쿼터 시스템 자체가 오류나면(예: 마이그레이션 미적용) 사용자를 막기보다 통과(fail-open)하고 로그만 남긴다.
 */
export async function reserveAICredit(
  supabase: ServerClient,
  userId: string | null,
  kind: AIKind,
  email?: string | null,
): Promise<boolean> {
  if (!supabase || !userId) return true
  // 마스터 계정은 한도 없음 — 크레딧 차감도 하지 않는다
  if (isMasterEmail(email)) return true
  const { data, error } = await supabase.rpc("consume_ai_credit", {
    p_kind: kind,
    p_limit: AI_LIMITS[kind],
  })
  if (error) {
    console.error("consume_ai_credit failed (fail-open):", error.message)
    return true
  }
  return data !== -1
}

/** 예약했던 크레딧 1 반환 (OpenAI 호출이 끝내 실패했을 때). */
export async function refundAICredit(
  supabase: ServerClient,
  userId: string | null,
  kind: AIKind,
  email?: string | null,
): Promise<void> {
  if (!supabase || !userId) return
  // 마스터 계정은 차감한 적이 없으므로 환불도 없음
  if (isMasterEmail(email)) return
  const { error } = await supabase.rpc("refund_ai_credit", { p_kind: kind })
  if (error) console.error("refund_ai_credit failed:", error.message)
}
