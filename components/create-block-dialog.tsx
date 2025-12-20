"use client"

import { useState } from "react"
import { Sparkles, Calendar, Loader2 } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WorkBlock, Zone } from "@/types"
import { createBlockWithAI } from "@/lib/ai/aiClient"

interface CreateBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateBlock: (block: WorkBlock) => void
  zones: Zone[]
  isAIEnabled: boolean
}

type CreateStep = "input" | "preview" | "placement"

export function CreateBlockDialog({ open, onOpenChange, onCreateBlock, zones, isAIEnabled }: CreateBlockDialogProps) {
  const [step, setStep] = useState<CreateStep>("input")
  const [initialInput, setInitialInput] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>("")
  const [urgency, setUrgency] = useState<"stable" | "thinking" | "lingering" | "urgent">("stable")
  const [aiZoneReason, setAiZoneReason] = useState("")
  const [suggestedPosition, setSuggestedPosition] = useState({ x: 0, y: 0 })
  const [isLoading, setIsLoading] = useState(false)

  const handleInitialSubmit = async () => {
    if (!initialInput.trim()) return

    if (!isAIEnabled) {
      setSummary(initialInput)
      if (!selectedZone) {
        setSelectedZone(zones[0].id)
      }
      setStep("preview")
      return
    }

    setIsLoading(true)
    try {
      const aiOutput = await createBlockWithAI({
        userInput: initialInput,
        existingBlocks: [],
        zones: zones.map((z) => ({ id: z.id, label: z.label })),
      })

      setTitle(aiOutput.title)
      setSummary(aiOutput.summary)
      setSelectedZone(aiOutput.suggestedZone)
      setAiZoneReason(aiOutput.zoneReason)
      setUrgency(aiOutput.suggestedUrgency)
      if (aiOutput.suggestedDueDate) {
        setDueDate(aiOutput.suggestedDueDate)
      }
      setStep("preview")
    } catch (error) {
      console.error("AI generation failed:", error)
      const words = initialInput.trim().split(" ")
      setTitle(words.slice(0, 5).join(" "))
      setSummary(initialInput)
      setSelectedZone(zones[0].id)
      setAiZoneReason("기본 영역으로 설정되었어요.")
      setUrgency("stable")
      setStep("preview")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlacementConfirm = (manual: boolean) => {
    const position = manual ? { x: 300 + Math.random() * 400, y: 200 + Math.random() * 300 } : suggestedPosition

    const newBlock: WorkBlock = {
      id: Date.now().toString(),
      title,
      description: summary,
      x: position.x,
      y: position.y,
      width: 280,
      height: 180,
      zone: selectedZone,
      urgency,
      dueDate: dueDate || undefined,
    }

    onCreateBlock(newBlock)
    handleReset()
  }

  const handleToPlacement = () => {
    const baseX = 200 + Math.random() * 600
    const baseY = 200 + Math.random() * 300
    setSuggestedPosition({ x: baseX, y: baseY })
    setStep("placement")
  }

  const handleReset = () => {
    setStep("input")
    setInitialInput("")
    setTitle("")
    setSummary("")
    setSelectedZone("")
    setDueDate("")
    setUrgency("stable")
    setAiZoneReason("")
    setIsLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleReset}>
      <DialogContent className="sm:max-w-[480px]">
        {step === "input" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-normal">
                {isAIEnabled ? "추가할 업무를 간단히 적어주세요." : "새 블럭 만들기"}
              </h2>
              {!isAIEnabled && <p className="text-sm text-muted-foreground">제목과 내용을 직접 입력하세요.</p>}
            </div>

            {isAIEnabled ? (
              <>
                <Input
                  value={initialInput}
                  onChange={(e) => setInitialInput(e.target.value)}
                  placeholder="예: 디자인 시안 검토 요청 정리"
                  className="text-base h-11"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && initialInput.trim() && !isLoading) {
                      handleInitialSubmit()
                    }
                  }}
                />

                <Button onClick={handleInitialSubmit} disabled={!initialInput.trim() || isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI가 정리하는 중...
                    </>
                  ) : (
                    "다음"
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-title">제목</Label>
                    <Input
                      id="manual-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="업무 제목을 입력하세요"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-summary">내용</Label>
                    <Input
                      id="manual-summary"
                      value={initialInput}
                      onChange={(e) => setInitialInput(e.target.value)}
                      placeholder="업무 내용을 입력하세요"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">영역 (필수)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {zones.map((zone) => (
                        <Button
                          key={zone.id}
                          variant={selectedZone === zone.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedZone(zone.id)}
                          className="text-sm"
                        >
                          {zone.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-dueDate" className="text-sm font-normal">
                      기한 (선택)
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="manual-dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-normal">시급성 (선택)</Label>
                    <div className="flex gap-2">
                      {(["stable", "thinking", "lingering", "urgent"] as const).map((level) => (
                        <Button
                          key={level}
                          variant={urgency === level ? "default" : "outline"}
                          size="sm"
                          onClick={() => setUrgency(level)}
                          className="flex-1 text-sm"
                        >
                          {level === "stable" && "안정"}
                          {level === "thinking" && "보통"}
                          {level === "lingering" && "주의"}
                          {level === "urgent" && "시급"}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setSummary(initialInput)
                    handlePlacementConfirm(true)
                  }}
                  disabled={!title.trim() || !initialInput.trim() || !selectedZone}
                  className="w-full"
                >
                  블럭 만들기
                </Button>
              </>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-normal">
                  업무 제목 {!isAIEnabled && "(필수)"}
                </Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-base" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">1줄 요약</Label>
                <p className="text-sm leading-relaxed text-foreground/80">{summary}</p>
              </div>
            </div>

            <div className="border-t pt-6 space-y-5">
              <div className="space-y-3">
                <Label className="text-sm font-medium">영역 (필수)</Label>
                <div className="flex gap-2 flex-wrap">
                  {zones.map((zone) => (
                    <Button
                      key={zone.id}
                      variant={selectedZone === zone.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedZone(zone.id)}
                      className="text-sm"
                    >
                      {zone.label}
                    </Button>
                  ))}
                </div>
                {isAIEnabled && aiZoneReason && (
                  <p className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-foreground/70" />
                    <span>{aiZoneReason}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-sm font-normal">
                  기한 (선택)
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal">시급성 (선택)</Label>
                <div className="flex gap-2">
                  {(["stable", "thinking", "lingering", "urgent"] as const).map((level) => (
                    <Button
                      key={level}
                      variant={urgency === level ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUrgency(level)}
                      className="flex-1 text-sm"
                    >
                      {level === "stable" && "안정"}
                      {level === "thinking" && "보통"}
                      {level === "lingering" && "주의"}
                      {level === "urgent" && "시급"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("input")} className="flex-1">
                뒤로
              </Button>
              <Button onClick={handleToPlacement} disabled={!selectedZone || !title.trim()} className="flex-1">
                다음
              </Button>
            </div>
          </div>
        )}

        {step === "placement" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-accent/30 rounded-lg border border-border/40">
                <h3 className="font-medium mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{summary}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span>{zones.find((z) => z.id === selectedZone)?.label}</span>
                  {dueDate && <span>• {dueDate}</span>}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">이 위치가 자연스러워 보여요.</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handlePlacementConfirm(true)} className="flex-1">
                직접 옮기기
              </Button>
              <Button onClick={() => handlePlacementConfirm(false)} className="flex-1">
                여기에 두기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
