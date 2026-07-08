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
// (모으기 전용) 격자 스냅 간격 — 캔버스 배경 도트(48px)의 절반. 정렬(#4)은 더 이상 격자에 안 스냅.
const ALIGN_GRID = 24
const ALIGN_EPSILON = 1
const MIN_ALIGN_BLOCKS = 2
// 줄(가로) 판정: 윗변(top) y 가 이 이내로 인접하면 같은 줄로 묶어 머리를 맞춘다.
// 블럭 높이(116~168)의 약 0.5배 — 줄 안 지터는 묶고 다음 줄은 안 묶임.
const ROW_TOLERANCE = 72
// 열(세로) 판정: 좌변(left) x 가 이 이내로 인접하면 같은 열. 블럭 폭(280)의 약 0.43배.
const COL_TOLERANCE = 120
// 간격 균등화 시 블럭 간 최소 여백(겹침 방지).
const ALIGN_MIN_GAP = 24
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

/** 1D gap 클러스터: 정렬 후 인접 값 차이가 tolerance 를 넘으면 끊는다. 2개 이상 뭉친 것만 반환.
 *  (running-mean 방식보다 순서 의존이 적고, "어디서 줄이 갈리나"를 이웃 간격으로 직관적으로 판정.) */
function clusterByGap(
  items: Array<{ id: string; value: number }>,
  tolerance: number,
): Array<Array<{ id: string; value: number }>> {
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const clusters: Array<Array<{ id: string; value: number }>> = []
  let current: Array<{ id: string; value: number }> = []
  sorted.forEach((item) => {
    const prev = current.length > 0 ? current[current.length - 1].value : null
    if (prev === null || item.value - prev <= tolerance) {
      current.push(item)
    } else {
      clusters.push(current)
      current = [item]
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

  // ── 4. 줄/열 맞춤 (rows-first) — "대충 놓인" 블럭을 한눈에 정돈되게 ──
  // v1/v2 실패(제안은 떴으나 이동량이 작아 티 안 남) 교훈으로 재작성:
  //  - 넓은 허용범위(ROW/COL_TOLERANCE)로 더 흩어진 블럭도 줄/열에 편입 → 스냅 이동이 큼
  //  - 라인 위 블럭도 "간격 균등화"로 재분배 → 이미 붙어 있던 것도 눈에 띄게 정돈(v1/v2에 없던 핵심)
  //  - 격자 재-스냅 제거(이동량 깎던 범인). 목표는 클러스터 실제 평균.
  // 사용자 클라리: x 정렬 = 옆 블럭들과 "머리(윗변) 맞추기". 그래서 줄은 top(y)으로 묶어
  //  공통 top(머리)에 맞추고 + 가로 간격 균등화. 세로 열은 줄에 안 든 나머지에만(좌변 정렬).
  const alignable = blocks.filter((b) => !gatheredIds.has(b.id))
  const byId = new Map(alignable.map((b) => [b.id, b]))
  const alignMoves = new Map<string, { x?: number; y?: number }>()
  const inRow = new Set<string>()

  const setMove = (id: string, axis: "x" | "y", target: number, current: number) => {
    if (Math.abs(target - current) > ALIGN_EPSILON) {
      alignMoves.set(id, { ...alignMoves.get(id), [axis]: target })
    }
  }

  // 양끝(첫 블럭 시작변·끝 블럭 끝변) 고정 후 사이 간격을 균일하게 재분배. size = 폭 또는 높이.
  // 범위에 다 안 들어가면 gap 을 최소 여백으로 고정하고 끝변을 바깥으로 민다(겹침 방지).
  const distribute = (ordered: WorkBlock[], axis: "x" | "y", size: (b: WorkBlock) => number) => {
    const start = ordered[0][axis]
    const last = ordered[ordered.length - 1]
    const end = last[axis] + size(last)
    const totalSize = ordered.reduce((s, b) => s + size(b), 0)
    const gapCount = ordered.length - 1
    let gap = gapCount > 0 ? (end - start - totalSize) / gapCount : 0
    if (gap < ALIGN_MIN_GAP) gap = ALIGN_MIN_GAP
    let cursor = start
    ordered.forEach((b) => {
      setMove(b.id, axis, Math.round(cursor), b[axis])
      cursor += size(b) + gap
    })
  }

  // 줄: top(y)으로 묶어 머리(공통 top) 맞춤 + 가로 간격 균등화
  clusterByGap(alignable.map((b) => ({ id: b.id, value: b.y })), ROW_TOLERANCE).forEach((cluster) => {
    const row = cluster.map((c) => byId.get(c.id)!).sort((a, b) => a.x - b.x)
    row.forEach((b) => inRow.add(b.id))
    const commonTop = Math.round(row.reduce((s, b) => s + b.y, 0) / row.length)
    row.forEach((b) => setMove(b.id, "y", commonTop, b.y))
    distribute(row, "x", (b) => b.width)
  })

  // 열: 줄에 안 든 나머지만 — 좌변(x)으로 묶어 공통 x 맞춤 + 세로 간격 균등화 (세로 리스트 정돈용)
  const leftover = alignable.filter((b) => !inRow.has(b.id))
  clusterByGap(leftover.map((b) => ({ id: b.id, value: b.x })), COL_TOLERANCE).forEach((cluster) => {
    const col = cluster.map((c) => byId.get(c.id)!).sort((a, b) => a.y - b.y)
    const commonLeft = Math.round(col.reduce((s, b) => s + b.x, 0) / col.length)
    col.forEach((b) => setMove(b.id, "x", commonLeft, b.x))
    distribute(col, "y", (b) => b.height)
  })

  if (alignMoves.size >= MIN_ALIGN_BLOCKS) {
    const reason = language === "en" ? "Line up rows and even out the spacing" : "줄을 맞추고 간격을 고르게"
    suggestions.unshift({
      id: "rule-align",
      type: "position",
      priority: "medium",
      blockIds: Array.from(alignMoves.keys()),
      question:
        language === "en"
          ? `${alignMoves.size} block(s) can be tidied into neat rows. Align them?`
          : `블럭 ${alignMoves.size}개를 줄 맞춰 깔끔하게 정돈할 수 있어요. 정렬할까요?`,
      changes: Array.from(alignMoves.entries()).flatMap(([id, move]) => {
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
