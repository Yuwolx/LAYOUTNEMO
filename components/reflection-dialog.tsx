"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, Loader2, CheckCircle2, Zap, Brain } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Urgency, WorkBlock } from "@/types"
import type { TidyComprehensiveAnalysis, TidyDetailedSuggestion } from "@/lib/ai/types"
import { generateRuleSuggestions } from "@/lib/tidy/rules"
import { URGENCY_KEYS } from "@/lib/constants/urgency"
import { useLanguage, useT } from "@/lib/i18n/context"
import type { AIErrorCode } from "@/lib/ai/schemas"

interface ReflectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: WorkBlock[]
  /** 수락한 제안의 변경분만 전달 — 전체 blocks 교체가 아니라 id 단위 병합(삭제 블럭 보존 + 히스토리 커밋)은 부모가 담당 */
  onApplyChanges: (updates: Array<{ id: string; updates: Partial<WorkBlock> }>) => void
  isAIEnabled: boolean
  zones: { id: string; label: string }[]
}

type AIStatus = "idle" | "loading" | "done" | "none" | "error"

/**
 * 하이브리드 정리하기:
 * 1) 시작 즉시 룰베이스 제안(연결·기한·위치)이 체크리스트로 뜨고 — 0초, 쿼터 미사용
 * 2) 동시에 AI 호출(결 오분류 + 인사이트)이 백그라운드로 출발, 도착하면 목록에 추가
 * 3) 사용자는 체크박스로 골라 한 번에 적용 — 히스토리 1커밋이라 Undo 한 번에 복구
 */
