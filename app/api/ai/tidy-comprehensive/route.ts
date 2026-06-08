import { NextResponse } from "next/server"
import { tidyComprehensiveResponseSchema, type AIErrorPayload } from "@/lib/ai/schemas"
import { TIDY_COMPREHENSIVE_PROMPT } from "@/lib/ai/prompts"
import { URGENCY_META } from "@/lib/constants/urgency"
import type { WorkBlock, Zone } from "@/types"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const errorResponse = (code: AIErrorPayload["code"], message: string, status: number) =>
  NextResponse.json<{ error: AIErrorPayload }>({ error: { code, message } }, { status })

function analyzeBlockClusters(blocks: WorkBlock[], zones: Zone[]) {
  const zoneClusters: Record<string, WorkBlock[]> = {}
  const urgencyClusters: Record<string, WorkBlock[]> = {}

  blocks.forEach((b) => {
    if (!zoneClusters[b.zone]) zoneClusters[b.zone] = []
    zoneClusters[b.zone].push(b)

    const urgencyKey = b.urgency ?? "thinking"
    if (!urgencyClusters[urgencyKey]) urgencyClusters[urgencyKey] = []
    urgencyClusters[urgencyKey].push(b)
  })

  // 영역별 분산도 계산 (같은 영역 블록들이 얼마나 퍼져있는지)
  const zoneDispersion: Record<string, number> = {}
  Object.entries(zoneClusters).forEach(([zoneId, zoneBlocks]) => {
    if (zoneBlocks.length < 2) {
      zoneDispersion[zoneId] = 0
      return
    }

    // 중심점 계산
    const centerX = zoneBlocks.reduce((sum, b) => sum + b.x, 0) / zoneBlocks.length
    const centerY = zoneBlocks.reduce((sum, b) => sum + b.y, 0) / zoneBlocks.length

    // 평균 거리 계산
    const avgDistance =
      zoneBlocks.reduce((sum, b) => {
        return sum + Math.sqrt(Math.pow(b.x - centerX, 2) + Math.pow(b.y - centerY, 2))
      }, 0) / zoneBlocks.length

    zoneDispersion[zoneId] = Math.round(avgDistance)
  })

  return { zoneClusters, urgencyClusters, zoneDispersion }
}

function calculateBlockSimilarity(block1: WorkBlock, block2: WorkBlock): number {
  let similarity = 0

  // 우선순위: 결 > 제목/설명 키워드 > 위치 근접

  // 1. 영역(결) 동일
  if (block1.zone === block2.zone) similarity += 30

  // 2. 제목 + 설명 키워드 공통
  const text1 = `${block1.title} ${block1.description || ""}`.toLowerCase()
  const text2 = `${block2.title} ${block2.description || ""}`.toLowerCase()
  const words1 = text1.split(/\s+/).filter((w) => w.length > 1)
  const words2 = new Set(text2.split(/\s+/))
  const commonCount = words1.filter((w) => words2.has(w)).length
  if (commonCount > 0) similarity += Math.min(20, commonCount * 5)

  // 3. 상태 동일 — 보조 신호
  if (block1.urgency === block2.urgency) similarity += 5

  // 4. 위치 근접 — 가까울수록 약간 가산 (최대 15)
  const distance = Math.sqrt(Math.pow(block1.x - block2.x, 2) + Math.pow(block1.y - block2.y, 2))
  similarity += Math.max(0, 15 - distance / 40)

  return similarity
}

