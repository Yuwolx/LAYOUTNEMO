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
// k-means 로 찾을 최대 덩어리 수 / 덩어리를 나눌 최소 실루엣(분리도). 이보다 낮으면 전체 1덩어리.
const MAX_K = 6
const SILHOUETTE_MIN = 0.35
// 군집 간 겹침 분리 시 군집 사각형 사이에 둘 최소 여백.
const CLUSTER_MARGIN = 80

type Rect = { x: number; y: number; width: number; height: number }

type Pt = { x: number; y: number }

/** 결정적 2D k-means. 초기 중심은 (x+y) 정렬 후 균등 간격 — 난수 없이 재현 가능. */
function kmeans(pts: Pt[], k: number, iters = 12): number[] {
  const order = pts
    .map((p, i) => [p.x + p.y, i] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i)
  let centroids: Pt[] = Array.from({ length: k }, (_, c) => {
    const p = pts[order[Math.floor(((c + 0.5) * pts.length) / k)]]
    return { x: p.x, y: p.y }
  })
  const assign = new Array(pts.length).fill(0)
  for (let it = 0; it < iters; it++) {
    let changed = false
    for (let i = 0; i < pts.length; i++) {
      let best = 0
      let bd = Infinity
      for (let c = 0; c < k; c++) {
        const d = (pts[i].x - centroids[c].x) ** 2 + (pts[i].y - centroids[c].y) ** 2
        if (d < bd) {
          bd = d
          best = c
        }
      }
      if (assign[i] !== best) {
        assign[i] = best
        changed = true
      }
    }
    const sum = Array.from({ length: k }, () => ({ x: 0, y: 0, n: 0 }))
    for (let i = 0; i < pts.length; i++) {
      const c = assign[i]
      sum[c].x += pts[i].x
      sum[c].y += pts[i].y
      sum[c].n++
    }
    centroids = sum.map((s, c) => (s.n ? { x: s.x / s.n, y: s.y / s.n } : centroids[c]))
    if (!changed && it > 0) break
  }
  return assign
}

/** 평균 실루엣 계수 — 덩어리가 얼마나 잘 분리·응집됐나(-1~1). 빈 클러스터면 -1. */
function silhouette(pts: Pt[], assign: number[], k: number): number {
  const byC: number[][] = Array.from({ length: k }, () => [])
  assign.forEach((c, i) => byC[c].push(i))
  if (byC.some((c) => c.length === 0)) return -1
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const ci = assign[i]
    let a = 0
    for (const j of byC[ci]) if (j !== i) a += dist(pts[i], pts[j])
    a = byC[ci].length > 1 ? a / (byC[ci].length - 1) : 0
    let b = Infinity
    for (let c = 0; c < k; c++) {
      if (c === ci) continue
      let m = 0
      for (const j of byC[c]) m += dist(pts[i], pts[j])
      m /= byC[c].length
      if (m < b) b = m
    }
    const denom = Math.max(a, b)
    if (denom > 0) total += (b - a) / denom
  }
  return total / pts.length
}

/** k-means 로 "밀집 덩어리"를 찾는다(연결요소의 체이닝 문제 회피). K 는 실루엣이 가장 높은 값으로
 *  자동 선택. 분리도가 SILHOUETTE_MIN 미만이면 뚜렷한 덩어리가 없다고 보고 전체를 한 덩어리로. */
function clusterByKMeans(items: WorkBlock[]): WorkBlock[][] {
  if (items.length < 4) return [items]
  const pts: Pt[] = items.map((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }))
  const maxK = Math.min(MAX_K, Math.floor(items.length / 2))
  let bestK = 1
  let bestScore = -Infinity
  let bestAssign = new Array(items.length).fill(0)
  for (let k = 2; k <= maxK; k++) {
    const assign = kmeans(pts, k)
    const s = silhouette(pts, assign, k)
    if (s > bestScore) {
      bestScore = s
      bestK = k
      bestAssign = assign
    }
  }
  if (bestK < 2 || bestScore < SILHOUETTE_MIN) return [items]
  const groups: WorkBlock[][] = Array.from({ length: bestK }, () => [])
  bestAssign.forEach((c, i) => groups[c].push(items[i]))
  return groups.filter((g) => g.length > 0)
}

/** 한 덩어리를 제자리(무게중심)에서 균일 격자로 배치한 "모든 블럭의 목표 좌표"를 돌려준다.
 *  anchor 를 "격자 기하 중심"이 아니라 "격자 블럭 무게중심 = 원래 무게중심"이 되게 보정한다 →
 *  부분 행이 있어도 정확히 제자리에 오고, 다시 정돈해도 안 움직인다(재적용 안정). */
function packGridLayout(cluster: WorkBlock[]): Map<string, { x: number; y: number }> {
  const ordered = [...cluster].sort((a, b) => a.y - b.y || a.x - b.x)
  const cols = Math.max(1, Math.round(Math.sqrt(ordered.length)))
  const colWidth = Math.max(...ordered.map((b) => b.width)) + GRID_GAP
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

  // ── 3. 위치 정돈 파이프라인 ── ① 군집 분석 → ② 군집별 격자 정렬 → ③ 군집 간 겹침 분리
  //  ① k-means 로 밀집 덩어리를 찾고(체이닝 없음), ② 각 덩어리를 무게중심 제자리에서 격자로
  //     정돈한 뒤, ③ 정돈된 덩어리끼리 겹치면 덩어리 자체를 강체로 밀어 거리를 벌린다.
  //     (덩어리 내부 배치는 ③에서 불변 — 통째로 평행이동만.)
  const gridBlocks = blocks
  const gridById = new Map(gridBlocks.map((b) => [b.id, b]))

  // ① + ②: 각 덩어리를 격자로 배치하고, 덩어리 단위 bbox + 오프셋(초기 0) 을 준비.
  const packs = clusterByKMeans(gridBlocks)
    .filter((c) => c.length > 0)
    .map((cluster) => {
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

  // ③: 덩어리 bbox 를 강체로 보고, 겹치면 관통이 작은 축으로 서로 반반씩 밀어낸다(거리 벌리기).
  for (let iter = 0; iter < 40; iter++) {
    let moved = false
    for (let i = 0; i < packs.length; i++) {
      for (let j = i + 1; j < packs.length; j++) {
        const A = packs[i]
        const B = packs[j]
        const ax = A.bbox.x + A.off.x
        const ay = A.bbox.y + A.off.y
        const bx = B.bbox.x + B.off.x
        const by = B.bbox.y + B.off.y
        // 관통량(+여백): 두 축 모두 양수면 여백보다 가까워 겹친 것 → 작은 축으로 밀어낸다.
        const penX = Math.min(ax + A.bbox.w, bx + B.bbox.w) - Math.max(ax, bx) + CLUSTER_MARGIN
        const penY = Math.min(ay + A.bbox.h, by + B.bbox.h) - Math.max(ay, by) + CLUSTER_MARGIN
        if (penX > 0 && penY > 0) {
          if (penX <= penY) {
            const push = penX / 2
            const dir = ax + A.bbox.w / 2 <= bx + B.bbox.w / 2 ? -1 : 1
            A.off.x += dir * push
            B.off.x -= dir * push
          } else {
            const push = penY / 2
            const dir = ay + A.bbox.h / 2 <= by + B.bbox.h / 2 ? -1 : 1
            A.off.y += dir * push
            B.off.y -= dir * push
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
