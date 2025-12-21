"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WorkBlock } from "@/types"
import type { MultiStageTidyResult } from "@/lib/ai/types"

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
      setResult({
        stage: { stage: "analyzing", message: "블럭 배치 패턴 분석 중...", progress: 20 },
      })

      await new Promise((resolve) => setTimeout(resolve, 800))

      setResult({
        stage: { stage: "analyzing", message: "블럭 간 관계 파악 중...", progress: 40 },
      })

      await new Promise((resolve) => setTimeout(resolve, 600))

      setResult({
        stage: { stage: "analyzing", message: "개선 방안 생성 중...", progress: 70 },
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
        }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const data: MultiStageTidyResult = await response.json()

      setResult(data)
      setCurrentIndex(0)
    } catch (error) {
      console.error("Analysis error:", error)
      setResult({
        stage: { stage: "complete", message: "분석 중 오류가 발생했습니다", progress: 100 },
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
        stage: { stage: "complete", message: "모든 제안을 검토했습니다", progress: 100 },
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
        stage: { stage: "complete", message: "모든 제안을 검토했습니다", progress: 100 },
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
                  정리하기는 AI가 작업 공간을 깊이 분석합니다:
                </p>
                <ul className="text-sm text-foreground/70 space-y-2 ml-4 list-disc">
                  <li>블럭 간 관계와 패턴 발견</li>
                  <li>영역 분포와 배치 최적화</li>
                  <li>연결이 필요한 블럭 찾기</li>
                  <li>시급도와 우선순위 검토</li>
                </ul>
                <p className="text-sm text-foreground/60 mt-4">더 정교한 분석을 위해 시간이 조금 걸립니다.</p>
              </div>

              <Button onClick={startComprehensiveAnalysis} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  "시작하기"
                )}
              </Button>
            </div>
          ) : analyzing || result?.stage.stage === "analyzing" ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-foreground/70" />
              <p className="text-base text-foreground/90 mb-2">{result?.stage.message}</p>
              <div className="w-full bg-muted rounded-full h-2 mt-4">
                <div
                  className="bg-foreground/20 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${result?.stage.progress || 0}%` }}
                />
              </div>
              <p className="text-xs text-foreground/50 mt-3">
                {result?.stage.progress && result.stage.progress > 60 ? "곧 완료됩니다..." : "조금만 기다려주세요"}
              </p>
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
                        ? "높은 우선순위"
                        : currentSuggestion.priority === "medium"
                          ? "보통 우선순위"
                          : "낮은 우선순위"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/60">
                      {currentSuggestion.type === "connection"
                        ? "연결"
                        : currentSuggestion.type === "position"
                          ? "위치"
                          : currentSuggestion.type === "zone"
                            ? "영역"
                            : "시급도"}
                    </span>
                  </div>
                  <p className="text-base text-foreground/90 leading-relaxed mb-4">{currentSuggestion.question}</p>

                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    <p className="text-foreground/60 mb-2">변경될 내용:</p>
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
                  건너뛰기
                </Button>
                <Button onClick={handleAccept} className="flex-1">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  적용하기
                </Button>
              </div>

              <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-3 text-xs">
                나중에 다시 볼게요
              </Button>
            </div>
          ) : result?.stage.stage === "complete" ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-4 text-green-600 dark:text-green-400" />
              <p className="text-base text-foreground/90 mb-2">{result.stage.message}</p>
              {(appliedCount > 0 || skippedCount > 0) && (
                <div className="mt-3 text-sm text-foreground/60">
                  적용: {appliedCount}개 · 건너뜀: {skippedCount}개
                </div>
              )}
              {result.analysis && (
                <div className="mt-4 text-left bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/70">
                      전체 상태:{" "}
                      {result.analysis.overallHealth === "good"
                        ? "✓ 좋음"
                        : result.analysis.overallHealth === "needs_attention"
                          ? "⚠ 주의 필요"
                          : "⚠ 개선 필요"}
                    </span>
                  </div>
                  <p className="text-foreground/60 text-xs">
                    총 블럭: {result.analysis.totalBlocks}개
                    {result.analysis.completedBlocks !== undefined && ` (완료: ${result.analysis.completedBlocks}개)`}
                  </p>
                  {result.analysis.insight && (
                    <p className="text-foreground/70 text-xs mt-2 pt-2 border-t border-foreground/10">
                      {result.analysis.insight}
                    </p>
                  )}
                </div>
              )}
              <Button onClick={() => onOpenChange(false)} variant="default" className="w-full mt-4">
                닫기
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">제안할 내용이 없습니다</p>
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
