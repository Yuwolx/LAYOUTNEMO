"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WorkBlock } from "@/types"

interface BlockDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  block: WorkBlock
  onUpdate: (updates: Partial<WorkBlock>) => void
  zones: Array<{ id: string; label: string }>
}

const urgencyColors = {
  stable: { color: "rgb(156, 163, 175)", label: "안정적 (회색)" },
  thinking: { color: "rgb(59, 130, 246)", label: "생각 중 (파란색)" },
  lingering: { color: "rgb(251, 191, 36)", label: "머물러 있음 (노란색)" },
  urgent: { color: "rgb(251, 146, 60)", label: "시급함 (주황색)" },
}

export function BlockDetailDialog({ open, onOpenChange, block, onUpdate, zones }: BlockDetailDialogProps) {
  const [title, setTitle] = useState(block.title)
  const [description, setDescription] = useState(block.description)
  const [detailedNotes, setDetailedNotes] = useState(block.detailedNotes || "")
  const [dueDate, setDueDate] = useState(block.dueDate || "")
  const [zone, setZone] = useState(block.zone)
  const [urgency, setUrgency] = useState<"stable" | "thinking" | "lingering" | "urgent">(block.urgency || "stable")

  useEffect(() => {
    if (open) {
      setTitle(block.title)
      setDescription(block.description)
      setDetailedNotes(block.detailedNotes || "")
      setDueDate(block.dueDate || "")
      setZone(block.zone)
      setUrgency(block.urgency || "stable")
    }
  }, [open, block])

  const handleSave = () => {
    onUpdate({
      title,
      description,
      detailedNotes,
      dueDate: dueDate || undefined,
      zone,
      urgency,
    })
    onOpenChange(false)
  }

  const handleComplete = () => {
    // Calculate stacked position in completion area
    const completedCount = Math.floor(Math.random() * 3) // Simple stacking simulation
    const stackOffset = completedCount * 12

    const canvasWidth = window.innerWidth
    const canvasHeight = window.innerHeight - 140 // Account for header

    const newX = canvasWidth * 0.75 + 40 + stackOffset
    const newY = canvasHeight * 0.7 + 60 + stackOffset

    onUpdate({
      isCompleted: true,
      x: newX,
      y: newY,
      urgency: "stable",
    })
    onOpenChange(false)
  }

  const isCompleted = block.isCompleted || false
  const isGuide = block.isGuide || false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-light">{isGuide ? "사용 설명서" : "블럭 상세"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {isGuide ? (
            <div className="space-y-4">
              <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {block.detailedNotes}
              </div>
              <div className="pt-4 border-t border-border/30">
                <Button onClick={() => onOpenChange(false)} className="w-full">
                  확인
                </Button>
              </div>
            </div>
          ) : isCompleted ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">제목</Label>
                <p className="text-base font-normal">{block.title}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">간단한 설명</Label>
                <p className="text-sm text-muted-foreground leading-relaxed">{block.description}</p>
              </div>

              {block.detailedNotes && (
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">상세 메모</Label>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {block.detailedNotes}
                  </p>
                </div>
              )}

              {block.dueDate && (
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">기한</Label>
                  <p className="text-sm">{block.dueDate}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-normal">
                  제목
                </Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-normal">
                  간단한 설명
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal">영역</Label>
                <div className="flex gap-2 flex-wrap">
                  {zones.map((z) => (
                    <button
                      key={z.id}
                      onClick={() => setZone(z.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                        zone === z.id
                          ? "bg-foreground text-background"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-normal">시급도</Label>
                <div className="space-y-2">
                  {Object.entries(urgencyColors).map(([key, { color, label }]) => (
                    <button
                      key={key}
                      onClick={() => setUrgency(key as "stable" | "thinking" | "lingering" | "urgent")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        urgency === key
                          ? "bg-foreground/5 border-2 border-foreground/20"
                          : "bg-muted/30 border-2 border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 shadow-lg"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 2px 12px ${color}66`,
                        }}
                      />
                      <span className="text-sm font-light">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="detailed-notes" className="text-sm font-normal">
                  상세 메모
                </Label>
                <Textarea
                  id="detailed-notes"
                  value={detailedNotes}
                  onChange={(e) => setDetailedNotes(e.target.value)}
                  placeholder="더 자세한 생각이나 링크를 기록해보세요..."
                  className="min-h-[140px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due-date" className="text-sm font-normal">
                  기한
                </Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="font-light"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/30">
                <Button onClick={handleComplete} variant="outline" className="flex-1 font-light bg-transparent">
                  이 업무를 마무리하기
                </Button>
                <Button onClick={handleSave} className="flex-1">
                  저장
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
