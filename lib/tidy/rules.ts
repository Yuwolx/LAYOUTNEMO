import type { WorkBlock } from "@/types"
import type { TidyDetailedSuggestion } from "@/lib/ai/types"
import { URGENCY_META } from "@/lib/constants/urgency"

/**
 * 정리하기 룰베이스 제안 엔진 — 클라이언트에서 0초에 계산.
 *
 * 역할 분담 (하이브리드 정리하기):
 * - 룰(여기): 숫자·좌표·날짜로 판정 가능한 것 — 연결 후보(유사도), 기한 임박(시급도), 위치 정리(분산도)
 * - AI(tidy-comprehensive 라우트): 의미 판단이 필요한 것 — 결 오분류, 전체 인사이트
 * 카테고리가 겹치지 않으므로 중복 제안이 구조적으로 발생하지 않는다.
 */

const SIMILARITY_THRESHOLD = 50
const MAX_CONNECTION_SUGGESTIONS = 4
const MAX_URGENCY_SUGGESTIONS = 4
// 기한이 이 일수 이내(또는 지남)인데 시급이 아니면 제안.
const DUE_SOON_DAYS = 3
// 결 중심(centroid)에서 이보다 멀리 떨어진 블럭을 "흩어짐"으로 판정.
const DISPERSION_THRESHOLD = 700
// 모으기 제안 시 중심에서 이 반경의 링 위로 배치 (그대로 중심에 두면 블럭이 겹친다).
const GATHER_RADIUS = 280
const MAX_POSITION_ZONES = 2

type Lang = "ko" | "en"

/** 라우트에 있던 유사도 계산을 클라이언트로 이식 — 결 > 텍스트 키워드 > 상태 > 위치 근접 순 가중치. */
function blockSimilarity(a: WorkBlock, b: WorkBlock): number {
  let similarity = 0
  if (a.zone === b.zone) similarity += 30

  const text1 = `${a.title} ${a.detailedNotes || a.description || ""}`.toLowerCase()
  const text2 = `${b.title} ${b.detailedNotes || b.description || ""}`.toLowerCase()
  const words1 = text1.split(/\s+/).filter((w) => w.length > 1)
  const words2 = new Set(text2.split(/\s+/))
  const commonCount = words1.filter((w) => words2.has(w)).length
  if (commonCount > 0) similarity += Math.min(20, commonCount * 5)

  if (a.urgency === b.urgency) similarity += 5

  const distance = Math.hypot(a.x - b.x, a.y - b.y)
  similarity += Math.max(0, 15 - distance / 40)

  return similarity
}

function daysUntil(dueDate: string, today: Date): number {
  const due = new Date(`${dueDate}T00:00:00`)
  return Math.floor((due.getTime() - new Date(today.toDateString()).getTime()) / 86_400_000)
}