export function ReflectionDialog({
  open,
  onOpenChange,
  blocks,
  onApplyChanges,
  isAIEnabled,
  zones,
}: ReflectionDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const [view, setView] = useState<"intro" | "review" | "done">("intro")
  const [ruleSuggestions, setRuleSuggestions] = useState<TidyDetailedSuggestion[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<TidyDetailedSuggestion[]>([])
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle")
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null)
  const [insight, setInsight] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)

  useEffect(() => {
    if (open) {
      // 인트로 단계 제거 — 열면 바로 리뷰로. 룰 제안(즉시·무료)과 AI 옵트인 버튼이 한 화면에 함께 뜬다.
      setAiSuggestions([])
      setAiStatus("idle")
      setAiErrorMessage(null)
      setInsight(null)
      setAppliedCount(0)
      const rules = generateRuleSuggestions(blocks, zones, language)
      setRuleSuggestions(rules)
      setChecked(new Set(rules.map((s) => s.id)))
      setView("review")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startReview = () => {
    // 1) 룰베이스 — 즉시, 로컬 계산.
    const rules = generateRuleSuggestions(blocks, zones, language)
    setRuleSuggestions(rules)
    setChecked(new Set(rules.map((s) => s.id)))
    setView("review")
    // AI 는 자동으로 쏘지 않는다 — 사용자가 "AI로 더 찾기"를 눌러야 발사(쿼터 절약·조기닫힘 낭비 방지).
  }

  // AI 분석 옵트인 — 쿼터 1회 소진. 자동 발사 시 룰만 보고 닫으면 결과를 못 쓰고 쿼터만 낭비되던 문제 해결.
  const runAI = () => {
    setAiStatus("loading")
    setAiErrorMessage(null)
    fetch("/api/ai/tidy-comprehensive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: blocks.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          detailedNotes: b.detailedNotes,
          zone: b.zone,
          urgency: b.urgency || "thinking",
          dueDate: b.dueDate || null,
          isCompleted: b.isCompleted || false,
          isGuide: b.isGuide || false,
        })),
        zones,
        language,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          let code: AIErrorCode = "upstream_error"
          try {
            const body = await response.json()
            if (body?.error?.code) code = body.error.code as AIErrorCode
          } catch {
            // ignore
          }
          const messages: Record<AIErrorCode, string> = {
            missing_api_key:
              language === "en" ? "The server has no AI key configured." : "서버에 AI 키가 설정되어 있지 않아요.",
            upstream_error:
              language === "en" ? "The AI did not respond." : "AI 응답에 실패했어요.",
            invalid_response:
              language === "en" ? "The AI returned an unexpected shape." : "AI 응답이 예상과 달라요.",
            network_error: language === "en" ? "Network error." : "네트워크 오류가 났어요.",
            quota_exceeded:
              language === "en"
                ? "Monthly Reflect limit reached — rule-based suggestions still work."
                : "이번 달 AI 분석 한도를 다 썼어요 — 위 제안은 한도 없이 쓸 수 있어요.",
          }
          setAiErrorMessage(messages[code])
          setAiStatus("error")
          return
        }
        const data: { analysis?: TidyComprehensiveAnalysis; suggestions?: TidyDetailedSuggestion[] } =
          await response.json()
        const suggestions = (data.suggestions ?? []).filter((s) => s.type === "zone")
        setInsight(data.analysis?.insight ?? null)
        setAiSuggestions(suggestions)
        setChecked((prev) => {
          const next = new Set(prev)
          suggestions.forEach((s) => next.add(s.id))
          return next
        })
        setAiStatus(suggestions.length > 0 ? "done" : "none")
      })
      .catch(() => {
        setAiErrorMessage(language === "en" ? "Could not reach the server." : "서버 연결에 문제가 있어요.")
        setAiStatus("error")
      })
  }

  const toggleChecked = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSuggestions = useMemo(() => [...ruleSuggestions, ...aiSuggestions], [ruleSuggestions, aiSuggestions])
  const selectedCount = allSuggestions.filter((s) => checked.has(s.id)).length

  const applySelected = () => {
    const knownIds = new Set(blocks.map((b) => b.id))
    const zoneIds = new Set(zones.map((z) => z.id))
    const blockById = new Map(blocks.map((b) => [b.id, b]))

    // 블럭별 변경 누적. relatedTo 는 덮어쓰지 않고 합집합으로 병합한다 —
    // 한 블럭에 연결 제안이 두 개 오면 마지막 것이 앞의 것을 지워버리기 때문.
    const pending = new Map<string, Partial<WorkBlock>>()
    const relatedUnion = new Map<string, Set<string>>()

    // 적용 필드는 화이트리스트(x/y/relatedTo/zone/urgency)만 — AI 응답이 뭐라 하든
    // isDeleted/isCompleted 같은 수명주기 필드는 건드리지 못한다.
    allSuggestions
      .filter((s) => checked.has(s.id))
      .forEach((suggestion) => {
        suggestion.changes.forEach((change) => {
          if (!knownIds.has(change.blockId)) return
          const entry = pending.get(change.blockId) ?? {}

          if (change.field === "relatedTo") {
            const base =
              relatedUnion.get(change.blockId) ?? new Set(blockById.get(change.blockId)?.relatedTo ?? [])
            if (Array.isArray(change.suggestedValue)) {
              change.suggestedValue.forEach((id) => {
                if (knownIds.has(id) && id !== change.blockId) base.add(id)
              })
            }
            relatedUnion.set(change.blockId, base)
          } else if (change.field === "x" || change.field === "y") {
            const value = Number(change.suggestedValue)
            if (Number.isFinite(value)) entry[change.field] = value
          } else if (change.field === "zone") {
            if (typeof change.suggestedValue === "string" && zoneIds.has(change.suggestedValue)) {
              entry.zone = change.suggestedValue
            }
          } else if (change.field === "urgency") {
            if (URGENCY_KEYS.includes(change.suggestedValue as Urgency)) {
              entry.urgency = change.suggestedValue as Urgency
            }
          }
          pending.set(change.blockId, entry)
        })
      })

    relatedUnion.forEach((set, blockId) => {
      const entry = pending.get(blockId) ?? {}
      entry.relatedTo = Array.from(set)
      pending.set(blockId, entry)
    })

    const updates = Array.from(pending.entries())
      .filter(([, u]) => Object.keys(u).length > 0)
      .map(([id, u]) => ({ id, updates: u }))

    if (updates.length > 0) onApplyChanges(updates)
    setAppliedCount(selectedCount)
    setView("done")
  }

  const typeLabel = (type: TidyDetailedSuggestion["type"]) =>
    type === "connection"
      ? t("reflect.type.connection")
      : type === "position"
        ? t("reflect.type.position")
        : type === "zone"
          ? t("reflect.type.zone")
          : t("reflect.type.urgency")

  const renderSuggestionRow = (suggestion: TidyDetailedSuggestion) => (
    <label
      key={suggestion.id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/40 bg-background px-3 py-2.5 transition-colors hover:bg-accent/20"
    >
      <Checkbox
        checked={checked.has(suggestion.id)}
        onCheckedChange={() => toggleChecked(suggestion.id)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-foreground/60">
            {typeLabel(suggestion.type)}
          </span>
          {suggestion.priority === "high" && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-600 dark:text-red-400">
              {t("reflect.priority.high")}
            </span>
          )}
        </div>
        <p className="text-foreground/90">{suggestion.question}</p>
      </div>
    </label>
  )

  if (!isAIEnabled) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl">
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground leading-relaxed">AI 보조를 켜면 사용할 수 있습니다.</p>
          </div>
          <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-2">
            {t("action.close")}
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  if (blocks.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl">
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground leading-relaxed">정리할 블럭이 없습니다.</p>
          </div>
          <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-2">
            {t("action.close")}
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-all duration-300" />}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[86vh] overflow-y-auto border-none shadow-2xl">
          {view === "intro" ? (
            <div className="py-6">
              <div className="mb-6">
                <Sparkles className="w-7 h-7 mb-4 text-foreground/70" />
                <p className="text-base text-foreground/90 leading-relaxed font-light mb-4">
                  {t("reflect.intro.heading")}
                </p>
                <ul className="text-sm text-foreground/70 space-y-2 ml-4 list-disc">
                  <li>{t("reflect.intro.item1")}</li>
                  <li>{t("reflect.intro.item2")}</li>
                  <li>{t("reflect.intro.item3")}</li>
                  <li>{t("reflect.intro.item4")}</li>
                </ul>
                <p className="text-sm text-foreground/60 mt-4">{t("reflect.intro.subnote")}</p>
              </div>

              <Button onClick={startReview} className="w-full">
                {t("reflect.action.start")}
              </Button>
            </div>
          ) : view === "review" ? (
            <div className="py-4 space-y-5">
              {/* 룰베이스 제안 — 즉시 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground/60">
                  <Zap className="h-3.5 w-3.5" />
                  {t("reflect.section.rules")}
                </div>
                {ruleSuggestions.length > 0 ? (
                  <div className="space-y-2">{ruleSuggestions.map(renderSuggestionRow)}</div>
                ) : (
                  <p className="rounded-xl bg-muted/30 px-3 py-2.5 text-sm text-foreground/60">
                    {t("reflect.none")}
                  </p>
                )}
              </div>

              {/* AI 제안 — 백그라운드 도착 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground/60">
                  <Brain className="h-3.5 w-3.5" />
                  {t("reflect.section.ai")}
                </div>
                {aiStatus === "idle" ? (
                  <button
                    onClick={runAI}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent/20"
                  >
                    <Brain className="h-4 w-4 shrink-0 text-foreground/60" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground/90">{t("reflect.ai.optin")}</span>
                      <span className="block text-[11px] text-foreground/50">{t("reflect.ai.optinSub")}</span>
                    </span>
                  </button>
                ) : aiStatus === "loading" ? (
                  <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5 text-sm text-foreground/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("reflect.ai.analyzing")}
                  </div>
                ) : aiStatus === "error" ? (
                  <p className="rounded-xl bg-muted/30 px-3 py-2.5 text-sm text-foreground/60">
                    {aiErrorMessage ?? t("reflect.ai.failed")}
                  </p>
                ) : aiStatus === "none" ? (
                  <p className="rounded-xl bg-muted/30 px-3 py-2.5 text-sm text-foreground/60">
                    {t("reflect.ai.none")}
                  </p>
                ) : (
                  <div className="space-y-2">{aiSuggestions.map(renderSuggestionRow)}</div>
                )}
                {insight && (
                  <p className="mt-2 rounded-xl border border-border/40 px-3 py-2.5 text-xs leading-relaxed text-foreground/70">
                    {insight}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1 bg-transparent">
                  {t("action.close")}
                </Button>
                <Button onClick={applySelected} disabled={selectedCount === 0} className="flex-1">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t("reflect.apply.selected")} ({selectedCount})
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-4 text-green-600 dark:text-green-400" />
              <p className="text-base text-foreground/90 mb-2">{t("reflect.applied.done")}</p>
              <p className="text-sm text-foreground/60">
                {t("reflect.summary.applied")}: {appliedCount}
                {t("reflect.summary.suffix")}
              </p>
              {insight && (
                <p className="mx-auto mt-4 max-w-[420px] rounded-xl border border-border/40 px-3 py-2.5 text-left text-xs leading-relaxed text-foreground/70">
                  {insight}
                </p>
              )}
              <Button onClick={() => onOpenChange(false)} variant="default" className="w-full mt-5">
                {t("action.close")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
