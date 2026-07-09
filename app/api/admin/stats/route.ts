import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSessionToken } from "@/lib/admin/session"
import { URGENCY_KEYS } from "@/lib/constants/urgency"
import { KST_OFFSET_MS, kstDayKey, kstDayKeys } from "@/lib/admin/kst"

const COOKIE = "admin_session"
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const COHORT_WEEKS = 8

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

type EventRow = { name: string; user_id: string; created_at: string }

export async function GET() {
  // 어드민 쿠키 검증
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const now = Date.now()
  const days = kstDayKeys(30)
  const todayKey = days[days.length - 1]
  // "오늘 가입" 등 경계도 KST 자정 기준
  const todayStartUtc = new Date(new Date(todayKey + "T00:00:00Z").getTime() - KST_OFFSET_MS).toISOString()
  const weekAgoMs = now - 7 * DAY_MS
  const thirtyDaysAgoMs = now - 30 * DAY_MS
  // 코호트는 주간 8줄 — 이벤트·가입은 코호트 범위(9주)까지 조회
  const cohortRangeAgo = new Date(now - (COHORT_WEEKS + 1) * WEEK_MS).toISOString()
  const nowKst = new Date(now + KST_OFFSET_MS)
  const monthStart = new Date(
    Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), 1) - KST_OFFSET_MS,
  ).toISOString()

  const [
    { count: totalUsers },
    { count: todaySignups },
    { count: weekSignups },
    { count: proUsers },
    { count: totalBlocks },
    { count: deletedBlocks },
    { data: blockDist },
    { data: canvasRows },
    { count: totalZones },
    { count: aiThisMonth },
    { data: aiTotalsRaw },
    { data: eventsRaw },
    { data: recentProfiles },
    { data: userList },
  ] = await Promise.all([
    supabase.from("user_profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).gte("created_at", todayStartUtc),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).gte("created_at", new Date(weekAgoMs).toISOString()),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
    supabase.from("blocks").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("blocks").select("*", { count: "exact", head: true }).eq("is_deleted", true),
    supabase.from("blocks").select("user_id, urgency, is_completed, is_guide").eq("is_deleted", false),
    supabase.from("canvases").select("user_id, metadata"),
    supabase.from("zones").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true })
      .in("name", ["ai_create_used", "ai_tidy_used"]).gte("created_at", monthStart),
    supabase.from("events").select("name").in("name", ["ai_create_used", "ai_tidy_used"]),
    supabase.from("events").select("name, user_id, created_at").gte("created_at", cohortRangeAgo),
    supabase.from("user_profiles").select("id, created_at").gte("created_at", cohortRangeAgo),
    supabase.from("user_profiles").select("id, email, plan, created_at").order("created_at", { ascending: false }).limit(50),
  ])

  const events = (eventsRaw ?? []) as EventRow[]
  const profiles = (recentProfiles ?? []) as { id: string; created_at: string }[]

  // ── 주간 코호트 축 (KST 월요일 시작) ─────────────
  const todayKstStartMs = new Date(todayKey + "T00:00:00Z").getTime() // KST-시프트 좌표계
  const currentMondayMs = todayKstStartMs - (((new Date(todayKstStartMs).getUTCDay() + 6) % 7) * DAY_MS)
  const week0Ms = currentMondayMs - (COHORT_WEEKS - 1) * WEEK_MS
  const weekIdxOf = (iso: string) =>
    Math.floor((new Date(iso).getTime() + KST_OFFSET_MS - week0Ms) / WEEK_MS)

  // ── 이벤트 단일 순회로 전 지표 집계 ───────────────
  const dauMap = new Map<string, Set<string>>()
  const createdMap = new Map<string, number>()
  const deletedMap = new Map<string, number>()
  const aiCreateMap = new Map<string, number>()
  const aiTidyMap = new Map<string, number>()
  const wauUsers = new Set<string>()
  const mauUsers = new Set<string>()
  const active7 = new Set<string>()
  const active14 = new Set<string>()
  const prior21 = new Set<string>() // 7~28일 전 세션 (복귀 판정용)
  const lastActive = new Map<string, string>()
  const sessionWeeks = new Map<string, Set<number>>() // 코호트: 유저 → 세션 있던 주 인덱스
  const firstBlockAt = new Map<string, number>()
  const firstAiAt = new Map<string, number>()
  let sessionsLast7 = 0
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

  for (const e of events) {
    const ts = new Date(e.created_at).getTime()
    const in30d = ts >= thirtyDaysAgoMs
    const day = in30d ? kstDayKey(e.created_at) : ""

    if (e.name === "session_start") {
      if (in30d) {
        dauMap.get(day)?.add(e.user_id) ?? dauMap.set(day, new Set([e.user_id]))
        mauUsers.add(e.user_id)
        if (ts >= weekAgoMs) {
          wauUsers.add(e.user_id)
          active7.add(e.user_id)
          sessionsLast7 += 1
        }
        if (ts >= now - 14 * DAY_MS) active14.add(e.user_id)
      }
      if (ts >= now - 28 * DAY_MS && ts < weekAgoMs) prior21.add(e.user_id)
      const w = weekIdxOf(e.created_at)
      if (w >= 0) {
        if (!sessionWeeks.has(e.user_id)) sessionWeeks.set(e.user_id, new Set())
        sessionWeeks.get(e.user_id)!.add(w)
      }
    } else if (e.name === "block_created") {
      if (in30d) createdMap.set(day, (createdMap.get(day) ?? 0) + 1)
      const prev = firstBlockAt.get(e.user_id)
      if (prev === undefined || ts < prev) firstBlockAt.set(e.user_id, ts)
    } else if (e.name === "block_deleted") {
      if (in30d) deletedMap.set(day, (deletedMap.get(day) ?? 0) + 1)
    } else if (e.name === "ai_create_used" || e.name === "ai_tidy_used") {
      if (in30d) {
        const m = e.name === "ai_create_used" ? aiCreateMap : aiTidyMap
        m.set(day, (m.get(day) ?? 0) + 1)
      }
      const prev = firstAiAt.get(e.user_id)
      if (prev === undefined || ts < prev) firstAiAt.set(e.user_id, ts)
    }

    if (in30d) {
      const kst = new Date(ts + KST_OFFSET_MS)
      heatmap[kst.getUTCDay()][kst.getUTCHours()] += 1
    }
    const prev = lastActive.get(e.user_id)
    if (!prev || e.created_at > prev) lastActive.set(e.user_id, e.created_at)
  }

  // ── 일별 시리즈 (30일) — 신규/기존 DAU 분해 포함 ──
  const signupMap = new Map<string, number>()
  const createdAtMs = new Map<string, number>()
  profiles.forEach((u) => {
    createdAtMs.set(u.id, new Date(u.created_at).getTime())
    if (new Date(u.created_at).getTime() >= thirtyDaysAgoMs) {
      const day = kstDayKey(u.created_at)
      signupMap.set(day, (signupMap.get(day) ?? 0) + 1)
    }
  })

  const series = days.map((date) => {
    const active = dauMap.get(date) ?? new Set<string>()
    const dayStartMs = new Date(date + "T00:00:00Z").getTime() - KST_OFFSET_MS
    let newUsers = 0
    active.forEach((uid) => {
      const created = createdAtMs.get(uid)
      // 가입 7일 이내면 신규 — 9주 조회 밖의 유저는 무조건 기존
      if (created !== undefined && created >= dayStartMs - 7 * DAY_MS) newUsers += 1
    })
    return {
      date,
      dau: active.size,
      dauNew: newUsers,
      dauReturning: active.size - newUsers,
      signups: signupMap.get(date) ?? 0,
      blocksCreated: createdMap.get(date) ?? 0,
      blocksDeleted: deletedMap.get(date) ?? 0,
      aiCreate: aiCreateMap.get(date) ?? 0,
      aiTidy: aiTidyMap.get(date) ?? 0,
    }
  })

  // ── 리텐션 코호트 (주간 가입 × 경과 주차) ─────────
  const cohortUsers: string[][] = Array.from({ length: COHORT_WEEKS }, () => [])
  profiles.forEach((u) => {
    const w = weekIdxOf(u.created_at)
    if (w >= 0 && w < COHORT_WEEKS) cohortUsers[w].push(u.id)
  })
  const currentWeekIdx = COHORT_WEEKS - 1
  const cohorts = cohortUsers.map((ids, w) => {
    const start = new Date(week0Ms + w * WEEK_MS)
    const label = `${start.getUTCMonth() + 1}/${start.getUTCDate()}~`
    const maxOffset = currentWeekIdx - w
    const retention = Array.from({ length: COHORT_WEEKS }, (_, k) => {
      if (k > maxOffset || ids.length === 0) return null
      const activeCount = ids.filter((id) => sessionWeeks.get(id)?.has(w + k)).length
      return Math.round((activeCount / ids.length) * 100)
    })
    return { label, size: ids.length, retention }
  })

  // ── 활성화 퍼널 (최근 30일 가입자) ────────────────
  const recentSignups = profiles.filter((u) => new Date(u.created_at).getTime() >= thirtyDaysAgoMs)
  const funnel = {
    signups: recentSignups.length,
    createdBlock: recentSignups.filter((u) => {
      const first = firstBlockAt.get(u.id)
      return first !== undefined && first <= new Date(u.created_at).getTime() + 7 * DAY_MS
    }).length,
    usedAi: recentSignups.filter((u) => {
      const first = firstAiAt.get(u.id)
      return first !== undefined && first <= new Date(u.created_at).getTime() + 7 * DAY_MS
    }).length,
  }

  // ── 서비스 건강 지표 ──────────────────────────────
  const avgDau = series.reduce((s, d) => s + d.dau, 0) / series.length
  const totalCreated30 = series.reduce((s, d) => s + d.blocksCreated, 0)
  const totalDeleted30 = series.reduce((s, d) => s + d.blocksDeleted, 0)
  const dormant = [...mauUsers].filter((id) => !active14.has(id)).length
  const resurrected = [...active7].filter((id) => !prior21.has(id)).length
  const health = {
    stickiness: mauUsers.size > 0 ? Math.round((avgDau / mauUsers.size) * 100) : 0,
    sessionsPerActive: active7.size > 0 ? Math.round((sessionsLast7 / active7.size) * 10) / 10 : 0,
    deleteRate: totalCreated30 > 0 ? Math.round((totalDeleted30 / totalCreated30) * 100) : 0,
    activationRate: funnel.signups > 0 ? Math.round((funnel.createdBlock / funnel.signups) * 100) : 0,
    aiAdoption: mauUsers.size > 0
      ? Math.round(([...mauUsers].filter((id) => firstAiAt.has(id)).length / mauUsers.size) * 100)
      : 0,
    proRate: (totalUsers ?? 0) > 0 ? Math.round(((proUsers ?? 0) / (totalUsers ?? 1)) * 100) : 0,
    dormant,
    resurrected,
  }

  // ── 블록 구성 + 파워 유저 분포 ────────────────────
  const dist = (blockDist ?? []) as { user_id: string; urgency: string; is_completed: boolean; is_guide: boolean }[]
  const urgencyDist = URGENCY_KEYS.map((key) => ({
    key,
    count: dist.filter((b) => b.urgency === key && !b.is_guide).length,
  }))
  const completedBlocks = dist.filter((b) => b.is_completed).length
  const guideBlocks = dist.filter((b) => b.is_guide).length

  const blocksPerUser = new Map<string, number>()
  dist.forEach((b) => blocksPerUser.set(b.user_id, (blocksPerUser.get(b.user_id) ?? 0) + 1))
  const buckets = [
    { bucket: "0", min: 0, max: 0 },
    { bucket: "1–5", min: 1, max: 5 },
    { bucket: "6–20", min: 6, max: 20 },
    { bucket: "21–50", min: 21, max: 50 },
    { bucket: "51+", min: 51, max: Infinity },
  ]
  const counts = [...blocksPerUser.values()]
  const powerCurve = buckets.map(({ bucket, min, max }) => ({
    bucket,
    count: min === 0
      ? Math.max(0, (totalUsers ?? 0) - blocksPerUser.size)
      : counts.filter((c) => c >= min && c <= max).length,
  }))

  // ── 캔버스 (tombstone 제외) + 유저별 캔버스 수 ─────
  const aliveCanvases = ((canvasRows ?? []) as { user_id: string; metadata: Record<string, unknown> | null }[])
    .filter((c) => !(c.metadata as { deleted?: boolean } | null)?.deleted)
  const canvasCountMap = new Map<string, number>()
  aliveCanvases.forEach((c) => canvasCountMap.set(c.user_id, (canvasCountMap.get(c.user_id) ?? 0) + 1))

  // ── AI 누적 ────────────────────────────────────
  const aiTotals = { create: 0, tidy: 0 }
  ;((aiTotalsRaw ?? []) as { name: string }[]).forEach((e) => {
    if (e.name === "ai_create_used") aiTotals.create += 1
    else aiTotals.tidy += 1
  })

  // ── 유저 목록 (블록·캔버스·AI 30일·마지막 활동) ────
  const ids = ((userList ?? []) as { id: string }[]).map((u) => u.id)
  const { data: blockCounts } = ids.length
    ? await supabase.from("blocks").select("user_id").in("user_id", ids).eq("is_deleted", false)
    : { data: [] }
  const blockCountMap = new Map<string, number>()
  ;((blockCounts ?? []) as { user_id: string }[]).forEach((b) => {
    blockCountMap.set(b.user_id, (blockCountMap.get(b.user_id) ?? 0) + 1)
  })
  const aiCountMap = new Map<string, number>()
  events.forEach((e) => {
    if ((e.name === "ai_create_used" || e.name === "ai_tidy_used") && new Date(e.created_at).getTime() >= thirtyDaysAgoMs) {
      aiCountMap.set(e.user_id, (aiCountMap.get(e.user_id) ?? 0) + 1)
    }
  })

  const users = ((userList ?? []) as { id: string; email: string | null; plan: string; created_at: string }[]).map((u) => ({
    ...u,
    block_count: blockCountMap.get(u.id) ?? 0,
    canvas_count: canvasCountMap.get(u.id) ?? 0,
    ai_count: aiCountMap.get(u.id) ?? 0,
    last_active: lastActive.get(u.id) ?? null,
  }))

  return NextResponse.json({
    stats: {
      totalUsers: totalUsers ?? 0,
      todaySignups: todaySignups ?? 0,
      weekSignups: weekSignups ?? 0,
      proUsers: proUsers ?? 0,
      totalBlocks: totalBlocks ?? 0,
      completedBlocks,
      deletedBlocks: deletedBlocks ?? 0,
      guideBlocks,
      totalCanvases: aliveCanvases.length,
      totalZones: totalZones ?? 0,
      aiThisMonth: aiThisMonth ?? 0,
      aiCreateTotal: aiTotals.create,
      aiTidyTotal: aiTotals.tidy,
      dauToday: dauMap.get(todayKey)?.size ?? 0,
      wau: wauUsers.size,
      mau: mauUsers.size,
    },
    series,
    urgencyDist,
    heatmap,
    cohorts,
    funnel,
    health,
    powerCurve,
    users,
  })
}