export function generateRuleSuggestions(
  allBlocks: WorkBlock[],
  zones: Array<{ id: string; label: string }>,
  language: Lang,
  today: Date = new Date(),
): TidyDetailedSuggestion[] {
  const blocks = allBlocks.filter((b) => !b.isGuide && !b.isCompleted && !b.isDeleted)
  const suggestions: TidyDetailedSuggestion[] = []
  const zoneLabel = (id: string) => zones.find((z) => z.id === id)?.label ?? id

  // ── 1. 기한 임박인데 시급이 아님 ─────────────────────────
  const dueSoon = blocks
    .filter((b) => b.dueDate && (b.urgency ?? "thinking") !== "urgent")
    .map((b) => ({ block: b, days: daysUntil(b.dueDate!, today) }))
    .filter(({ days }) => days <= DUE_SOON_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, MAX_URGENCY_SUGGESTIONS)

  dueSoon.forEach(({ block, days }) => {
    const current = block.urgency ?? "thinking"
    const currentLabel = URGENCY_META[current]?.label ?? current
    const dueText =
      language === "en"
        ? days < 0
          ? `${-days} day(s) overdue`
          : days === 0
            ? "due today"
            : `due in ${days} day(s)`
        : days < 0
          ? `기한이 ${-days}일 지났는데`
          : days === 0
            ? "기한이 오늘인데"
            : `기한이 ${days}일 남았는데`
    suggestions.push({
      id: `rule-urgency-${block.id}`,
      type: "urgency",
      priority: days <= 0 ? "high" : "medium",
      blockIds: [block.id],
      question:
        language === "en"
          ? `"${block.title}" is ${dueText} but marked ${currentLabel}. Mark it urgent?`
          : `'${block.title}' — ${dueText} 상태가 '${currentLabel}'이에요. 시급으로 바꿀까요?`,
      changes: [
        {
          blockId: block.id,
          field: "urgency",
          currentValue: current,
          suggestedValue: "urgent",
          reason:
            language === "en"
              ? `Due date ${block.dueDate}, currently ${currentLabel}`
              : `기한 ${block.dueDate}, 현재 상태 ${currentLabel}`,
        },
      ],
    })
  })

  // ── 2. 유사한데 미연결 ───────────────────────────────────
  const pairs: Array<{ a: WorkBlock; b: WorkBlock; score: number }> = []
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]
      const b = blocks[j]
      if (a.relatedTo?.includes(b.id) || b.relatedTo?.includes(a.id)) continue
      const score = blockSimilarity(a, b)
      if (score > SIMILARITY_THRESHOLD) pairs.push({ a, b, score })
    }
  }
  pairs
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_CONNECTION_SUGGESTIONS)
    .forEach(({ a, b, score }) => {
      suggestions.push({
        id: `rule-connection-${a.id}-${b.id}`,
        type: "connection",
        priority: score >= 70 ? "high" : "medium",
        blockIds: [a.id, b.id],
        question:
          language === "en"
            ? `"${a.title}" and "${b.title}" look related (${Math.round(score)}%). Connect them?`
            : `'${a.title}' 와 '${b.title}' 가 비슷해 보여요 (유사도 ${Math.round(score)}%). 연결할까요?`,
        changes: [
          {
            blockId: a.id,
            field: "relatedTo",
            currentValue: a.relatedTo ?? [],
            suggestedValue: [...new Set([...(a.relatedTo ?? []), b.id])],
            reason: language === "en" ? "Similar content, not yet connected" : "내용이 비슷한데 아직 연결되지 않음",
          },
          {
            blockId: b.id,
            field: "relatedTo",
            currentValue: b.relatedTo ?? [],
            suggestedValue: [...new Set([...(b.relatedTo ?? []), a.id])],
            reason: language === "en" ? "Similar content, not yet connected" : "내용이 비슷한데 아직 연결되지 않음",
          },
        ],
      })
    })

  // ── 3. 같은 결 블럭이 흩어짐 ─────────────────────────────
  const byZone = new Map<string, WorkBlock[]>()
  blocks.forEach((b) => {
    if (!b.zone) return
    const list = byZone.get(b.zone) ?? []
    list.push(b)
    byZone.set(b.zone, list)
  })

  const scattered: Array<{ zoneId: string; outliers: Array<{ block: WorkBlock; dist: number }>; cx: number; cy: number }> = []
  byZone.forEach((zoneBlocks, zoneId) => {
    if (zoneBlocks.length < 3) return
    const cx = zoneBlocks.reduce((s, b) => s + b.x + b.width / 2, 0) / zoneBlocks.length
    const cy = zoneBlocks.reduce((s, b) => s + b.y + b.height / 2, 0) / zoneBlocks.length
    const outliers = zoneBlocks
      .map((block) => ({ block, dist: Math.hypot(block.x + block.width / 2 - cx, block.y + block.height / 2 - cy) }))
      .filter(({ dist }) => dist > DISPERSION_THRESHOLD)
      .sort((a, b) => b.dist - a.dist)
      .slice(0, 3)
    if (outliers.length > 0) scattered.push({ zoneId, outliers, cx, cy })
  })

  scattered
    .sort((a, b) => b.outliers[0].dist - a.outliers[0].dist)
    .slice(0, MAX_POSITION_ZONES)
    .forEach(({ zoneId, outliers, cx, cy }) => {
      const label = zoneLabel(zoneId)
      suggestions.push({
        id: `rule-position-${zoneId}`,
        type: "position",
        priority: "medium",
        blockIds: outliers.map(({ block }) => block.id),
        question:
          language === "en"
            ? `${outliers.length} "${label}" block(s) drifted far from the rest. Gather them?`
            : `'${label}' 결 블럭 ${outliers.length}개가 멀리 떨어져 있어요. 근처로 모아둘까요?`,
        changes: outliers.flatMap(({ block, dist }) => {
          // 중심 방향은 유지한 채 링 반경 위로 — 중심에 그대로 두면 서로 겹친다.
          const dirX = (block.x + block.width / 2 - cx) / dist
          const dirY = (block.y + block.height / 2 - cy) / dist
          const targetX = cx + dirX * GATHER_RADIUS - block.width / 2
          const targetY = cy + dirY * GATHER_RADIUS - block.height / 2
          const reason =
            language === "en"
              ? `${Math.round(dist)}px from the ${label} cluster center`
              : `${label} 결 중심에서 ${Math.round(dist)}px 떨어짐`
          return [
            { blockId: block.id, field: "x", currentValue: block.x, suggestedValue: Math.round(targetX), reason },
            { blockId: block.id, field: "y", currentValue: block.y, suggestedValue: Math.round(targetY), reason },
          ]
        }),
      })
    })

  return suggestions
}
