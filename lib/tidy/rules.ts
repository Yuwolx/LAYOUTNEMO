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
// 격자 정렬: 셀 간 여백 / 실제 이동 최소 수.
const GRID_GAP = 40
const MIN_GRID_MOVES = 2
// 덩어리(클러스터) 판정: 두 블럭 사각형 간 여백이 이 이내면 같은 덩어리(연결요소).
// 사용자가 공간적으로 나눠둔 덩어리를 보존해 각각 따로 정돈하기 위함.
const CLUSTER_GAP = 220
// 이 개수 이상인 덩어리만 격자로 정돈(그보다 작은 덩어리는 건드리지 않음).
const CLUSTER_MIN = 3

type Rect = { x: number; y: number; width: number; height: number }

/** 공간 근접 클러스터링(연결요소): 두 블럭 사각형 간 여백이 maxGap 이내면 같은 덩어리로 묶는다. */
function clusterByProximity(items: WorkBlock[], maxGap: number): WorkBlock[][] {
  const parent = items.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const edgeGap = (a: WorkBlock, b: WorkBlock) => {
    const hg = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width))
    const vg = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height))
    return Math.hypot(hg, vg)
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (edgeGap(items[i], items[j]) <= maxGap) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, WorkBlock[]>()
  items.forEach((b, i) => {
    const root = find(i)
    const g = groups.get(root)
    if (g) g.push(b)
    else groups.set(root, [b])
  })
  return Array.from(groups.values())
}

/** 한 덩어리를 제자리(무게중심)에서 균일 격자로 재배치. 이동을 out 에 누적. 가이드 블럭은 피한다.
 *  anchor 를 "격자 기하 중심"이 아니라 "격자 블럭 무게중심 = 원래 무게중심"이 되게 보정한다 →
 *  부분 행이 있어도 정확히 제자리에 오고, 다시 정돈해도 안 움직인다(재적용 안정). */
function packGridCluster(cluster: WorkBlock[], guides: Rect[], out: Map<string, { x: number; y: number }>) {
  const ordered = [...cluster].sort((a, b) => a.y - b.y || a.x - b.x)
  const cols = Math.max(1, Math.round(Math.sqrt(ordered.length)))
  const colWidth = Math.max(...ordered.map((b) => b.width)) + GRID_GAP
  const rowHeights: number[] = []
  for (let s = 0; s < ordered.length; s += cols) {
    rowHeights.push(Math.max(...ordered.slice(s, s + cols).map((b) => b.height)))
  }
  // 각 블럭의 격자 내 상대 위치(anchor 기준).
  const rowStarts: number[] = []
  let acc = 0
  rowHeights.forEach((h, r) => {
    rowStarts[r] = acc
    acc += h + GRID_GAP
  })
  const rel = ordered.map((b, i) => ({ b, rx: (i % cols) * colWidth, ry: rowStarts[Math.floor(i / cols)] }))

  // 원래 무게중심 = 정돈 후 블럭 무게중심이 되도록 anchor 보정.
  const cx = ordered.reduce((s, b) => s + b.x + b.width / 2, 0) / ordered.length
  const cy = ordered.reduce((s, b) => s + b.y + b.height / 2, 0) / ordered.length
  const kx = rel.reduce((s, { b, rx }) => s + rx + b.width / 2, 0) / rel.length
  const ky = rel.reduce((s, { b, ry }) => s + ry + b.height / 2, 0) / rel.length
  const anchorX = Math.round(cx - kx)
  let anchorY = Math.round(cy - ky)

  // 가이드 블럭과 "실제로 겹칠 때만"(x·y 둘 다) 그 아래로 회피.
  // (x 범위만 겹쳐도 밀면, 가이드 바로 아래에 있던 덩어리까지 불필요하게 또 밀려 내려간다.)
  const gridWidth = cols * colWidth - GRID_GAP
  const gridBottom = anchorY + rowStarts[rowStarts.length - 1] + rowHeights[rowHeights.length - 1]
  const colliding = guides.filter(
    (g) =>
      g.x < anchorX + gridWidth &&
      g.x + g.width > anchorX &&
      g.y < gridBottom &&
      g.y + g.height > anchorY,
  )
  if (colliding.length) anchorY = Math.max(...colliding.map((g) => g.y + g.height + GRID_GAP))

  rel.forEach(({ b, rx, ry }) => {
    const tx = anchorX + rx
    const ty = anchorY + ry
    if (b.x !== tx || b.y !== ty) out.set(b.id, { x: tx, y: ty })
  })
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

  // ── 3. 위치 정돈 — 덩어리(클러스터)별로 각각 제자리에서 균일 격자로 ──
  // 이전의 "결 중심으로 모으기"는 사용자가 나눠둔 덩어리를 부숴 중앙으로 끌어당겨(=사용자
  // 불만 "다 모아버려") 제거. 위치 정돈은 이 격자 하나로 통일한다.
  // 공간적으로 가까운 블럭끼리 묶어(연결요소, CLUSTER_GAP), 각 덩어리를 무게중심 제자리에서
  // 격자로 재배치 → 덩어리 간 위치 관계는 보존된다.
  //  - 읽기 순서 유지 + 균일 셀 → 덩어리 안에서 겹칠 수 없음
  //  - 가이드 블럭은 격자 밖 고정물 → 각 덩어리 격자가 걸치면 그 아래로 회피
  const gridBlocks = blocks
  const gridById = new Map(gridBlocks.map((b) => [b.id, b]))
  const guideRects: Rect[] = allBlocks
    .filter((b) => b.isGuide && !b.isCompleted && !b.isDeleted)
    .map((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }))
  const gridMoves = new Map<string, { x: number; y: number }>()
  clusterByProximity(gridBlocks, CLUSTER_GAP).forEach((cluster) => {
    if (cluster.length >= CLUSTER_MIN) packGridCluster(cluster, guideRects, gridMoves)
  })

  if (gridMoves.size >= MIN_GRID_MOVES) {
    const reason = language === "en" ? "Tidy each cluster into a grid" : "덩어리별 격자 정돈"
    suggestions.unshift({
      id: "rule-align",
      type: "position",
      priority: "medium",
      blockIds: Array.from(gridMoves.keys()),
      question:
        language === "en"
          ? `Tidy ${gridMoves.size} block(s) into grids, keeping your clusters? (positions shift)`
          : `블럭 ${gridMoves.size}개를 덩어리별로 격자 정돈할까요? (자리가 조금 바뀌어요)`,
      changes: Array.from(gridMoves.entries()).flatMap(([id, move]) => {
        const block = gridById.get(id)
        if (!block) return []
        return [
          { blockId: id, field: "x", currentValue: block.x, suggestedValue: move.x, reason },
          { blockId: id, field: "y", currentValue: block.y, suggestedValue: move.y, reason },
        ]
      }),
    })
  }

  return suggestions
}
