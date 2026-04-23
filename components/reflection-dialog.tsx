"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WorkBlock } from "@/types"
import type { MultiStageTidyResult } from "@/lib/ai/types"
import { useLanguage, useT } from "@/lib/i18n/context"

interface ReflectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: WorkBlock[]
  onUpdateBlocks: (blocks: WorkBlock[]) => void
  isAIEnabled: boolean
  zones: { id: string; label: string }[]
}

export function ReflectionDialog({
  open,
  onOpenChange,
  blocks,
  onUpdateBlocks,
  isAIEnabled,
  zones,
}: ReflectionDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const [showIntro, setShowIntro] = useState(true)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<MultiStageTidyResult | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [appliedCount, setAppliedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  useEffect(() => {
    if (open) {
      setShowIntro(true)
      setResult(null)
      setCurrentIndex(0)
      setAnalyzing(false)
      setAppliedCount(0)
      setSkippedCount(0)
    }
  }, [open])

  const startComprehensiveAnalysis = async () => {
    setShowIntro(false)
    setAnalyzing(true)
    setLoading(true)

    try {
      // 실제로 시간이 걸리는 건 OpenAI 호출 뿐.
      // 가짜 setTimeout 단계 연출은 제거하고 "분석 중" 하나로 통일.
      setResult({
        stage: { stage: "analyzing", message: t("reflect.stage.analyzing"), progress: 50 },
      })

      const response = await fetch("/api/ai/tidy-comprehensive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: blocks.map((b) => ({
            id: b.id,
            title: b.title,
            description: b.description,
            zone: b.zone,
            urgency: b.urgency || "stable",
            x: b.x,
            y: b.y,
            relatedTo: b.relatedTo || [],
            isCompleted: b.isCompleted || false,
          })),
          zones,
          language,
        }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const data: MultiStageTidyResult = await response.json()

      setResult(data)
      setCurrentIndex(0)
    } catch (error) {
      console.error("Analysis error:", error)
      setResult({
        stage: { stage: "complete", message: t("reflect.message.error"), progress: 100 },
      })
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  const handleAccept = () => {
    if (!result?.suggestions || currentIndex >= result.suggestions.length) return

    const suggestion = result.suggestions[currentIndex]
    const newBlocks = [...blocks]

    suggestion.changes.forEach((change) => {
      const blockIndex = newBlocks.findIndex((b) => b.id === change.blockId)
      if (blockIndex === -1) return

      const block = newBlocks[blockIndex]

      if (change.field === "relatedTo") {
        newBlocks[blockIndex] = {
          ...block,
          relatedTo: Array.isArray(change.suggestedValue) ? change.suggestedValue : [],
        }
      } else if (change.field === "x" || change.field === "y") {
        newBlocks[blockIndex] = {
          ...block,
          [change.field]: Number(change.suggestedValue),
        }
      } else if (change.field === "zone" || change.field === "urgency") {
        newBlocks[blockIndex] = {
          ...block,
          [change.field]: String(change.suggestedValue),
        }
      } else {
        newBlocks[blockIndex] = {
          ...block,
          [change.field]: change.suggestedValue,
        }
      }
    })

    onUpdateBlocks(newBlocks)
    setAppliedCount((prev) => prev + 1)

    if (currentIndex < result.suggestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setResult({
        stage: { stage: "complete", message: t("reflect.message.allReviewed"), progress: 100 },
      })
    }
  }

  const handleReject = () => {
    if (!result?.suggestions) return

    setSkippedCount((prev) => prev + 1)

    if (currentIndex < result.suggestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setResult({
        stage: { stage: "complete", message: t("reflect.message.allReviewed"), progress: 100 },
      })
    }
  }

  if (!isAIEnabled) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl">
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground leading-relaxed">AI 보조를 켜면 사용할 수 있습니다.</p>
          </div>
          <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-2">
            닫기
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
            닫기
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  const currentSuggestion = result?.suggestions?.[currentIndex]
  const totalSuggestions = result?.suggestions?.length || 0

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-all duration-300" />}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] border-none shadow-2xl">
          {showIntro ? (
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

              <Button onClick={startComprehensiveAnalysis} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("reflect.action.analyzing")}
                  </>
                ) : (
                  t("reflect.action.start")
                )}
              </Button>
            </div>
          ) : analyzing || result?.stage.stage === "analyzing" ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-foreground/70" />
              <p className="text-base text-foreground/90 mb-2">{result?.stage.message}</p>
              {/* 실제 소요 시간 예측 불가(OpenAI 호출) → 불확정 스타일로 흘러가는 애니메이션 */}
              <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden relative">
                <div
                  className="absolute inset-y-0 w-1/3 bg-foreground/20 rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]"
                  style={{ animationName: "indeterminate" }}
                />
              </div>
              <p className="text-xs text-foreground/50 mt-3">{t("reflect.progress.wait")}</p>
            </div>
          ) : currentSuggestion ? (
            <div className="py-6">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-6 h-6 mt-1 text-foreground/70 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-foreground/50">
                      {currentIndex + 1} / {totalSuggestions}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        currentSuggestion.priority === "high"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : currentSuggestion.priority === "medium"
                            ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {currentSuggestion.priority === "high"
                        ? t("reflect.priority.high")
                        : currentSuggestion.priority === "medium"
                          ? t("reflect.priority.medium")
                          : t("reflect.priority.low")}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/60">
                      {currentSuggestion.type === "connection"
                        ? t("reflect.type.connection")
                        : currentSuggestion.type === "position"
                          ? t("reflect.type.position")
                          : currentSuggestion.type === "zone"
                            ? t("reflect.type.zone")
                            : t("reflect.type.urgency")}
                    </span>
                  </div>
                  <p className="text-base text-foreground/90 leading-relaxed mb-4">{currentSuggestion.question}</p>

                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    <p className="text-foreground/60 mb-2">{t("reflect.changes.heading")}</p>
                    <ul className="space-y-1 text-foreground/80">
                      {currentSuggestion.changes.map((change, idx) => (
                        <li key={idx} className="text-xs">
                          • {change.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button onClick={handleReject} variant="outline" className="flex-1 bg-transparent">
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("reflect.action.skip")}
                </Button>
                <Button onClick={handleAccept} className="flex-1">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t("reflect.action.apply")}
                </Button>
              </div>

              <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-3 text-xs">
                {t("reflect.action.later")}
              </Button>
            </div>
          ) : result?.stage.stage === "complete" ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-4 text-green-600 dark:text-green-400" />
              <p className="text-base text-foreground/90 mb-2">{result.stage.message}</p>
              {(appliedCount > 0 || skippedCount > 0) && (
                <div className="mt-3 text-sm text-foreground/60">
                  {t("reflect.summary.applied")}: {appliedCount}{t("reflect.summary.suffix")} · {t("reflect.summary.skipped")}: {skippedCount}{t("reflect.summary.suffix")}
                </div>
              )}
              {result.analysis && (
                <div className="mt-4 text-left bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/70">
                      {t("reflect.health.label")}{" "}
                      {result.analysis.overallHealth === "good"
                        ? t("reflect.health.good")
                        : result.analysis.overallHealth === "needs_attention"
                          ? t("reflect.health.needs_attention")
                          : t("reflect.health.critical")}
                    </span>
                  </div>
                  <p className="text-foreground/60 text-xs">
                    {t("reflect.blocks.total")}: {result.analysis.totalBlocks}{t("reflect.summary.suffix")}
                    {result.analysis.completedBlocks !== undefined && ` (${t("reflect.blocks.completed")}: ${result.analysis.completedBlocks}${t("reflect.summary.suffix")})`}
                  </p>
                  {result.analysis.insight && (
                    <p className="text-foreground/70 text-xs mt-2 pt-2 border-t border-foreground/10">
                      {result.analysis.insight}
                    </p>
                  )}
                </div>
              )}
              <Button onClick={() => onOpenChange(false)} variant="default" className="w-full mt-4">
                {t("action.close")}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("reflect.message.allReviewed")}</p>
              <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-4">
                닫기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
