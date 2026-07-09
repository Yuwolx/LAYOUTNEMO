"use client"

import { useEffect, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { URGENCY_META, URGENCY_RGB } from "@/lib/constants/urgency"
import type { Urgency } from "@/types"

// 차트 색 — 인디고/앰버/레드 3색 (라이트·다크 양 모드 대비 검증 완료)
const C_PRIMARY = "#6366f1"
const C_SECONDARY = "#d97706"
const C_DANGER = "#ef4444"

type SeriesPoint = {
  date: string
  dau: number
  signups: number
  blocksCreated: number
  blocksDeleted: number
  aiCreate: number
  aiTidy: number
}
type UserRow = {
  id: string
  email: string | null
  plan: string
  created_at: string
  block_count: number
  canvas_count: number
  ai_count: number
  last_active: string | null
}
type Stats = {
  totalUsers: number
  todaySignups: number
  weekSignups: number
  proUsers: number
  totalBlocks: number
  completedBlocks: number
  deletedBlocks: number
  guideBlocks: number
  totalCanvases: number
  totalZones: number
  aiThisMonth: number
  aiCreateTotal: number
  aiTidyTotal: number
  dauToday: number
  wau: number
  mau: number
}
type UrgencyDist = { key: Urgency; count: number }
type UserDetail = {
  profile: { id: string; email: string | null; plan: string; created_at: string }
  blockStats: { active: number; completed: number; deleted: number; guide: number }
  urgencyDist: UrgencyDist[]
  canvases: { id: string; name: string; block_count: number; created_at: string; updated_at: string }[]
  zoneCount: number
  series: { date: string; sessions: number; blocksCreated: number; ai: number }[]
  aiTotals: { create: number; tidy: number }
  lastActive: string | null
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function formatLastActive(iso: string | null): string {
  if (!iso) return "30일+"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return "오늘"
  if (days === 1) return "어제"
  return `${days}일 전`
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [id, setId] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [busy, setBusy] = useState(false)

  const [stats, setStats] = useState<Stats | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [urgencyDist, setUrgencyDist] = useState<UrgencyDist[]>([])
  const [heatmap, setHeatmap] = useState<number[][]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

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
    const res = await fetch("/api/admin/stats")
    if (!res.ok) return
    const data = await res.json()
    setStats(data.stats)
    setSeries(data.series ?? [])
    setUrgencyDist(data.urgencyDist ?? [])
    setHeatmap(data.heatmap ?? [])
    setUsers(data.users ?? [])
  }

  async function openUserDetail(userId: string) {
    setDetailOpen(true)
    setDetail(null)
    const res = await fetch(`/api/admin/users/${userId}`)
    if (!res.ok) {
      setDetailOpen(false)
      return
    }
    setDetail(await res.json())
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

  const heatmapMax = Math.max(1, ...heatmap.flat())
  const urgencyData = urgencyDist.map(({ key, count }) => ({
    key,
    label: URGENCY_META[key].label,
    count,
  }))
  const completionRate = stats && stats.totalBlocks > 0
    ? Math.round((stats.completedBlocks / stats.totalBlocks) * 100)
    : 0

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
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10">
          {[
            { label: "총 유저", value: stats.totalUsers, sub: `PRO ${stats.proUsers}` },
            { label: "오늘 가입", value: stats.todaySignups, sub: `7일 ${stats.weekSignups}` },
            { label: "DAU (오늘)", value: stats.dauToday, sub: null },
            { label: "WAU", value: stats.wau, sub: null },
            { label: "MAU", value: stats.mau, sub: null },
            { label: "이번달 AI", value: stats.aiThisMonth, sub: `누적 ${stats.aiCreateTotal + stats.aiTidyTotal}` },
            { label: "총 블록", value: stats.totalBlocks, sub: `가이드 ${stats.guideBlocks}` },
            { label: "완료 블록", value: stats.completedBlocks, sub: `완료율 ${completionRate}%` },
            { label: "삭제 블록", value: stats.deletedBlocks, sub: null },
            { label: "캔버스", value: stats.totalCanvases, sub: null },
            { label: "결", value: stats.totalZones, sub: null },
            { label: "AI 생성/정리", value: stats.aiCreateTotal, sub: `정리 ${stats.aiTidyTotal}` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-light">{value.toLocaleString()}</p>
              {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">DAU (30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, "유저"]} />
              <Area type="monotone" dataKey="dau" stroke={C_PRIMARY} fill={C_PRIMARY} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">신규 가입 (30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, "명"]} />
              <Bar dataKey="signups" fill={C_PRIMARY} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">블록 생성 · 삭제 (30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="blocksCreated" name="생성" stroke={C_PRIMARY} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="blocksDeleted" name="삭제" stroke={C_DANGER} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">AI 사용 추이 (30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="aiCreate" name="AI 생성" stroke={C_PRIMARY} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="aiTidy" name="정리하기" stroke={C_SECONDARY} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">시급도 분포 (활성 블록)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={urgencyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v) => [v, "블록"]} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {urgencyData.map((d) => (
                  <Cell key={d.key} fill={`rgb(${URGENCY_RGB[d.key]})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm font-light mb-4">AI 기능 사용량 (누적)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={stats ? [
                { name: "AI 생성", count: stats.aiCreateTotal },
                { name: "정리하기", count: stats.aiTidyTotal },
              ] : []}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => [v, "회"]} />
              <Bar dataKey="count" fill={C_SECONDARY} fillOpacity={0.7} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {heatmap.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-5 mb-10">
          <p className="text-sm font-light mb-4">활동 히트맵 — 요일 × 시간 (30일, KST)</p>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {heatmap.map((row, day) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="w-6 text-[10px] text-muted-foreground shrink-0">{WEEKDAYS[day]}</span>
                  {row.map((count, hour) => (
                    <div
                      key={hour}
                      title={`${WEEKDAYS[day]} ${hour}시 · ${count}회`}
                      className="flex-1 aspect-square rounded-[3px] min-w-[14px]"
                      style={{
                        backgroundColor: count > 0
                          ? `rgba(99, 102, 241, ${0.15 + 0.85 * (count / heatmapMax)})`
                          : "rgba(128, 128, 128, 0.08)",
                      }}
                    />
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-1 mt-1">
                <span className="w-6 shrink-0" />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="flex-1 min-w-[14px] text-center text-[9px] text-muted-foreground">
                    {h % 3 === 0 ? h : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="p-5 border-b border-border/40">
          <p className="text-sm font-light">유저 목록 (최근 50명) <span className="text-xs text-muted-foreground">— 행을 누르면 상세</span></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground text-xs">
                <th className="text-left p-3 font-normal">이메일</th>
                <th className="text-left p-3 font-normal">플랜</th>
                <th className="text-right p-3 font-normal">블록</th>
                <th className="text-right p-3 font-normal">캔버스</th>
                <th className="text-right p-3 font-normal">AI (30일)</th>
                <th className="text-right p-3 font-normal">마지막 활동</th>
                <th className="text-right p-3 font-normal">가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openUserDetail(u.id)}
                  className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="p-3 text-xs">{u.email ?? u.id.slice(0, 8) + "…"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.plan === "pro"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "bg-muted text-muted-foreground"
                    }`}>{u.plan}</span>
                  </td>
                  <td className="p-3 text-right text-muted-foreground tabular-nums">{u.block_count}</td>
                  <td className="p-3 text-right text-muted-foreground tabular-nums">{u.canvas_count}</td>
                  <td className="p-3 text-right text-muted-foreground tabular-nums">{u.ai_count}</td>
                  <td className="p-3 text-right text-muted-foreground text-xs">{formatLastActive(u.last_active)}</td>
                  <td className="p-3 text-right text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 overflow-y-auto"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!detail ? (
              <div className="p-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-lg font-light">{detail.profile.email ?? detail.profile.id.slice(0, 8) + "…"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      가입 {new Date(detail.profile.created_at).toLocaleDateString("ko-KR")}
                      {" · "}마지막 활동 {formatLastActive(detail.lastActive)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      detail.profile.plan === "pro"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "bg-muted text-muted-foreground"
                    }`}>{detail.profile.plan}</span>
                    <button
                      onClick={() => setDetailOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      닫기 ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 my-5">
                  {[
                    { label: "활성 블록", value: detail.blockStats.active },
                    { label: "완료", value: detail.blockStats.completed },
                    { label: "삭제", value: detail.blockStats.deleted },
                    { label: "캔버스", value: detail.canvases.length },
                    { label: "결", value: detail.zoneCount },
                    { label: "AI 누적", value: detail.aiTotals.create + detail.aiTotals.tidy },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-border/50 p-3">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-xl font-light">{value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-5">
                  <div className="rounded-lg border border-border/50 p-4">
                    <p className="text-xs font-light mb-3">활동 (30일)</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={detail.series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="sessions" name="접속" stroke={C_PRIMARY} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="blocksCreated" name="블록 생성" stroke={C_SECONDARY} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="ai" name="AI" stroke={C_DANGER} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-lg border border-border/50 p-4">
                    <p className="text-xs font-light mb-3">시급도 분포</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={detail.urgencyDist.map(({ key, count }) => ({ key, label: URGENCY_META[key].label, count }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                        <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={36} />
                        <Tooltip formatter={(v) => [v, "블록"]} />
                        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                          {detail.urgencyDist.map((d) => (
                            <Cell key={d.key} fill={`rgb(${URGENCY_RGB[d.key]})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-xs font-light">캔버스 ({detail.canvases.length})</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground text-xs">
                        <th className="text-left px-4 py-2 font-normal">이름</th>
                        <th className="text-right px-4 py-2 font-normal">블록</th>
                        <th className="text-right px-4 py-2 font-normal">마지막 수정</th>
                        <th className="text-right px-4 py-2 font-normal">생성일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.canvases.map((c) => (
                        <tr key={c.id} className="border-b border-border/20 last:border-0">
                          <td className="px-4 py-2 text-xs">{c.name}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{c.block_count}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                            {new Date(c.updated_at).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                            {new Date(c.created_at).toLocaleDateString("ko-KR")}
                          </td>
                        </tr>
                      ))}
                      {detail.canvases.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">캔버스 없음</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
