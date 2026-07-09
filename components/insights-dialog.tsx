"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart3, Flame, CalendarCheck } from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { useLanguage } from "@/lib/i18n/context"
import { URGENCY_KEYS, URGENCY_META, URGENCY_RGB } from "@/lib/constants/urgency"
import type { Canvas, Urgency } from "@/types"

// 어드민 대시보드와 동일 — 라이트·다크 양 모드 검증된 차트 색
const C_PRIMARY = "#6366f1"
const C_SECONDARY = "#d97706"

type MeStats = {
  series: { date: string; sessions: number; blocksCreated: number; ai: number }[]
  heatmap: number[][]
  streak: number
  activeDays30: number
  aiThisMonth: { create: number; tidy: number }
}

const INFO = {
  ko: {
    title: "인사이트",
    comingSoonBadge: "준비 중",
    comingSoonTitle: "나의 사고 리듬을 한눈에",
    comingSoonDesc:
      "내가 언제 생각을 펼치는지, 블럭이 어떻게 쌓이고 완료되는지, 어떤 시급도에 몰려 있는지 — 캔버스 활동을 통계로 보여주는 기능을 준비하고 있어요.",
    comingSoonItems: [
      "30일 활동 그래프 — 접속·블럭 생성 리듬",
      "요일 × 시간 히트맵 — 나의 집중 시간대",
      "시급도 분포와 완료율 — 지금 머릿속 상태",
      "연속 접속일 — 꾸준함의 기록",
    ],
    comingSoonFooter: "곧 만나요!",
    weekdays: ["일", "월", "화", "수", "목", "금", "토"],
    tiles: {
      activeBlocks: "활성 블럭",
      completion: "완료율",
      canvases: "캔버스",
      facets: "결",
      streak: "연속 접속",
      streakUnit: "일",
      activeDays: "이번 달 활동일",
      ai: "이번 달 AI",
    },
    charts: {
      activity: "활동 (30일)",
      sessions: "접속",
      blocksCreated: "블럭 생성",
      ai: "AI",
      urgency: "시급도 분포",
      heatmap: "나의 집중 시간대 — 요일 × 시간 (30일)",
      byCanvas: "캔버스별 블럭",
      blocksUnit: "블럭",
    },
  },
  en: {
    title: "Insights",
    comingSoonBadge: "Coming soon",
    comingSoonTitle: "Your thinking rhythm, at a glance",
    comingSoonDesc:
      "When do you spread your thoughts? How do blocks pile up and get done? We're building stats that show your canvas activity.",
    comingSoonItems: [
      "30-day activity graph — session & block rhythm",
      "Weekday × hour heatmap — your focus hours",
      "Urgency mix & completion rate — your headspace now",
      "Login streak — a record of consistency",
    ],
    comingSoonFooter: "See you soon!",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    tiles: {
      activeBlocks: "Active blocks",
      completion: "Completion",
      canvases: "Canvases",
      facets: "Facets",
      streak: "Streak",
      streakUnit: "d",
      activeDays: "Active days (month)",
      ai: "AI this month",
    },
    charts: {
      activity: "Activity (30 days)",
      sessions: "Sessions",
      blocksCreated: "Blocks created",
      ai: "AI",
      urgency: "Urgency mix",
      heatmap: "Focus hours — weekday × hour (30 days)",
      byCanvas: "Blocks per canvas",
      blocksUnit: "blocks",
    },
  },
} as const

interface InsightsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canvases: Canvas[]
  /** 마스터 계정만 실데이터 — 나머지는 준비 중 안내 */
  isMaster: boolean
}

