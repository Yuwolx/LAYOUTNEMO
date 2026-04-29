import type { CreateBlockAIInput, CreateBlockAIOutput } from "./types"
import type { AIErrorCode, AIErrorPayload } from "./schemas"

/**
 * 브라우저에서 호출하는 AI 클라이언트 래퍼. 실제 OpenAI 호출은 /app/api/ai/* 라우트에서 수행.
 *
 * 정책: 실패는 throw 한다. 호출 측에서 toast + fallback 결정.
 * fallback 도우미(`mockCreateBlockOutput`) 는 따로 export — 키워드 기반 추론으로 그럴듯한 값 생성.
 */

export class AIError extends Error {
  code: AIErrorCode
  constructor(payload: AIErrorPayload) {
    super(payload.message)
    this.name = "AIError"
    this.code = payload.code
  }
}

async function readError(response: Response): Promise<AIErrorPayload> {
  try {
    const body = await response.json()
    if (body?.error?.code && body?.error?.message) return body.error
  } catch {
    // ignore
  }
  return {
    code: "upstream_error",
    message: `Request failed with status ${response.status}.`,
  }
}

export async function createBlockWithAI(input: CreateBlockAIInput): Promise<CreateBlockAIOutput> {
  let response: Response
  try {
    response = await fetch("/api/ai/create-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    throw new AIError({ code: "network_error", message: "네트워크 연결을 확인해주세요." })
  }
  if (!response.ok) throw new AIError(await readError(response))
  return (await response.json()) as CreateBlockAIOutput
}

// ---------- Fallback 헬퍼 ----------

/**
 * 키워드 기반의 그럴듯한 블럭 생성 추론. AI 가 실패했을 때 사용자가 빈 상태로 멈추지 않도록.
 * 무작위 zone 을 고르던 기존 mock 보다 의도를 반영한다.
 */
export function mockCreateBlockOutput(input: CreateBlockAIInput): CreateBlockAIOutput {
  const text = input.userInput.trim()
  const lower = text.toLowerCase()

  // 제목: 첫 문장 또는 첫 6단어, 최대 30자
  const firstSentence = text.split(/[.!?\n]/)[0]
  const titleSource = firstSentence.length > 0 ? firstSentence : text
  const titleWords = titleSource.split(/\s+/).slice(0, 6).join(" ")
  const title = titleWords.length > 30 ? titleWords.slice(0, 28) + "…" : titleWords || "새 블럭"

  // 요약: 입력 그대로(짧으면) 또는 자른 버전
  const summary = text.length > 80 ? text.slice(0, 77) + "…" : text

  // 시급도 추정: 키워드 매칭
  const urgentKeywords = ["급해", "시급", "asap", "urgent", "빨리", "당장", "오늘", "내일까지"]
  const thinkingKeywords = ["고민", "아이디어", "생각", "검토", "탐색", "idea", "think"]
  const lingeringKeywords = ["미루", "언젠가", "나중에", "later", "someday"]

  let suggestedUrgency: CreateBlockAIOutput["suggestedUrgency"] = "stable"
  if (urgentKeywords.some((k) => lower.includes(k))) suggestedUrgency = "urgent"
  else if (thinkingKeywords.some((k) => lower.includes(k))) suggestedUrgency = "thinking"
  else if (lingeringKeywords.some((k) => lower.includes(k))) suggestedUrgency = "lingering"

  // zone 추정: zone label 부분 일치 → 일치 없으면 첫 zone
  const matched = input.zones.find((z) => {
    const label = z.label.toLowerCase()
    return lower.includes(label) || lower.includes(z.id.toLowerCase())
  })
  const zoneKeywordMap: Array<[string[], string]> = [
    [["디자인", "design", "ui", "ux"], "design"],
    [["개발", "코드", "버그", "develop", "code", "bug"], "development"],
    [["기획", "spec", "plan"], "planning"],
    [["마케팅", "광고", "marketing"], "marketing"],
  ]
  let suggestedZoneId = matched?.id
  if (!suggestedZoneId) {
    for (const [keys, zoneId] of zoneKeywordMap) {
      if (keys.some((k) => lower.includes(k)) && input.zones.some((z) => z.id === zoneId)) {
        suggestedZoneId = zoneId
        break
      }
    }
  }
  suggestedZoneId = suggestedZoneId ?? input.zones[0]?.id ?? "daily"

  // 기한 추정: "내일", "모레", "X일 후", "YYYY-MM-DD"
  let suggestedDueDate: string | null = null
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    suggestedDueDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  } else {
    const today = new Date()
    const offsetDay = (n: number) => {
      const d = new Date(today)
      d.setDate(today.getDate() + n)
      return d.toISOString().slice(0, 10)
    }
    if (lower.includes("오늘") || lower.includes("today")) suggestedDueDate = offsetDay(0)
    else if (lower.includes("내일") || lower.includes("tomorrow")) suggestedDueDate = offsetDay(1)
    else if (lower.includes("모레")) suggestedDueDate = offsetDay(2)
    else {
      const inDays = lower.match(/(\d+)\s*일\s*(후|뒤)/)
      if (inDays) suggestedDueDate = offsetDay(parseInt(inDays[1], 10))
    }
  }

  // URL 추출 — http(s) 로 시작하는 첫 토큰
  const urlMatch = text.match(/https?:\/\/\S+/)
  const suggestedUrl = urlMatch ? urlMatch[0].replace(/[.,;)\]]+$/, "") : null

  // 태그 추출 — [TAG] 패턴 우선, 없으면 null. 짧은 식별자만 인정 (한/영/숫자/하이픈, 20자 이하)
  let suggestedTag: string | null = null
  const tagMatch = text.match(/\[([^\]]{1,20})\]/)
  if (tagMatch) {
    const candidate = tagMatch[1].trim()
    if (candidate && /^[A-Za-z0-9가-힣_-]+$/.test(candidate.replace(/\s+/g, ""))) {
      suggestedTag = candidate
    }
  }

  return {
    title,
    summary,
    suggestedZone: suggestedZoneId,
    zoneReason: "키워드를 보고 임시로 골랐어요. 필요하면 직접 바꿔주세요.",
    suggestedDueDate,
    suggestedUrgency,
    suggestedUrl,
    suggestedTag,
  }
}
