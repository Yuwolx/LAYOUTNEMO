import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSessionToken } from "@/lib/admin/session"
import { URGENCY_KEYS } from "@/lib/constants/urgency"
import { KST_OFFSET_MS, kstDayKey, kstDayKeys } from "@/lib/admin/kst"

const COOKIE = "admin_session"

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
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
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
    { data: signupsRaw },
    { data: userList },
  ] = await Promise.all([
    supabase.from("user_profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).gte("created_at", todayStartUtc),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
    supabase.from("blocks").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("blocks").select("*", { count: "exact", head: true }).eq("is_deleted", true),
    supabase.from("blocks").select("urgency, is_completed, is_guide").eq("is_deleted", false),
    supabase.from("canvases").select("user_id, metadata"),
    supabase.from("zones").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true })
      .in("name", ["ai_create_used", "ai_tidy_used"]).gte("created_at", monthStart),
    supabase.from("events").select("name").in("name", ["ai_create_used", "ai_tidy_used"]),
    supabase.from("events").select("name, user_id, created_at").gte("created_at", thirtyDaysAgo),
    supabase.from("user_profiles").select("created_at").gte("created_at", thirtyDaysAgo),
    supabase.from("user_profiles").select("id, email, plan, created_at").order("created_at", { ascending: false }).limit(50),
  ])

  const events = (eventsRaw ?? []) as EventRow[]

  // ── 일별 시리즈 (30일, KST) ─────────────────────
  const dauMap = new Map<string, Set<string>>()
  const createdMap = new Map<string, number>()
  const deletedMap = new Map<string, number>()
  const aiCreateMap = new Map<string, number>()
  const aiTidyMap = new Map<string, number>()
  const wauUsers = new Set<string>()
  const mauUsers = new Set<string>()
  const lastActive = new Map<string, string>()
  // 요일(일=0)×시간 활동 히트맵 — 모든 이벤트 기준
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

  const weekAgoMs = now - 7 * 24 * 60 * 60 * 1000
  for (const e of events) {
    const day = kstDayKey(e.created_at)
    const ts = new Date(e.created_at).getTime()

    if (e.name === "session_start") {
      if (!dauMap.has(day)) dauMap.set(day, new Set())
      dauMap.get(day)!.add(e.user_id)
      mauUsers.add(e.user_id)
      if (ts >= weekAgoMs) wauUsers.add(e.user_id)
    } else if (e.name === "block_created") {
      createdMap.set(day, (createdMap.get(day) ?? 0) + 1)
    } else if (e.name === "block_deleted") {
      deletedMap.set(day, (deletedMap.get(day) ?? 0) + 1)
    } else if (e.name === "ai_create_used") {
      aiCreateMap.set(day, (aiCreateMap.get(day) ?? 0) + 1)
    } else if (e.name === "ai_tidy_used") {
      aiTidyMap.set(day, (aiTidyMap.get(day) ?? 0) + 1)
    }

    const kst = new Date(ts + KST_OFFSET_MS)
    heatmap[kst.getUTCDay()][kst.getUTCHours()] += 1

    const prev = lastActive.get(e.user_id)
    if (!prev || e.created_at > prev) lastActive.set(e.user_id, e.created_at)
  }

  const signupMap = new Map<string, number>()
  ;((signupsRaw ?? []) as { created_at: string }[]).forEach((u) => {
    const day = kstDayKey(u.created_at)
    signupMap.set(day, (signupMap.get(day) ?? 0) + 1)
  })

  const series = days.map((date) => ({
    date,
    dau: dauMap.get(date)?.size ?? 0,
    signups: signupMap.get(date) ?? 0,
    blocksCreated: createdMap.get(date) ?? 0,
    blocksDeleted: deletedMap.get(date) ?? 0,
    aiCreate: aiCreateMap.get(date) ?? 0,
    aiTidy: aiTidyMap.get(date) ?? 0,
  }))

  // ── 블록 구성 (시급도 / 완료 / 가이드) ─────────────
  const dist = (blockDist ?? []) as { urgency: string; is_completed: boolean; is_guide: boolean }[]
  const urgencyDist = URGENCY_KEYS.map((key) => ({
    key,
    count: dist.filter((b) => b.urgency === key && !b.is_guide).length,
  }))
  const completedBlocks = dist.filter((b) => b.is_completed).length
  const guideBlocks = dist.filter((b) => b.is_guide).length

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
    if (e.name === "ai_create_used" || e.name === "ai_tidy_used") {
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
    users,
  })
}
