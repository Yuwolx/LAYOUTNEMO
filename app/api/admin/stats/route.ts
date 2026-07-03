import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSessionToken } from "@/lib/admin/session"

const COOKIE = "admin_session"

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

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

  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { count: totalUsers },
    { count: todaySignups },
    { count: totalBlocks },
    { count: aiThisMonth },
    { data: sessionsRaw },
    { data: blocksRaw },
    { data: aiRaw },
    { data: userList },
  ] = await Promise.all([
    supabase.from("user_profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_profiles").select("*", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("blocks").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("events").select("*", { count: "exact", head: true })
      .in("name", ["ai_create_used", "ai_tidy_used"]).gte("created_at", monthStart),
    supabase.from("events").select("created_at, user_id").eq("name", "session_start").gte("created_at", thirtyDaysAgo),
    supabase.from("events").select("created_at").eq("name", "block_created").gte("created_at", thirtyDaysAgo),
    supabase.from("events").select("name").in("name", ["ai_create_used", "ai_tidy_used"]),
    supabase.from("user_profiles").select("id, email, plan, created_at").order("created_at", { ascending: false }).limit(50),
  ])

  // 유저별 블럭 수
  let usersWithBlockCount: Array<{ id: string; email: string | null; plan: string; created_at: string; block_count: number }> = []
  if (userList) {
    const ids = userList.map((u: { id: string }) => u.id)
    const { data: blockCounts } = await supabase.from("blocks").select("user_id").in("user_id", ids).eq("is_deleted", false)
    const countMap = new Map<string, number>()
    ;(blockCounts ?? []).forEach((b: { user_id: string }) => {
      countMap.set(b.user_id, (countMap.get(b.user_id) ?? 0) + 1)
    })
    usersWithBlockCount = userList.map((u: { id: string; email: string | null; plan: string; created_at: string }) => ({
      ...u, block_count: countMap.get(u.id) ?? 0,
    }))
  }

  return NextResponse.json({
    stats: {
      totalUsers: totalUsers ?? 0,
      todaySignups: todaySignups ?? 0,
      totalBlocks: totalBlocks ?? 0,
      aiThisMonth: aiThisMonth ?? 0,
    },
    sessionsRaw: sessionsRaw ?? [],
    blocksRaw: blocksRaw ?? [],
    aiRaw: aiRaw ?? [],
    users: usersWithBlockCount,
  })
}