export function InsightsDialog({ open, onOpenChange, canvases, isMaster }: InsightsDialogProps) {
  const { language } = useLanguage()
  const info = INFO[language]
  const [stats, setStats] = useState<MeStats | null>(null)

  useEffect(() => {
    if (!open || !isMaster) return
    let cancelled = false
    fetch("/api/me/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setStats(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, isMaster])

  // 블럭 통계는 서버가 아니라 지금 화면의 로컬 상태에서 — 저장 전 변경분까지 반영된다
  const local = useMemo(() => {
    const blocks = canvases.flatMap((c) => c.blocks)
    const real = blocks.filter((b) => !b.isGuide)
    const completed = real.filter((b) => b.isCompleted).length
    const urgencyDist = URGENCY_KEYS.map((key) => ({
      key,
      label: URGENCY_META[key].label,
      count: real.filter((b) => !b.isCompleted && (b.urgency ?? "thinking") === key).length,
    }))
    const byCanvas = canvases
      .map((c) => ({ name: c.name, count: c.blocks.filter((b) => !b.isGuide).length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
    return {
      total: real.length,
      active: real.length - completed,
      completed,
      completionRate: real.length > 0 ? Math.round((completed / real.length) * 100) : 0,
      zoneCount: canvases.reduce((s, c) => s + c.zones.length, 0),
      urgencyDist,
      byCanvas,
    }
  }, [canvases])

  const heatmapMax = stats ? Math.max(1, ...stats.heatmap.flat()) : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {info.title}
            {!isMaster && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-normal">
                {info.comingSoonBadge}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!isMaster ? (
          /* ── 준비 중 안내 ─────────────────────────── */
          <div className="py-6 text-center space-y-5">
            <p className="text-base font-light">{info.comingSoonTitle}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{info.comingSoonDesc}</p>
            <ul className="text-sm text-muted-foreground text-left max-w-sm mx-auto space-y-2">
              {info.comingSoonItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-muted-foreground/50">◦</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm">{info.comingSoonFooter}</p>
          </div>
        ) : (
          /* ── 실제 대시보드 (마스터) ─────────────────── */
          <div className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: info.tiles.activeBlocks, value: String(local.active) },
                { label: info.tiles.completion, value: `${local.completionRate}%` },
                { label: info.tiles.canvases, value: String(canvases.length) },
                { label: info.tiles.facets, value: String(local.zoneCount) },
                {
                  label: info.tiles.streak,
                  value: stats ? `${stats.streak}${info.tiles.streakUnit}` : "…",
                  icon: <Flame className="w-3 h-3 text-amber-500" />,
                },
                {
                  label: info.tiles.activeDays,
                  value: stats ? String(stats.activeDays30) : "…",
                  icon: <CalendarCheck className="w-3 h-3 text-indigo-400" />,
                },
              ].map(({ label, value, icon }) => (
                <div key={label} className="rounded-lg border border-border/50 p-3">
                  <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">{icon}{label}</p>
                  <p className="text-xl font-light">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-light mb-3">{info.charts.activity}</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={stats?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="sessions" name={info.charts.sessions} stroke={C_PRIMARY} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="blocksCreated" name={info.charts.blocksCreated} stroke={C_SECONDARY} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/50 p-4">
                <p className="text-xs font-light mb-3">{info.charts.urgency}</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={local.urgencyDist} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(v) => [v, info.charts.blocksUnit]} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {local.urgencyDist.map((d) => (
                        <Cell key={d.key} fill={`rgb(${URGENCY_RGB[d.key as Urgency]})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border border-border/50 p-4">
                <p className="text-xs font-light mb-3">{info.charts.byCanvas}</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={local.byCanvas} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} />
                    <Tooltip formatter={(v) => [v, info.charts.blocksUnit]} />
                    <Bar dataKey="count" fill={C_PRIMARY} fillOpacity={0.7} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {stats && (
              <div className="rounded-lg border border-border/50 p-4">
                <p className="text-xs font-light mb-3">{info.charts.heatmap}</p>
                <div className="overflow-x-auto">
                  <div className="min-w-[560px]">
                    {stats.heatmap.map((row, day) => (
                      <div key={day} className="flex items-center gap-0.5 mb-0.5">
                        <span className="w-7 text-[9px] text-muted-foreground shrink-0">{info.weekdays[day]}</span>
                        {row.map((count, hour) => (
                          <div
                            key={hour}
                            title={`${info.weekdays[day]} ${hour}:00 · ${count}`}
                            className="flex-1 aspect-square rounded-[2px] min-w-[12px]"
                            style={{
                              backgroundColor: count > 0
                                ? `rgba(99, 102, 241, ${0.15 + 0.85 * (count / heatmapMax)})`
                                : "rgba(128, 128, 128, 0.08)",
                            }}
                          />
                        ))}
                      </div>
                    ))}
                    <div className="flex items-center gap-0.5 mt-1">
                      <span className="w-7 shrink-0" />
                      {Array.from({ length: 24 }, (_, h) => (
                        <span key={h} className="flex-1 min-w-[12px] text-center text-[8px] text-muted-foreground">
                          {h % 3 === 0 ? h : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
