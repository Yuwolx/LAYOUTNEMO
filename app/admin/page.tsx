"use client"

import { useEffect, useState } from "react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type DailyCount = { date: string; count: number }
type UserRow = { id: string; email: string | null; plan: string; created_at: string; block_count: number }
type Stats = { totalUsers: number; todaySignups: number; totalBlocks: number; aiThisMonth: number }

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [id, setId] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [busy, setBusy] = useState(false)

  const [stats, setStats] = useState<Stats | null>(null)
  const [dauData, setDauData] = useState<DailyCount[]>([])
  const [blockTrend, setBlockTrend] = useState<DailyCount[]>([])
  const [aiData, setAiData] = useState<{ name: string; count: number }[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  // 쿠키 유효성 확인
  useEffect(() => {
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then(({ valid }) => {
        setAuthed(valid)
        if (valid) fetchAll()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLoginError("")
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    })
    if (res.ok) {
      setAuthed(true)
      fetchAll()
    } else {
      setLoginError("아이디 또는 비밀번호가 틀렸습니다")
    }
    setBusy(false)
  }

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" })
    setAuthed(false)
  }

  async function fetchAll() {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) return

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

    setStats({
      totalUsers: totalUsers ?? 0,
      todaySignups: todaySignups ?? 0,
      totalBlocks: totalBlocks ?? 0,
      aiThisMonth: aiThisMonth ?? 0,
    })

    const dauMap = new Map<string, Set<string>>()
    ;(sessionsRaw ?? []).forEach((e: { created_at: string; user_id: string }) => {
      const d = e.created_at.split("T")[0]
      if (!dauMap.has(d)) dauMap.set(d, new Set())
      dauMap.get(d)!.add(e.user_id)
    })
    setDauData(buildLast30Days(dauMap))

    const blockMap = new Map<string, number>()
    ;(blocksRaw ?? []).forEach((e: { created_at: string }) => {
      const d = e.created_at.split("T")[0]
      blockMap.set(d, (blockMap.get(d) ?? 0) + 1)
    })
    setBlockTrend(buildLast30DaysCount(blockMap))

    const aiCount: Record<string, number> = {}
    ;(aiRaw ?? []).forEach((e: { name: string }) => { aiCount[e.name] = (aiCount[e.name] ?? 0) + 1 })
    setAiData([
      { name: "AI 생성", count: aiCount["ai_create_used"] ?? 0 },
      { name: "정리하기", count: aiCount["ai_tidy_used"] ?? 0 },
    ])

    if (userList) {
      const ids = userList.map((u: { id: string }) => u.id)
      const { data: blockCounts } = await supabase.from("blocks").select("user_id").in("user_id", ids).eq("is_deleted", false)
      const countMap = new Map<string, number>()
      ;(blockCounts ?? []).forEach((b: { user_id: string }) => {
        countMap.set(b.user_id, (countMap.get(b.user_id) ?? 0) + 1)
      })
      setUsers(userList.map((u: { id: string; email: string | null; plan: string; created_at: string }) => ({
        ...u, block_count: countMap.get(u.id) ?? 0,
      })))
    }
  }

  // 로딩
  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">...</div>
  }

  // 로그인 폼
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <form onSubmit={handleLogin} className="w-80 space-y-4 rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
          <h1 className="text-lg font-light text-center">관리자 로그인</h1>
          <input
            type="text"
            placeholder="아이디"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            autoComplete="current-password"
          />
          {loginError && <p className="text-xs text-red-500">{loginError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 text-sm rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {busy ? "..." : "로그인"}
          </button>
        </form>
      </div>
    )
  }

  // 대시보드
  return (
    <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light">관리자 대시보드</h1>
        <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          로그아웃
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "총 유저", value: stats.totalUsers },
            { label: "오늘 가입", value: stats.todaySignups },
            { label: "총 블록", value: stats.totalBlocks },
            { label: "이번달 AI", value: stats.aiThisMonth },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-light">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">DAU (30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dauData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, "유저"]} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">블록 생성 추이 (30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={blockTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, "블록"]} />
              <Bar dataKey="count" fill="#6366f1" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">AI 기능 사용량 (전체)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aiData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => [v, "회"]} />
              <Bar dataKey="count" fill="#f59e0b" fillOpacity={0.7} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="p-5 border-b border-border/40">
          <p className="text-sm font-light">유저 목록 (최근 50명)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground text-xs">
                <th className="text-left p-3 font-normal">이메일</th>
                <th className="text-left p-3 font-normal">플랜</th>
                <th className="text-right p-3 font-normal">블록 수</th>
                <th className="text-right p-3 font-normal">가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-xs">{u.email ?? u.id.slice(0, 8) + "…"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.plan === "pro"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "bg-muted text-muted-foreground"
                    }`}>{u.plan}</span>
                  </td>
                  <td className="p-3 text-right text-muted-foreground">{u.block_count}</td>
                  <td className="p-3 text-right text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function buildLast30Days(map: Map<string, Set<string>>): DailyCount[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    return { date: d, count: map.get(d)?.size ?? 0 }
  })
}

function buildLast30DaysCount(map: Map<string, number>): DailyCount[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    return { date: d, count: map.get(d) ?? 0 }
  })
}
