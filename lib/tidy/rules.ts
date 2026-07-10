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

const SIMILARITY_THRESHOLD = 60
const MAX_CONNECTION_SUGGESTIONS = 4
const MAX_URGENCY_SUGGESTIONS = 4
// 기한이 이 일수 이내(또는 지남)인데 시급이 아니면 제안.
const DUE_SOON_DAYS = 3
// 격자 정렬: 셀 간 여백 / 실제 이동 최소 수.
const GRID_GAP = 40
const MIN_GRID_MOVES = 2
// 군집 판정: 사각형 간 여백이 이 이하인 이웃끼리 묶는다(단일 연결).
// 사람 눈의 "뭉침"은 이웃 간격으로 지각되므로 단일 연결이 맞다. 예전 체이닝 문제는
// 임계값 220 이 너무 커서 서로 다른 군집까지 이어진 것 — 타이트하게 잡는다.
const CLUSTER_CUT = 160
// 군집 간 겹침 분리 시 군집 사각형 사이에 둘 최소 여백.
const CLUSTER_MARGIN = 80
// 분리 반복 상한. 이 안에 수렴 못 하면(그리고 최종 겹침이 남으면) 제안을 내지 않는다.
const SEPARATE_ITERS = 60

type Rect = { x: number; y: number; width: number; height: number }

/** 두 사각형이 margin 이내로 겹치거나 붙어 있나. margin=0 이면 순수 겹침 검사. */
function rectsIntersect(a: Rect, b: Rect, margin: number): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  )
}

/** 두 블럭 사각형 간 최단 여백(겹치면 0). */
function edgeGap(a: WorkBlock, b: WorkBlock): number {
  const hg = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width))
  const vg = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height))
  return Math.hypot(hg, vg)
}

/** 근접 군집(단일 연결): 여백 CLUSTER_CUT 이하인 이웃끼리 union-find 로 묶는다.
 *  사람 눈의 "뭉침"(게슈탈트 근접)과 일치 — 긴 줄도 한 군집으로 본다.
 *  (평균 연결은 긴 줄을 쪼개서 폐기, k-means 는 모양·개수 가정 때문에 폐기.) */
