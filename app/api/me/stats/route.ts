import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isMasterEmail } from "@/lib/constants/master"
import { KST_OFFSET_MS, kstDayKey, kstDayKeys } from "@/lib/admin/kst"

const DAY_MS = 24 * 60 * 60 * 1000

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * 개인 인사이트 통계 — 본인 세션으로만 접근.
 * events 테이블은 유저 SELECT 정책이 없으므로(insert-only), 세션 검증 후
 * service role 로 본인 user_id 데이터만 집계해 내려준다. 마이그레이션 불필요.
 *
 * 기능 게이트: 현재 마스터 계정 전용(준비 중 기능). 전체 공개 시 게이트만 제거.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // 준비 중 기능 게이트 — 마스터만. UI 게이트와 별개로 서버에서도 막는다.
  if (!isMasterEmail(user.email)) {
    return NextResponse.json({ error: "Coming soon" }, { status: 403 })
  }

  const service = createServiceClient()
  if (!service) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const now = Date.now()
  // 연속 접속(streak) 계산 여유분으로 90일 조회
  const ninetyDaysAgo = new Date(now - 90 * DAY_MS).toISOString()
  const { data: eventsRaw } = await service
    .from("events")
    .select("name, created_at")
    .eq("user_id", user.id)
    .gte("created_at", ninetyDaysAgo)

  const events = (eventsRaw ?? []) as { name: string; created_at: string }[]
  const thirtyDaysAgoMs = now - 30 * DAY_MS
  const nowKst = new Date(now + KST_OFFSET_MS)
  const monthStartMs = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), 1) - KST_OFFSET_MS

  const sessionMap = new Map<string, number>()
  const createdMap = new Map<string, number>()
  const aiMap = new Map<string, number>()
  const activeDays = new Set<string>() // 90일 내 활동한 KST 날짜 (streak 용)
  const aiThisMonth = { create: 0, tidy: 0 }
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

  for (const e of events) {
    const ts = new Date(e.created_at).getTime()
    const day = kstDayKey(e.created_at)
    activeDays.add(day)

    if (ts >= thirtyDaysAgoMs) {
      if (e.name === "session_start") sessionMap.set(day, (sessionMap.get(day) ?? 0) + 1)
      else if (e.name === "block_created") createdMap.set(day, (createdMap.get(day) ?? 0) + 1)
      else if (e.name === "ai_create_used" || e.name === "ai_tidy_used") aiMap.set(day, (aiMap.get(day) ?? 0) + 1)

      const kst = new Date(ts + KST_OFFSET_MS)
      heatmap[kst.getUTCDay()][kst.getUTCHours()] += 1
    }
    if (ts >= monthStartMs) {
      if (e.name === "ai_create_used") aiThisMonth.create += 1
      else if (e.name === "ai_tidy_used") aiThisMonth.tidy += 1
    }
  }

  const days = kstDayKeys(30)
  const series = days.map((date) => ({
    date,
    sessions: sessionMap.get(date) ?? 0,
    blocksCreated: createdMap.get(date) ?? 0,
    ai: aiMap.get(date) ?? 0,
  }))

  // 연속 접속일 — 오늘부터 거꾸로. 오늘 아직 접속 전이면 어제부터 센다.
  const todayKey = days[days.length - 1]
  const todayKstMs = new Date(todayKey + "T00:00:00Z").getTime()
  let streak = 0
  let cursor = activeDays.has(todayKey) ? todayKstMs : todayKstMs - DAY_MS
  while (streak < 90) {
    const key = new Date(cursor).toISOString().split("T")[0]
    if (!activeDays.has(key)) break
    streak += 1
    cursor -= DAY_MS
  }

  return NextResponse.json({
    series,
    heatmap,
    streak,
    activeDays30: days.filter((d) => activeDays.has(d)).length,
    aiThisMonth,
  })
}