export async function POST(req: Request) {
  let input: { blocks: WorkBlock[]; zones: Zone[]; language?: "ko" | "en" }
  try {
    input = await req.json()
  } catch {
    return errorResponse("invalid_response", "Request body is not valid JSON.", 400)
  }
  const { blocks, zones, language } = input
  const lang = language ?? "ko"

  const regularBlocks = blocks.filter((b) => !b.isGuide)

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

  try {

    const { zoneClusters, urgencyClusters, zoneDispersion } = analyzeBlockClusters(regularBlocks, zones)

    // 연결 누락 찾기
    const potentialConnections: Array<{ block1: string; block2: string; similarity: number }> = []
    for (let i = 0; i < regularBlocks.length; i++) {
      for (let j = i + 1; j < regularBlocks.length; j++) {
        const b1 = regularBlocks[i]
        const b2 = regularBlocks[j]

        // 이미 연결되어 있으면 스킵
        if (b1.relatedTo?.includes(b2.id) || b2.relatedTo?.includes(b1.id)) continue

        const similarity = calculateBlockSimilarity(b1, b2)
        if (similarity > 50) {
          potentialConnections.push({
            block1: b1.id,
            block2: b2.id,
            similarity: Math.round(similarity),
          })
        }
      }
    }

    // 우선순위순으로 정렬
    potentialConnections.sort((a, b) => b.similarity - a.similarity)

    const blockSummary = regularBlocks.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description || "",
      zone: b.zone,
      urgency: b.urgency,
      dueDate: b.dueDate || null,
      position: { x: b.x, y: b.y },
      connections: b.relatedTo || [],
      isCompleted: b.isCompleted || false,
    }))

    const zoneMap = zones.reduce<Record<string, string>>((acc, z) => {
      acc[z.id] = z.label
      return acc
    }, {})

    const blockListText = blockSummary
      .map(
        (b, idx) => {
          const urgencyKey = b.urgency ?? "thinking"
          const urgencyLabel = URGENCY_META[urgencyKey]?.label ?? urgencyKey
          return `${idx + 1}. [${b.id}] "${b.title}" — 영역: ${zoneMap[b.zone] || b.zone}, 상태: ${urgencyLabel}, 위치: (${Math.round(
            b.position.x,
          )}, ${Math.round(b.position.y)}), 기한: ${b.dueDate || "없음"}, 연결: ${
            b.connections.length > 0 ? b.connections.join(", ") : "없음"
          }, 완료: ${b.isCompleted ? "예" : "아니오"}${b.description ? `\n   설명: ${b.description}` : ""}`
        },
      )
      .join("\n")

    const dispersionText = Object.entries(zoneDispersion)
      .map(([zone, dist]) => `${zoneMap[zone]}: ${dist}px`)
      .join(", ")

    const potentialText = potentialConnections
      .slice(0, 5)
      .map((c) => {
        const b1 = regularBlocks.find((b) => b.id === c.block1)
        const b2 = regularBlocks.find((b) => b.id === c.block2)
        return `"${b1?.title}" ↔ "${b2?.title}" (${c.similarity}%)`
      })
      .join(" / ")

    const zoneDefsText = zones.map((z) => `${z.id}=${z.label}`).join(", ")
    const completedCount = regularBlocks.filter((b) => b.isCompleted).length

    // urgencyClusters 는 분석용으로만 사용 (현재 미사용 suppress)
    void urgencyClusters

    const prompt = TIDY_COMPREHENSIVE_PROMPT.replace("{TOTAL}", String(regularBlocks.length))
      .replace("{COMPLETED}", String(completedCount))
      .replace("{BLOCK_LIST}", blockListText)
      .replace("{ZONE_DEFINITIONS}", zoneDefsText)
      .replace("{ZONE_DISPERSION}", dispersionText || "없음")
      .replace("{POTENTIAL_CONNECTIONS}", potentialText || "없음")

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
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert workspace analyst specializing in spatial organization and cognitive ergonomics. You excel at optimizing block positions to create intuitive, efficient layouts that minimize cognitive load and maximize workflow clarity. " +
              languageDirective,
          },
          {
            role: "user",
            content: prompt + "\n\n" + languageDirective,
          },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error("OpenAI API Error:", response.status, text)
      return errorResponse("upstream_error", `OpenAI returned ${response.status}.`, 502)
    }

    let raw: unknown
    try {
      const data = await response.json()
      raw = JSON.parse(data.choices?.[0]?.message?.content ?? "")
    } catch (err) {
      console.error("AI response not valid JSON:", err)
      return errorResponse("invalid_response", "AI response was not valid JSON.", 502)
    }

    const parsed = tidyComprehensiveResponseSchema.safeParse(raw)
    if (!parsed.success) {
      console.error("Tidy response failed schema validation:", parsed.error.format())
      return errorResponse(
        "invalid_response",
        "AI response did not match the expected shape.",
        502,
      )
    }

    // 이벤트 기록 (로그인 유저만)
    const supabase = await createSupabaseServerClient()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        supabase.from("events").insert({ user_id: user.id, name: "ai_tidy_used", payload: {} })
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
    return errorResponse("upstream_error", "Could not reach OpenAI.", 502)
  }
}