function clusterByProximity(items: WorkBlock[]): WorkBlock[][] {
  if (items.length <= 1) return items.length ? [items] : []
  const parent = items.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (edgeGap(items[i], items[j]) <= CLUSTER_CUT) parent[find(i)] = find(j)
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

/** 한 덩어리를 제자리(무게중심)에서 균일 격자로 배치한 "모든 블럭의 목표 좌표"를 돌려준다.
 *  anchor 를 "격자 기하 중심"이 아니라 "격자 블럭 무게중심 = 원래 무게중심"이 되게 보정한다 →
 *  부분 행이 있어도 정확히 제자리에 오고, 다시 정돈해도 안 움직인다(재적용 안정). */
function packGridLayout(cluster: WorkBlock[]): Map<string, { x: number; y: number }> {
  const ordered = [...cluster].sort((a, b) => a.y - b.y || a.x - b.x)
  const colWidth = Math.max(...ordered.map((b) => b.width)) + GRID_GAP
  // 열 수는 군집의 "원래 모양(가로세로 비율)"을 따른다 — 가로로 긴 줄은 줄로, 뭉친 blob 은 정사각형에
  // 가깝게. (√n 고정이면 4개짜리 가로 줄이 2x2 로 변형돼 사용자가 만든 모양이 사라진다.)
  const bw = Math.max(...ordered.map((b) => b.x + b.width)) - Math.min(...ordered.map((b) => b.x))
  const bh = Math.max(...ordered.map((b) => b.y + b.height)) - Math.min(...ordered.map((b) => b.y))
  const cellH = Math.max(...ordered.map((b) => b.height)) + GRID_GAP
  const aspect = bw / Math.max(1, bh) / (colWidth / cellH) // 셀 비율로 정규화한 군집 가로세로비
  const cols = Math.min(ordered.length, Math.max(1, Math.round(Math.sqrt(ordered.length * Math.max(0.1, aspect)))))
  const rowHeights: number[] = []
  for (let s = 0; s < ordered.length; s += cols) {
    rowHeights.push(Math.max(...ordered.slice(s, s + cols).map((b) => b.height)))
  }
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
  const anchorY = Math.round(cy - ky)

  const out = new Map<string, { x: number; y: number }>()
  rel.forEach(({ b, rx, ry }) => out.set(b.id, { x: anchorX + rx, y: anchorY + ry }))
  return out
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

  // ── 3. 위치 정돈 파이프라인 ──
  //  ① 군집 분석(응집 클러스터링) → ② 군집별 격자 정렬 → ③ 군집 간 겹침 분리(가이드는 고정
  //  장애물) → ④ 최종 안전망: 모든 보이는 블럭과 전수 겹침 검사, 하나라도 겹치면 제안을 내지 않는다.
  //  겹친 결과를 캔버스에 쓰는 것보다 "오늘은 제안 없음"이 낫다.
  const gridBlocks = blocks
  const gridById = new Map(gridBlocks.map((b) => [b.id, b]))
  // 가이드 블럭(사용설명서 등)은 정돈 대상이 아니지만 화면에 실재 — 고정 장애물로 취급.
  const guideRects: Rect[] = allBlocks
    .filter((b) => b.isGuide && !b.isCompleted && !b.isDeleted)
    .map((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }))

  // ① + ②: 각 덩어리를 격자로 배치하고, 덩어리 단위 bbox + 오프셋(초기 0) 을 준비.
  const packs = clusterByProximity(gridBlocks).map((cluster) => {
    const local = packGridLayout(cluster)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    cluster.forEach((b) => {
      const p = local.get(b.id)!
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + b.width)
      maxY = Math.max(maxY, p.y + b.height)
    })
    return { cluster, local, bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, off: { x: 0, y: 0 } }
  })

  // ③: 덩어리 bbox 를 강체로 보고 겹치면 관통이 작은 축으로 밀어낸다.
  //    덩어리끼리는 반반씩, 고정 장애물(가이드)과 겹치면 덩어리만 전량 밀림.
  for (let iter = 0; iter < SEPARATE_ITERS; iter++) {
    let moved = false
    for (let i = 0; i < packs.length; i++) {
      const A = packs[i]
      const ax = () => A.bbox.x + A.off.x
      const ay = () => A.bbox.y + A.off.y
      // 덩어리 vs 덩어리 — 반반씩.
      for (let j = i + 1; j < packs.length; j++) {
        const B = packs[j]
        const bx = B.bbox.x + B.off.x
        const by = B.bbox.y + B.off.y
        const penX = Math.min(ax() + A.bbox.w, bx + B.bbox.w) - Math.max(ax(), bx) + CLUSTER_MARGIN
        const penY = Math.min(ay() + A.bbox.h, by + B.bbox.h) - Math.max(ay(), by) + CLUSTER_MARGIN
        if (penX > 0 && penY > 0) {
          if (penX <= penY) {
            const push = penX / 2
            const dir = ax() + A.bbox.w / 2 <= bx + B.bbox.w / 2 ? -1 : 1
            A.off.x += dir * push
            B.off.x -= dir * push
          } else {
            const push = penY / 2
            const dir = ay() + A.bbox.h / 2 <= by + B.bbox.h / 2 ? -1 : 1
            A.off.y += dir * push
            B.off.y -= dir * push
          }
          moved = true
        }
      }
      // 덩어리 vs 고정 가이드 — 덩어리만 밀림 (여백은 격자 간격 수준이면 충분).
      for (const g of guideRects) {
        const penX = Math.min(ax() + A.bbox.w, g.x + g.width) - Math.max(ax(), g.x) + GRID_GAP
        const penY = Math.min(ay() + A.bbox.h, g.y + g.height) - Math.max(ay(), g.y) + GRID_GAP
        if (penX > 0 && penY > 0) {
          if (penX <= penY) {
            A.off.x += (ax() + A.bbox.w / 2 <= g.x + g.width / 2 ? -1 : 1) * penX
          } else {
            A.off.y += (ay() + A.bbox.h / 2 <= g.y + g.height / 2 ? -1 : 1) * penY
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }

  // 최종 이동 = 격자 로컬 좌표 + 덩어리 오프셋.
  const gridMoves = new Map<string, { x: number; y: number }>()
  packs.forEach(({ cluster, local, off }) => {
    cluster.forEach((b) => {
      const p = local.get(b.id)!
      const tx = Math.round(p.x + off.x)
      const ty = Math.round(p.y + off.y)
      if (b.x !== tx || b.y !== ty) gridMoves.set(b.id, { x: tx, y: ty })
    })
  })

  // ④ 최종 안전망: 정돈 결과의 "모든 보이는 사각형"(정돈 블럭 최종 좌표 + 가이드) 전수 겹침 검사.
  //   하나라도 겹치면 이 제안은 폐기 — 겹침을 캔버스에 쓰지 않는 것을 구조적으로 보장.
  const finalRects: Rect[] = [
    ...gridBlocks.map((b) => {
      const mv = gridMoves.get(b.id)
      return { x: mv?.x ?? b.x, y: mv?.y ?? b.y, width: b.width, height: b.height }
    }),
    ...guideRects,
  ]
  let hasOverlap = false
  outer: for (let i = 0; i < finalRects.length; i++) {
    for (let j = i + 1; j < finalRects.length; j++) {
      if (rectsIntersect(finalRects[i], finalRects[j], 0)) {
        hasOverlap = true
        break outer
      }
    }
  }

  if (!hasOverlap && gridMoves.size >= MIN_GRID_MOVES) {
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
