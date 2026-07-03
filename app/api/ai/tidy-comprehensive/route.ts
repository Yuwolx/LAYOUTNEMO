import { NextResponse } from "next/server"
import { tidyComprehensiveResponseSchema, type AIErrorPayload } from "@/lib/ai/schemas"
import { TIDY_COMPREHENSIVE_PROMPT } from "@/lib/ai/prompts"
import { URGENCY_META } from "@/lib/constants/urgency"
import type { WorkBlock, Zone } from "@/types"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { reserveAICredit, refundAICredit } from "@/lib/ai/quota"

// Vercel 함수 실행 상한. 기본값(10s)이면 OpenAI 응답이 늦을 때 함수가 중간에 죽어
// 크레딧 환불조차 못 한다. fetch 자체는 아래 FETCH_TIMEOUT_MS 로 먼저 끊어 환불 시간을 확보.
export const maxDuration = 60

const FETCH_TIMEOUT_MS = 45_000
// 토큰 비용 방어: 블럭 수·설명 길이·응답 크기 상한
const MAX_BLOCKS = 150
const MAX_DESC_CHARS = 300
// AI 역할이 결 오분류 + 인사이트로 줄어 응답도 짧다 (하이브리드 — lib/tidy/rules.ts 참고).
const MAX_COMPLETION_TOKENS = 1200

const errorResponse = (code: AIErrorPayload["code"], message: string, status: number) =>
  NextResponse.json<{ error: AIErrorPayload }>({ error: { code, message } }, { status })

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  let userId: string | null = null
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse("network_error", "Login required.", 401)
    userId = user.id
  }

  let input: { blocks: WorkBlock[]; zones: Zone[]; language?: "ko" | "en" }
  try {
    input = await req.json()
  } catch {
    return errorResponse("invalid_response", "Request body is not valid JSON.", 400)
  }
  const { blocks, zones, language } = input
  if (!Array.isArray(blocks) || !Array.isArray(zones)) {
    return errorResponse("invalid_response", "blocks and zones must be arrays.", 400)
  }
  const lang = language ?? "ko"

  // 블럭 수 상한 — 초과분은 잘라서 분석 (프롬프트 크기 = 토큰 비용 방어)
  const regularBlocks = blocks.filter((b) => !b.isGuide).slice(0, MAX_BLOCKS)

  if (regularBlocks.length === 0) {
    return NextResponse.json({
      stage: { stage: "complete", message: "분석할 블럭이 없습니다", progress: 100 },
      analysis: null,
      suggestions: [],
    })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return errorResponse("missing_api_key", "OPENAI_API_KEY is not configured.", 503)
  }

  // 월 사용량 한도 확인 + 크레딧 1 예약 (로그인 유저 한정). 호출 실패 시 아래에서 환불.
  if (!(await reserveAICredit(supabase, userId, "tidy"))) {
    return errorResponse(
      "quota_exceeded",
      "이번 달 정리하기 한도를 모두 사용했어요. 다음 달에 다시 충전돼요.",
      429,
    )
  }

  try {
    // 연결(유사도)·시급도(기한)·위치(분산도) 판단은 클라이언트 룰베이스(lib/tidy/rules.ts)로 이동.
    // AI 입력은 결 오분류 판단에 필요한 텍스트 맥락만 — 좌표·연결 정보를 빼서 프롬프트를 줄인다.
    const zoneMap = zones.reduce<Record<string, string>>((acc, z) => {
      acc[z.id] = z.label
      return acc
    }, {})

    const blockListText = regularBlocks
      .map((b, idx) => {
        const urgencyKey = b.urgency ?? "thinking"
        const urgencyLabel = URGENCY_META[urgencyKey]?.label ?? urgencyKey
        const description = (b.detailedNotes || b.description || "").slice(0, MAX_DESC_CHARS)
        return `${idx + 1}. [${b.id}] "${b.title}" — 결: ${zoneMap[b.zone] || b.zone || "미분류"}, 상태: ${urgencyLabel}, 기한: ${
          b.dueDate || "없음"
        }, 완료: ${b.isCompleted ? "예" : "아니오"}${description ? `\n   설명: ${description}` : ""}`
      })
      .join("\n")

    const zoneDefsText = zones.map((z) => `${z.id}=${z.label}`).join(", ")
    const completedCount = regularBlocks.filter((b) => b.isCompleted).length

    const prompt = TIDY_COMPREHENSIVE_PROMPT.replace("{TODAY}", new Date().toISOString().split("T")[0])
      .replace("{TOTAL}", String(regularBlocks.length))
      .replace("{COMPLETED}", String(completedCount))
      .replace("{BLOCK_LIST}", blockListText)
      .replace("{ZONE_DEFINITIONS}", zoneDefsText)

    const languageDirective =
      lang === "en"
        ? "All user-facing text (question, reason, insight) must be written in English."
        : "question, reason, insight 등 유저에게 노출되는 모든 텍스트는 한국어로 작성하라."

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a workspace analyst. Your only jobs: (1) spot blocks whose text content clearly belongs to a different facet (zone) than the one they are in, (2) give one insightful observation about the workspace as a whole. Numeric/positional analysis is handled elsewhere — do not suggest positions, connections, or urgency changes. " +
              languageDirective,
          },
          {
            role: "user",
            content: prompt + "\n\n" + languageDirective,
          },
        ],
        temperature: 0.6,
        max_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error("OpenAI API Error:", response.status, text)
      await refundAICredit(supabase, userId, "tidy")
      return errorResponse("upstream_error", `OpenAI returned ${response.status}.`, 502)
    }

    let raw: unknown
    try {
      const data = await response.json()
      raw = JSON.parse(data.choices?.[0]?.message?.content ?? "")
    } catch (err) {
      console.error("AI response not valid JSON:", err)
      await refundAICredit(supabase, userId, "tidy")
      return errorResponse("invalid_response", "AI response was not valid JSON.", 502)
    }

    const parsed = tidyComprehensiveResponseSchema.safeParse(raw)
    if (!parsed.success) {
      console.error("Tidy response failed schema validation:", parsed.error.format())
      await refundAICredit(supabase, userId, "tidy")
      return errorResponse(
        "invalid_response",
        "AI response did not match the expected shape.",
        502,
      )
    }

    // 이벤트 기록 (로그인 유저만). await 해야 실제 요청이 나가고 서버리스에서 유실되지 않는다.
    // 자체 try/catch 로 감싸 이벤트 실패가 바깥 catch(=AI 실패 처리)를 트리거하지 않도록 한다.
    if (supabase && userId) {
      try {
        await supabase.from("events").insert({ user_id: userId, name: "ai_tidy_used", payload: {} })
      } catch (e) {
        console.error("ai_tidy_used event insert failed:", e)
      }
    }

    return NextResponse.json({
      stage: { stage: "suggestions", message: "분석 완료", progress: 100 },
      analysis: parsed.data.analysis,
      suggestions: parsed.data.suggestions,
      currentSuggestionIndex: 0,
    })
  } catch (err) {
    console.error("Comprehensive tidy fetch failed:", err)
    await refundAICredit(supabase, userId, "tidy")
    return errorResponse("upstream_error", "Could not reach OpenAI.", 502)
  }
}
