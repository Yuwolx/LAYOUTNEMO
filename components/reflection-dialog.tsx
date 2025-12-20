"use client"

import { useState, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WorkBlock } from "@/types"
import { getNextTidySuggestion } from "@/lib/ai/aiClient"
import type { TidySuggestion } from "@/lib/ai/types"

interface ReflectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: WorkBlock[]
  onUpdateBlocks: (blocks: WorkBlock[]) => void
  isAIEnabled: boolean
  zones: { id: string; label: string }[] // Add zones prop
}

export function ReflectionDialog({
  open,
  onOpenChange,
  blocks,
  onUpdateBlocks,
  isAIEnabled,
  zones,
}: ReflectionDialogProps) {
  const [currentSuggestion, setCurrentSuggestion] = useState<TidySuggestion | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [loading, setLoading] = useState(false)
  const [suggestionCount, setSuggestionCount] = useState(0) // Track suggestion count to prevent infinite loop

  useEffect(() => {
    if (open) {
      setShowIntro(true)
      setCurrentSuggestion(null)
      setSuggestionCount(0) // Reset counter
    }
  }, [open])

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

  const fetchNextSuggestion = async () => {
    if (suggestionCount >= 5) {
      setCurrentSuggestion(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const result = await getNextTidySuggestion({
        blocks: blocks.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          zone: b.zone,
          urgency: b.urgency || "stable",
          x: b.x,
          y: b.y,
        })),
        zones, // Pass actual zones instead of empty array
      })

      if (result.suggestion) {
        setCurrentSuggestion(result.suggestion)
        setSuggestionCount((prev) => prev + 1)
      } else {
        setCurrentSuggestion(null)
      }
    } catch (error) {
      console.error("Failed to fetch suggestion:", error)
      setCurrentSuggestion(null)
    } finally {
      setLoading(false)
    }
  }

  const handleStartReflection = () => {
    setShowIntro(false)
    setSuggestionCount(0) // Reset counter
    fetchNextSuggestion()
  }

  const handleAccept = () => {
    setCurrentSuggestion(null)
    // TODO: Apply the proposed change to blocks
  }

  const handleReject = () => {
    setCurrentSuggestion(null)
  }

  const handleSkipAll = () => {
    onOpenChange(false)
  }

  if (blocks.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl">
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground leading-relaxed">지금은 제안할 질문이 없어요.</p>
          </div>
          <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-2">
            닫기
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-all duration-300" />}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[540px] border-none shadow-2xl">
          {showIntro ? (
            <div className="py-6">
              <div className="mb-6">
                <Sparkles className="w-7 h-7 mb-4 text-foreground/70" />
                <p className="text-base text-foreground/90 leading-relaxed font-light">
                  정리하기는 사고를 대신 정리하는 기능이 아니라,
                  <br />
                  지금 사고 상태를 점검하는 체크포인트입니다.
                </p>
              </div>

              <Button onClick={handleStartReflection} className="w-full">
                시작하기
              </Button>
            </div>
          ) : currentSuggestion ? (
            <div className="py-6">
              <div className="flex items-start gap-3 mb-6">
                <Sparkles className="w-6 h-6 mt-1 text-foreground/70 flex-shrink-0" />
                <div>
                  <p className="text-base text-foreground/90 leading-relaxed font-light mb-3">
                    {currentSuggestion.question}
                  </p>
                  <p className="text-xs text-foreground/60">이 변경을 적용할까요?</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button onClick={handleReject} variant="outline" className="flex-1 bg-transparent">
                  유지
                </Button>
                <Button onClick={handleAccept} className="flex-1">
                  적용
                </Button>
              </div>

              <Button onClick={handleSkipAll} variant="ghost" className="w-full mt-3 text-xs text-muted-foreground">
                나중에 다시 볼게요
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {loading ? "생각을 살펴보는 중이에요..." : "지금은 제안할 질문이 없어요."}
              </p>
              {!loading && (
                <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full mt-4">
                  닫기
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
