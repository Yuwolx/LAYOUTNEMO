import { z } from "zod"

/**
 * AI 응답 런타임 검증 스키마.
 * OpenAI 가 JSON object 를 보장하더라도 필드 누락/타입 변동 가능성 → 런타임에 한 번 더 검증.
 */

export const createBlockAIOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  suggestedZone: z.string().min(1),
  zoneReason: z.string(),
  suggestedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  suggestedUrgency: z.enum(["stable", "thinking", "lingering", "urgent"]),
})

const fieldChangeValueSchema = z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.boolean(),
  z.null(),
])

export const tidyComprehensiveResponseSchema = z.object({
  analysis: z.object({
    totalBlocks: z.number(),
    completedBlocks: z.number().optional(),
    zoneDistribution: z.record(z.string(), z.number()),
    connectionIssues: z.array(z.string()).default([]),
    positionIssues: z.array(z.string()).default([]),
    urgencyIssues: z.array(z.string()).default([]),
    overallHealth: z.enum(["good", "needs_attention", "critical"]),
    insight: z.string().optional(),
  }),
  suggestions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["position", "urgency", "zone", "connection", "cleanup"]),
        priority: z.enum(["high", "medium", "low"]),
        blockIds: z.array(z.string()),
        question: z.string(),
        changes: z.array(
          z.object({
            blockId: z.string(),
            field: z.string(),
            currentValue: fieldChangeValueSchema,
            suggestedValue: fieldChangeValueSchema,
            reason: z.string(),
          }),
        ),
      }),
    )
    .default([]),
})

export type CreateBlockAIOutputValidated = z.infer<typeof createBlockAIOutputSchema>
export type TidyComprehensiveResponseValidated = z.infer<typeof tidyComprehensiveResponseSchema>

/** 표준 AI 에러 코드 — 클라이언트가 사용자에게 메시지를 정하는 데 쓰임. */
export type AIErrorCode =
  | "missing_api_key"   // 서버에 OPENAI_API_KEY 없음
  | "upstream_error"    // OpenAI 호출 실패
  | "invalid_response"  // JSON 파싱/스키마 검증 실패
  | "network_error"     // 클라이언트 fetch 실패

export interface AIErrorPayload {
  code: AIErrorCode
  message: string
}
