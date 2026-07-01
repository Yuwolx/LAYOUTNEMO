"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Square, Focus, Link2, Palette, ArrowLeft } from "lucide-react"
import { useLanguage, useT } from "@/lib/i18n/context"
import { URGENCY_KEYS } from "@/lib/constants/urgency"
import { SEED_BLOCK_STRINGS } from "@/lib/i18n/seed"
import type { Urgency } from "@/types"

interface WelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 첫 방문 시 1회 노출되는 환영 모달.
 * 핵심 개념 4가지를 간결히 소개하고, '가이드 보기'로 앱에 시드된 '사용 설명서'
 * 전체 매뉴얼(seed 의 detailedNotes)을 같은 모달 안에서 보여준다.
 * 톤은 앱 매뉴얼과 동일한 '합니다체'. 색·글로우는 블럭 상세와 동일한 제품 비주얼을 재사용.
 */

// 블럭 그림자와 동일 계열의 시급도 색(rgb 트리플). glow 에 알파로 재활용.
const URGENCY_RGB: Record<Urgency, string> = {
  thinking: "212, 212, 216",
  stable: "147, 197, 253",
  lingering: "134, 239, 172",
  urgent: "252, 165, 165",
}

const COPY = {
  ko: {
    title: "LAYOUTNEMO 에 오신 걸 환영합니다",
    tagline: "만들고, 잇고, 펼쳐놓으세요.",
    intro: "할 일을 리스트가 아니라, 캔버스에 자유롭게 펼쳐놓는 생각 공간입니다.",
    concepts: [
      { icon: Square, term: "블럭", desc: "생각이나 할 일 하나를 담는 네모 카드입니다." },
      { icon: Focus, term: "결", desc: "블럭을 성격별로 묶는 기준입니다. 결을 누르면 그 블럭만 또렷해집니다." },
      { icon: Link2, term: "연결", desc: "Shift 를 누른 채 블럭을 다른 블럭에 겹치면 둘이 이어집니다." },
    ],
    urgencyTerm: "시급도",
    urgencyDesc: "얼마나 급한지를 색으로 나타냅니다.",
    hint: "자세한 사용법은 캔버스의 ‘사용 설명서’ 블럭에서 언제든 볼 수 있습니다.",
    viewGuide: "가이드 보기",
    start: "시작하기",
    back: "뒤로",
    guideTitle: "사용 설명서",
  },
  en: {
    title: "Welcome to LAYOUTNEMO",
    tagline: "Make. Connect. Layout.",
    intro: "A thinking space where you spread work out freely on a canvas instead of forcing it into lists.",
    concepts: [
      { icon: Square, term: "Block", desc: "A square card that holds a single thought or task." },
      { icon: Focus, term: "Facet", desc: "A way to group blocks by character. Click a facet and only its blocks stay in focus." },
      { icon: Link2, term: "Connect", desc: "Hold Shift and overlap one block onto another to link the two." },
    ],
    urgencyTerm: "State",
    urgencyDesc: "Shows how urgent something is, through color.",
    hint: "The full usage guide is always available in the “User Guide” block on the canvas.",
    viewGuide: "Open guide",
    start: "Get started",
    back: "Back",
    guideTitle: "User Guide",
  },
} as const

const LogoMark = () => (
  <svg viewBox="0 0 1024 1024" width="30" height="30" aria-hidden="true" className="shrink-0">
    <rect x="280" y="220" width="160" height="600" rx="40" fill="none" stroke="currentColor" strokeWidth="80" />
    <rect x="280" y="660" width="460" height="160" rx="40" fill="none" stroke="currentColor" strokeWidth="80" />
  </svg>
)

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const c = COPY[language]
  const [view, setView] = useState<"intro" | "guide">("intro")

  // 다시 열릴 때는 항상 소개 화면부터.
  useEffect(() => {
    if (open) setView("intro")
  }, [open])

  const guideText = SEED_BLOCK_STRINGS.guide?.detailedNotes?.[language] ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-light">
            {view === "intro" ? c.title : c.guideTitle}
          </DialogTitle>
        </DialogHeader>

        {view === "intro" ? (
          <div className="space-y-6 pt-2">
            {/* 히어로 */}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground/[0.06] text-foreground">
                <LogoMark />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold tracking-tight leading-tight">LAYOUTNEMO</h3>
                <p className="text-xs text-muted-foreground font-light">{c.tagline}</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground/80">{c.intro}</p>

            {/* 개념 카드 */}
            <div className="space-y-1">
              {c.concepts.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.term}
                    className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-foreground/70">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="text-sm leading-relaxed">
                      <p className="font-semibold text-foreground">{item.term}</p>
                      <p className="text-foreground/65">{item.desc}</p>
                    </div>
                  </div>
                )
              })}

              {/* 시급도 — 실제 블럭 색/글로우 재사용 */}
              <div className="flex items-start gap-3 rounded-xl px-2 py-2.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-foreground/70">
                  <Palette className="h-[18px] w-[18px]" />
                </span>
                <div className="text-sm leading-relaxed">
                  <p className="font-semibold text-foreground">{c.urgencyTerm}</p>
                  <p className="text-foreground/65">{c.urgencyDesc}</p>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
                    {URGENCY_KEYS.map((key) => {
                      const rgb = URGENCY_RGB[key]
                      return (
                        <span key={key} className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{
                              backgroundColor: `rgb(${rgb})`,
                              boxShadow: `0 0 0 1px rgba(${rgb}, 0.35), 0 2px 9px rgba(${rgb}, 0.55)`,
                            }}
                            aria-hidden
                          />
                          <span className="text-[13px] text-foreground/70">{t(`urgency.${key}`)}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{c.hint}</p>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 font-light bg-transparent" onClick={() => setView("guide")}>
                {c.viewGuide}
              </Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                {c.start}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="max-h-[58vh] overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed text-foreground/85">
              {guideText}
            </div>
            <div className="flex gap-3 border-t border-border/30 pt-4">
              <Button
                variant="outline"
                className="flex-1 font-light bg-transparent"
                onClick={() => setView("intro")}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {c.back}
              </Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                {c.start}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
