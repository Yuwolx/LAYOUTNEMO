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
// 정렬 격자 간격 — 캔버스 배경 도트(48px)의 절반. 줄/열 목표값을 여기에 스냅.
const ALIGN_GRID = 24
// 이 이내로 어긋난 블럭들은 "같은 줄/열에 두려던 의도"로 판정해 칼같이 맞춘다.
// (격자 스냅만으로는 최대 12px 이동이라 눈에 안 보인다 — 정렬은 서로에 대한 것.)
const ALIGN_TOLERANCE = 48
const ALIGN_EPSILON = 1
const MIN_ALIGN_BLOCKS = 2
// 모으기 배치 시 블럭 간 최소 간격. 겹치면 중심 반대 방향으로 이만큼씩 밀어낸다.
const GATHER_GAP = 24
const GATHER_STEP = 48

const snapToGrid = (v: number) => Math.round(v / ALIGN_GRID) * ALIGN_GRID

type Rect = { x: number; y: number; width: number; height: number }

const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + GATHER_GAP &&
  a.x + a.width + GATHER_GAP > b.x &&
  a.y < b.y + b.height + GATHER_GAP &&
  a.y + a.height + GATHER_GAP > b.y

/** 같은 축 값이 ALIGN_TOLERANCE 이내로 뭉치는 블럭들을 그리디로 묶는다. */
function clusterByAxis(items: Array<{ id: string; value: number }>): Array<Array<{ id: string; value: number }>> {
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const clusters: Array<Array<{ id: string; value: number }>> = []
  let current: Array<{ id: string; value: number }> = []
  let sum = 0
  sorted.forEach((item) => {
    const mean = current.length > 0 ? sum / current.length : null
    if (mean === null || Math.abs(item.value - mean) <= ALIGN_TOLERANCE) {
      current.push(item)
      sum += item.value
    } else {
      clusters.push(current)
      current = [item]
      sum = item.value
    }
  })
  if (current.length > 0) clusters.push(current)
  return clusters.filter((c) => c.length >= 2)
}

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

  // 모으기 대상 블럭은 아래 격자 정렬에서 제외 — 두 제안이 같은 블럭의 좌표를
  // 서로 덮어쓰면 나중 것이 이기면서 앞의 제안이 조용히 무효가 된다.
  const gatheredIds = new Set<string>()
  const gatherTargets = scattered
    .sort((a, b) => b.outliers[0].dist - a.outliers[0].dist)
    .slice(0, MAX_POSITION_ZONES)
  gatherTargets.forEach(({ outliers }) => outliers.forEach(({ block }) => gatheredIds.add(block.id)))

  // 충돌 회피 장애물: 캔버스에 "보이는" 모든 블럭 — 규칙 대상이 아닌 가이드 블럭도
  // 실재하는 장애물이므로 포함해야 한다(빼면 사용 설명서 위에 얹힌다). 이동 대상만 제외.
  // 목록은 모든 결이 공유 — 결 A 가 배치한 목표 위에 결 B 가 얹히지 않도록.
  const occupied: Rect[] = allBlocks
    .filter((b) => !b.isCompleted && !b.isDeleted && !gatheredIds.has(b.id))
    .map((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }))

  gatherTargets.forEach(({ zoneId, outliers, cx, cy }) => {
      const label = zoneLabel(zoneId)

      const changes = outliers.flatMap(({ block, dist }) => {
        const dirX = (block.x + block.width / 2 - cx) / dist
        const dirY = (block.y + block.height / 2 - cy) / dist
        let radius = GATHER_RADIUS
        let target: Rect = { x: 0, y: 0, width: block.width, height: block.height }
        for (let step = 0; step < 24; step++) {
          target = {
            x: snapToGrid(cx + dirX * radius - block.width / 2),
            y: snapToGrid(cy + dirY * radius - block.height / 2),
            width: block.width,
            height: block.height,
          }
          if (!occupied.some((r) => rectsOverlap(target, r))) break
          radius += GATHER_STEP
        }
        occupied.push(target)
        const reason =
          language === "en"
            ? `${Math.round(dist)}px from the ${label} cluster center`
            : `${label} 결 중심에서 ${Math.round(dist)}px 떨어짐`
        return [
          { blockId: block.id, field: "x", currentValue: block.x, suggestedValue: target.x, reason },
          { blockId: block.id, field: "y", currentValue: block.y, suggestedValue: target.y, reason },
        ]
      })

      suggestions.push({
        id: `rule-position-${zoneId}`,
        type: "position",
        priority: "medium",
        blockIds: outliers.map(({ block }) => block.id),
        question:
          language === "en"
            ? `${outliers.length} "${label}" block(s) drifted far from the rest. Gather them?`
            : `'${label}' 결 블럭 ${outliers.length}개가 멀리 떨어져 있어요. 근처로 모아둘까요?`,
        changes,
      })
    })

  // ── 4. 줄/열 맞춤 — "대충 나란히" 놓인 블럭들을 칼같이 정렬 ──
  // 격자 스냅(최대 12px 이동)은 눈에 안 보인다. 정렬은 블럭들 서로에 대한 것:
  // y 가 ALIGN_TOLERANCE 이내로 뭉친 블럭들은 같은 줄로, x 가 뭉친 블럭들은 같은 열로.
  const alignable = blocks.filter((b) => !gatheredIds.has(b.id))
  const pendingAlign = new Map<string, { x?: number; y?: number }>()

  clusterByAxis(alignable.map((b) => ({ id: b.id, value: b.y }))).forEach((cluster) => {
    const target = snapToGrid(cluster.reduce((s, i) => s + i.value, 0) / cluster.length)
    cluster.forEach(({ id, value }) => {
      if (Math.abs(value - target) > ALIGN_EPSILON) {
        pendingAlign.set(id, { ...pendingAlign.get(id), y: target })
      }
    })
  })

  clusterByAxis(alignable.map((b) => ({ id: b.id, value: b.x }))).forEach((cluster) => {
    const target = snapToGrid(cluster.reduce((s, i) => s + i.value, 0) / cluster.length)
    cluster.forEach(({ id, value }) => {
      if (Math.abs(value - target) > ALIGN_EPSILON) {
        pendingAlign.set(id, { ...pendingAlign.get(id), x: target })
      }
    })
  })

  if (pendingAlign.size >= MIN_ALIGN_BLOCKS) {
    const reason =
      language === "en" ? "Line up rows and columns exactly" : "줄과 열이 정확히 나란해짐"
    const byId = new Map(alignable.map((b) => [b.id, b]))
    suggestions.unshift({
      id: "rule-align",
      type: "position",
      priority: "medium",
      blockIds: Array.from(pendingAlign.keys()),
      question:
        language === "en"
          ? `${pendingAlign.size} block(s) are almost — but not quite — lined up. Align them exactly?`
          : `블럭 ${pendingAlign.size}개가 거의 나란한데 살짝씩 어긋나 있어요. 줄 맞춰 정렬할까요?`,
      changes: Array.from(pendingAlign.entries()).flatMap(([id, move]) => {
        const block = byId.get(id)
        if (!block) return []
        const entries = []
        if (move.x !== undefined) {
          entries.push({ blockId: id, field: "x", currentValue: block.x, suggestedValue: move.x, reason })
        }
        if (move.y !== undefined) {
          entries.push({ blockId: id, field: "y", currentValue: block.y, suggestedValue: move.y, reason })
        }
        return entries
      }),
    })
  }

  return suggestions
}
