"use client"

import { useEffect, useState } from "react"
import { Sparkles, Calendar, Loader2 } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WorkBlock, Zone, Urgency } from "@/types"
import { createBlockWithAI, mockCreateBlockOutput, AIError } from "@/lib/ai/aiClient"
import { toast } from "sonner"
import { URGENCY_KEYS } from "@/lib/constants/urgency"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedZoneLabel } from "@/lib/i18n/seed"

interface CreateBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateBlock: (block: WorkBlock) => void
  zones: Zone[]
  isAIEnabled: boolean
  existingBlocks: WorkBlock[]
  onShowPreview?: (block: Partial<WorkBlock> | null) => void // 미리보기 블록 전달
}

type CreateStep = "input" | "preview" | "placement"

/** AI 응답이 도착한 뒤 사용자 무응답 시 자동 반영까지의 시간 (ms). */
const AUTO_CONFIRM_MS = 8000

export function CreateBlockDialog({
  open,
  onOpenChange,
  onCreateBlock,
  zones,
  isAIEnabled,
  existingBlocks,
  onShowPreview,
}: CreateBlockDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const [step, setStep] = useState<CreateStep>("input")
  const [initialInput, setInitialInput] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>("")
  const [urgency, setUrgency] = useState<Urgency>("stable")
  const [aiZoneReason, setAiZoneReason] = useState("")
  const [suggestedPosition, setSuggestedPosition] = useState({ x: 0, y: 0 })
  const [isLoading, setIsLoading] = useState(false)
  // AI 응답 후 사용자 무응답 시 자동 반영. null 이면 비활성.
  const [autoConfirmAt, setAutoConfirmAt] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const cancelAutoConfirm = () => {
    setAutoConfirmAt((prev) => (prev !== null ? null : prev))
  }

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
    const aiInput = {
      userInput: initialInput,
      existingBlocks: [],
      zones: zones.map((z) => ({ id: z.id, label: z.label })),
      language,
    }
    try {
      const aiOutput = await createBlockWithAI(aiInput)

      setTitle(aiOutput.title)
      setSummary(aiOutput.summary)
      setSelectedZone(aiOutput.suggestedZone)
      setAiZoneReason(aiOutput.zoneReason)
      setUrgency(aiOutput.suggestedUrgency)
      if (aiOutput.suggestedDueDate) {
        setDueDate(aiOutput.suggestedDueDate)
      }
      setStep("preview")
      setAutoConfirmAt(Date.now() + AUTO_CONFIRM_MS)
    } catch (error) {
      // 사용자에게 원인을 명확히 노출 + 키워드 기반 fallback 으로 흐름은 끊기지 않게.
      const isAI = error instanceof AIError
      const code = isAI ? error.code : "network_error"
      const messages: Record<string, string> = {
        missing_api_key:
          language === "en"
            ? "AI is unavailable: server has no API key. Filled in with keyword guesses."
            : "AI 키가 서버에 없어 키워드로 대신 추론했어요.",
        upstream_error:
          language === "en"
            ? "AI failed to respond. Filled in with keyword guesses."
            : "AI 응답 실패 — 키워드로 대신 추론했어요.",
        invalid_response:
          language === "en"
            ? "AI returned an unexpected shape. Filled in with keyword guesses."
            : "AI 응답이 예상과 달라 키워드로 대신 추론했어요.",
        network_error:
          language === "en"
            ? "Network error. Filled in with keyword guesses."
            : "네트워크 오류 — 키워드로 대신 추론했어요.",
      }
      toast.warning(messages[code] ?? messages.network_error)

      const fallback = mockCreateBlockOutput(aiInput)
      setTitle(fallback.title)
      setSummary(fallback.summary)
      setSelectedZone(fallback.suggestedZone)
      setAiZoneReason(fallback.zoneReason)
      setUrgency(fallback.suggestedUrgency)
      if (fallback.suggestedDueDate) setDueDate(fallback.suggestedDueDate)
      setStep("preview")
      setAutoConfirmAt(Date.now() + AUTO_CONFIRM_MS)
    } finally {
      setIsLoading(false)
    }
  }

  // AI 응답 후 자동 반영: smart position 으로 placement 단계 건너뛰고 바로 생성.
  const autoCommitBlock = () => {
    if (onShowPreview) onShowPreview(null)
    const position = findSmartPosition()
    const newBlock: WorkBlock = {
      id: Date.now().toString(),
      title,
      description: summary,
      x: position.x,
      y: position.y,
      width: 200,
      height: 96,
      zone: selectedZone,
      urgency,
      dueDate: dueDate || undefined,
    }
    onCreateBlock(newBlock)
    handleReset()
  }

  // 자동 반영 타이머 — autoConfirmAt 이 세팅되면 그 시점에 autoCommitBlock 실행.
  // 별도 ticker interval 로 secondsLeft 갱신.
  useEffect(() => {
    if (autoConfirmAt === null) {
      setSecondsLeft(0)
      return
    }
    const updateLeft = () => {
      setSecondsLeft(Math.max(0, Math.ceil((autoConfirmAt - Date.now()) / 1000)))
    }
    updateLeft()
    const remaining = autoConfirmAt - Date.now()
    if (remaining <= 0) {
      autoCommitBlock()
      return
    }
    const commitTimer = setTimeout(() => autoCommitBlock(), remaining)
    const tickInterval = setInterval(updateLeft, 200)
    return () => {
      clearTimeout(commitTimer)
      clearInterval(tickInterval)
    }
    // autoCommitBlock 은 클로저 — 사용자 인터랙션 시 cancelAutoConfirm 으로 자동 정리됨.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirmAt])

  const handlePlacementConfirm = (manual: boolean) => {
    if (onShowPreview) {
      onShowPreview(null)
    }

    const position = manual ? { x: 300 + Math.random() * 400, y: 200 + Math.random() * 300 } : suggestedPosition

    const newBlock: WorkBlock = {
      id: Date.now().toString(),
      title,
      description: summary,
      x: position.x,
      y: position.y,
      width: 200,
      height: 96,
      zone: selectedZone,
      urgency,
      dueDate: dueDate || undefined,
    }

    onCreateBlock(newBlock)
    handleReset()
  }

  const handleToPlacement = () => {
    const smartPosition = findSmartPosition()
    setSuggestedPosition(smartPosition)

    // Canvas에 미리보기 블록 표시
    if (onShowPreview) {
      onShowPreview({
        id: "preview",
        title,
        description: summary,
        x: smartPosition.x,
        y: smartPosition.y,
        width: 200,
        height: 96,
        zone: selectedZone,
        urgency,
        dueDate: dueDate || undefined,
      })
    }

    setStep("placement")
  }

  const handleReset = () => {
    if (onShowPreview) {
      onShowPreview(null)
    }

    setStep("input")
    setInitialInput("")
    setTitle("")
    setSummary("")
    setSelectedZone("")
    setDueDate("")
    setUrgency("stable")
    setAiZoneReason("")
    setIsLoading(false)
    setAutoConfirmAt(null) // 다이얼로그 닫힐 때 카운트다운 정리
    onOpenChange(false)
  }

  const findSmartPosition = (): { x: number; y: number } => {
    const BLOCK_WIDTH = 200
    const BLOCK_HEIGHT = 96
    const SPACING = 40
    const MIN_X = 100
    const MIN_Y = 100

    // 활성 블록만 필터링 (삭제, 완료, 가이드 제외)
    const activeBlocks = existingBlocks.filter((b) => !b.isDeleted && !b.isCompleted && !b.isGuide)

    // 겹침 체크 함수
    const isOverlapping = (x: number, y: number, checkBlocks = activeBlocks): boolean => {
      return checkBlocks.some((block) => {
        const horizontalOverlap = x < block.x + block.width + SPACING && x + BLOCK_WIDTH + SPACING > block.x
        const verticalOverlap = y < block.y + block.height + SPACING && y + BLOCK_HEIGHT + SPACING > block.y
        return horizontalOverlap && verticalOverlap
      })
    }

    // 1. 같은 영역의 블록들 찾기
    const sameZoneBlocks = activeBlocks.filter((b) => b.zone === selectedZone)

    if (sameZoneBlocks.length > 0) {
      // 같은 영역의 블록들 중 가장 최근 블록 (가장 오른쪽 또는 아래쪽)
      const latestBlock = sameZoneBlocks.reduce((latest, block) => {
        const latestScore = latest.x + latest.y
        const blockScore = block.x + block.y
        return blockScore > latestScore ? block : latest
      })

      // 후보 위치들 시도 (우선순위 순서)
      const candidates = [
        // 1. 오른쪽
        { x: latestBlock.x + latestBlock.width + SPACING, y: latestBlock.y },
        // 2. 아래쪽
        { x: latestBlock.x, y: latestBlock.y + latestBlock.height + SPACING },
        // 3. 오른쪽 아래 대각선
        { x: latestBlock.x + latestBlock.width + SPACING, y: latestBlock.y + latestBlock.height + SPACING },
        // 4. 왼쪽 아래
        { x: latestBlock.x - BLOCK_WIDTH - SPACING, y: latestBlock.y + latestBlock.height + SPACING },
      ]

      for (const candidate of candidates) {
        if (candidate.x >= MIN_X && candidate.y >= MIN_Y && !isOverlapping(candidate.x, candidate.y)) {
          return candidate
        }
      }

      // 모든 후보가 실패하면 같은 영역 블록들 아래쪽 찾기
      const lowestSameZone = sameZoneBlocks.reduce((lowest, block) => {
        const lowestBottom = lowest.y + lowest.height
        const blockBottom = block.y + block.height
        return blockBottom > lowestBottom ? block : lowest
      })

      return {
        x: lowestSameZone.x,
        y: lowestSameZone.y + lowestSameZone.height + SPACING * 2,
      }
    }

    // 2. 같은 영역이 없으면 빈 공간 찾기 (모든 블록 아래쪽)
    if (activeBlocks.length === 0) {
      return { x: MIN_X + 100, y: MIN_Y + 100 }
    }

    // 가장 아래쪽 블록 찾기
    const lowestBlock = activeBlocks.reduce((lowest, block) => {
      const lowestBottom = lowest.y + lowest.height
      const blockBottom = block.y + block.height
      return blockBottom > lowestBottom ? block : lowest
    })

    // 가장 왼쪽 블록 찾기 (X 좌표 참고용)
    const leftmostBlock = activeBlocks.reduce((leftmost, block) => {
      return block.x < leftmost.x ? block : leftmost
    })

    // 가장 아래쪽 블록 기준으로 아래에 배치
    const candidateX = Math.max(leftmostBlock.x, MIN_X + 100)
    const candidateY = lowestBlock.y + lowestBlock.height + SPACING * 2

    return { x: candidateX, y: candidateY }
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
                    <Label htmlFor="manual-summary">내용 (선택)</Label>
                    <Input
                      id="manual-summary"
                      value={initialInput}
                      onChange={(e) => setInitialInput(e.target.value)}
                      placeholder="업무 내용을 입력하세요"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("label.facetRequired")}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {zones.map((zone) => (
                        <Button
                          key={zone.id}
                          variant={selectedZone === zone.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedZone(zone.id)}
                          className="text-sm"
                        >
                          {translateSeedZoneLabel(zone, language)}
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
                    <Label className="text-sm font-normal">{t("label.urgency")} ({t("label.optional")})</Label>
                    <div className="flex gap-2">
                      {URGENCY_KEYS.map((level) => (
                        <Button
                          key={level}
                          variant={urgency === level ? "default" : "outline"}
                          size="sm"
                          onClick={() => setUrgency(level)}
                          className="flex-1 text-sm"
                        >
                          {t(`urgency.${level}`)}
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
                  disabled={!title.trim() || !selectedZone}
                  className="w-full"
                >
                  블럭 만들기
                </Button>
              </>
            )}
          </div>
        )}

        {step === "preview" && (
          <div
            className="space-y-6"
            // 자동 반영 카운트다운 진행 중일 때 — 마우스/키 인터랙션이 발생하면 즉시 취소.
            // mouseMove / scroll 은 무시 (그냥 보고 있는 것일 수 있어서).
            onPointerDownCapture={cancelAutoConfirm}
            onKeyDownCapture={cancelAutoConfirm}
          >
            {autoConfirmAt !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {secondsLeft}{t("create.autoConfirm.hint")}
                  </span>
                  <button
                    type="button"
                    onClick={cancelAutoConfirm}
                    className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  >
                    {t("create.autoConfirm.cancel")}
                  </button>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    key={autoConfirmAt}
                    className="h-full bg-foreground/70 origin-left"
                    style={{
                      animation: `autoConfirmShrink ${AUTO_CONFIRM_MS}ms linear forwards`,
                    }}
                  />
                </div>
              </div>
            )}
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
                <Label className="text-sm font-medium">{t("label.facetRequired")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {zones.map((zone) => (
                    <Button
                      key={zone.id}
                      variant={selectedZone === zone.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedZone(zone.id)}
                      className="text-sm"
                    >
                      {translateSeedZoneLabel(zone, language)}
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
                <Label className="text-sm font-normal">{t("label.urgency")} ({t("label.optional")})</Label>
                <div className="flex gap-2">
                  {URGENCY_KEYS.map((level) => (
                    <Button
                      key={level}
                      variant={urgency === level ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUrgency(level)}
                      className="flex-1 text-sm"
                    >
                      {t(`urgency.${level}`)}
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
                  <span>{(() => { const z = zones.find((z) => z.id === selectedZone); return z ? translateSeedZoneLabel(z, language) : "" })()}</span>
                  {dueDate && <span>• {dueDate}</span>}
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {(() => {
                    const z = zones.find((z) => z.id === selectedZone)
                    const zoneLabel = z ? translateSeedZoneLabel(z, language) : ""
                    const hasNearby = existingBlocks.some(
                      (b) => b.zone === selectedZone && !b.isDeleted && !b.isCompleted && !b.isGuide,
                    )
                    if (language === "en") {
                      return hasNearby
                        ? `Placing next to existing blocks in "${zoneLabel}".`
                        : "Placing in an open area that doesn't overlap other blocks."
                    }
                    return hasNearby
                      ? `같은 "${zoneLabel}" 결의 블럭 근처에 배치할게요.`
                      : "다른 블럭들과 겹치지 않는 빈 공간에 배치할게요."
                  })()}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">캔버스에서 미리보기를 확인하세요.</p>
              </div>
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
