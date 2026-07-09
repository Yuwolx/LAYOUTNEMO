import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSessionToken } from "@/lib/admin/session"
import { URGENCY_KEYS } from "@/lib/constants/urgency"
import { kstDayKey, kstDayKeys } from "@/lib/admin/kst"

const COOKIE = "admin_session"

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const { id } = await params
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: profile },
    { data: blocks },
    { data: canvasRows },
    { count: zoneCount },
    { data: recentEvents },
    { data: aiEvents },
  ] = await Promise.all([
    supabase.from("user_profiles").select("id, email, plan, created_at").eq("id", id).single(),
    supabase.from("blocks").select("urgency, is_completed, is_guide, is_deleted, canvas_id").eq("user_id", id),
    supabase.from("canvases").select("id, name, metadata, created_at, updated_at").eq("user_id", id),
    supabase.from("zones").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("events").select("name, created_at").eq("user_id", id).gte("created_at", thirtyDaysAgo),
    supabase.from("events").select("name").eq("user_id", id).in("name", ["ai_create_used", "ai_tidy_used"]),
  ])

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // ── 블록 구성 ──────────────────────────────────
  type BlockLite = { urgency: string; is_completed: boolean; is_guide: boolean; is_deleted: boolean; canvas_id: string }
  const allBlocks = (blocks ?? []) as BlockLite[]
  const alive = allBlocks.filter((b) => !b.is_deleted)
  const blockStats = {
    active: alive.length,
    completed: alive.filter((b) => b.is_completed).length,
    deleted: allBlocks.length - alive.length,
    guide: alive.filter((b) => b.is_guide).length,
  }
  const urgencyDist = URGENCY_KEYS.map((key) => ({
    key,
    count: alive.filter((b) => b.urgency === key && !b.is_guide).length,
  }))

  // ── 캔버스 목록 (tombstone 제외, 블록 수 포함) ────
  type CanvasLite = { id: string; name: string; metadata: Record<string, unknown> | null; created_at: string; updated_at: string }
  const canvases = ((canvasRows ?? []) as CanvasLite[])
    .filter((c) => !(c.metadata as { deleted?: boolean } | null)?.deleted)
    .map((c) => ({
      id: c.id,
      name: c.name,
      block_count: alive.filter((b) => b.canvas_id === c.id).length,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))

  // ── 30일 활동 시리즈 + 마지막 활동 ───────────────
  const days = kstDayKeys(30)
  const sessionMap = new Map<string, number>()
  const createdMap = new Map<string, number>()
  const aiMap = new Map<string, number>()
  let lastActive: string | null = null
  for (const e of (recentEvents ?? []) as { name: string; created_at: string }[]) {
    const day = kstDayKey(e.created_at)
    if (e.name === "session_start") sessionMap.set(day, (sessionMap.get(day) ?? 0) + 1)
    else if (e.name === "block_created") createdMap.set(day, (createdMap.get(day) ?? 0) + 1)
    else if (e.name === "ai_create_used" || e.name === "ai_tidy_used") aiMap.set(day, (aiMap.get(day) ?? 0) + 1)
    if (!lastActive || e.created_at > lastActive) lastActive = e.created_at
  }
  const series = days.map((date) => ({
    date,
    sessions: sessionMap.get(date) ?? 0,
    blocksCreated: createdMap.get(date) ?? 0,
    ai: aiMap.get(date) ?? 0,
  }))

  const aiTotals = { create: 0, tidy: 0 }
  ;((aiEvents ?? []) as { name: string }[]).forEach((e) => {
    if (e.name === "ai_create_used") aiTotals.create += 1
    else aiTotals.tidy += 1
  })

  return NextResponse.json({
    profile,
    blockStats,
    urgencyDist,
    canvases,
    zoneCount: zoneCount ?? 0,
    series,
    aiTotals,
    lastActive,
  })
}
