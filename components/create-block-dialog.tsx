"use client"

import { useEffect, useState } from "react"
import { Sparkles, Calendar, Loader2, Lock, PenLine } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CanvasViewport, WorkBlock, Zone, Urgency } from "@/types"
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
  visibleCanvasBounds?: CanvasViewport | null
  onShowPreview?: (block: Partial<WorkBlock> | null) => void
  user: { id: string } | null
  onLogin: () => Promise<void>
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
  visibleCanvasBounds,
  onShowPreview,
  user,
  onLogin,
}: CreateBlockDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const [step, setStep] = useState<CreateStep>("input")
  const [showManual, setShowManual] = useState(false)
  const [initialInput, setInitialInput] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>("")
  const [urgency, setUrgency] = useState<Urgency>("thinking")
  const [aiZoneReason, setAiZoneReason] = useState("")
  const [suggestedPosition, setSuggestedPosition] = useState({ x: 0, y: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [url, setUrl] = useState("")
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
      if (aiOutput.suggestedUrl) setUrl(aiOutput.suggestedUrl)
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
        quota_exceeded:
          language === "en"
            ? "Monthly AI limit reached. Filled in with keyword guesses instead."
            : "이번 달 AI 한도를 다 썼어요 — 키워드로 대신 추론했어요.",
      }
      toast.warning(messages[code] ?? messages.network_error)

      const fallback = mockCreateBlockOutput(aiInput)
      setTitle(fallback.title)
      setSummary(fallback.summary)
      setSelectedZone(fallback.suggestedZone)
      setAiZoneReason(fallback.zoneReason)
      setUrgency(fallback.suggestedUrgency)
      if (fallback.suggestedDueDate) setDueDate(fallback.suggestedDueDate)
      if (fallback.suggestedUrl) setUrl(fallback.suggestedUrl)
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
      id: crypto.randomUUID(),
      title,
      detailedNotes: summary || undefined,
      x: position.x,
      y: position.y,
      width: 280,
      height: 116,
      zone: selectedZone,
      urgency,
      dueDate: dueDate || undefined,
      url: url.trim() || undefined,
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

    const position = manual ? findManualPosition() : suggestedPosition

    const newBlock: WorkBlock = {
      id: crypto.randomUUID(),
      title,
      detailedNotes: summary || undefined,
      x: position.x,
      y: position.y,
      width: 280,
      height: 116,
      zone: selectedZone,
      urgency,
      dueDate: dueDate || undefined,
      url: url.trim() || undefined,
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
        detailedNotes: summary || undefined,
        x: smartPosition.x,
        y: smartPosition.y,
        width: 200,
        height: 116,
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
    setUrgency("thinking")
    setAiZoneReason("")
    setIsLoading(false)
    setUrl("")
    setAutoConfirmAt(null)
    setShowManual(false)
    onOpenChange(false)
  }

  const findSmartPosition = (): { x: number; y: number } => {
    const BLOCK_WIDTH = 280
    const BLOCK_HEIGHT = 130
    const SPACING = 40
    const MIN_X = 100
    const MIN_Y = 100
    const VIEWPORT_PADDING = 48

    const fallbackBounds: CanvasViewport = {
      x: MIN_X,
      y: MIN_Y,
      width: typeof window === "undefined" ? 1200 : window.innerWidth,
      height: typeof window === "undefined" ? 800 : Math.max(window.innerHeight - 120, 480),
    }

    const viewport = visibleCanvasBounds ?? fallbackBounds
    const minX = Math.round(viewport.x + VIEWPORT_PADDING)
    const minY = Math.round(viewport.y + VIEWPORT_PADDING)
    const maxX = Math.max(minX, Math.round(viewport.x + viewport.width - BLOCK_WIDTH - VIEWPORT_PADDING))
    const maxY = Math.max(minY, Math.round(viewport.y + viewport.height - BLOCK_HEIGHT - VIEWPORT_PADDING))

    // 배치 충돌은 가이드/기본 블럭까지 포함한다. 삭제/갈무리 블럭만 제외.
    const layoutBlocks = existingBlocks.filter((b) => !b.isDeleted && !b.isCompleted)

    // 겹침 체크 함수
    const isOverlapping = (x: number, y: number, checkBlocks = layoutBlocks): boolean => {
      return checkBlocks.some((block) => {
        const horizontalOverlap = x < block.x + block.width + SPACING && x + BLOCK_WIDTH + SPACING > block.x
        const verticalOverlap = y < block.y + block.height + SPACING && y + BLOCK_HEIGHT + SPACING > block.y
        return horizontalOverlap && verticalOverlap
      })
    }

    const isInsideViewport = (x: number, y: number): boolean => x >= minX && x <= maxX && y >= minY && y <= maxY
    const blockIntersectsViewport = (block: WorkBlock): boolean =>
      block.x + block.width >= minX &&
      block.x <= maxX + BLOCK_WIDTH &&
      block.y + block.height >= minY &&
      block.y <= maxY + BLOCK_HEIGHT

    const pickFirstOpen = (candidates: Array<{ x: number; y: number }>) => {
      for (const candidate of candidates) {
        const x = Math.round(candidate.x)
        const y = Math.round(candidate.y)
        if (isInsideViewport(x, y) && !isOverlapping(x, y)) {
          return { x, y }
        }
      }
      return null
    }

    const findOpenInViewport = () => {
      const stepX = BLOCK_WIDTH + SPACING
      const stepY = BLOCK_HEIGHT + SPACING
      for (let y = minY; y <= maxY; y += stepY) {
        for (let x = minX; x <= maxX; x += stepX) {
          if (!isOverlapping(x, y)) return { x, y }
        }
      }
      return { x: minX, y: minY }
    }

    // 1. 현재 보고 있는 화면 안의 같은 결 블럭 근처를 우선한다.
    const sameZoneBlocks = layoutBlocks.filter((b) => b.zone === selectedZone && blockIntersectsViewport(b))

    if (sameZoneBlocks.length > 0) {
      // 같은 결의 블럭들 중 현재 시선에서 가장 오른쪽/아래쪽에 가까운 블럭.
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

      const candidate = pickFirstOpen(candidates)
      if (candidate) return candidate

      // 모든 후보가 실패하면 같은 결 블럭들 아래쪽을 먼저 시도하되, 화면 밖으로 나가면 그리드 탐색.
      const lowestSameZone = sameZoneBlocks.reduce((lowest, block) => {
        const lowestBottom = lowest.y + lowest.height
        const blockBottom = block.y + block.height
        return blockBottom > lowestBottom ? block : lowest
      })

      const below = {
        x: lowestSameZone.x,
        y: lowestSameZone.y + lowestSameZone.height + SPACING * 2,
      }
      const openBelow = pickFirstOpen([below])
      if (openBelow) return openBelow
    }

    // 2. 같은 결이 화면 안에 없으면, 현재 보이는 화면 안에서 빈 칸을 찾는다.
    return findOpenInViewport()
  }

  const findManualPosition = (): { x: number; y: number } => {
    const BLOCK_WIDTH = 280
    const BLOCK_HEIGHT = 130
    const VIEWPORT_PADDING = 48
    const viewport = visibleCanvasBounds ?? {
      x: 100,
      y: 100,
      width: typeof window === "undefined" ? 1200 : window.innerWidth,
      height: typeof window === "undefined" ? 800 : Math.max(window.innerHeight - 120, 480),
    }
    const minX = Math.round(viewport.x + VIEWPORT_PADDING)
    const minY = Math.round(viewport.y + VIEWPORT_PADDING)
    const maxX = Math.max(minX, Math.round(viewport.x + viewport.width - BLOCK_WIDTH - VIEWPORT_PADDING))
    const maxY = Math.max(minY, Math.round(viewport.y + viewport.height - BLOCK_HEIGHT - VIEWPORT_PADDING))
    const layoutBlocks = existingBlocks.filter((b) => !b.isDeleted && !b.isCompleted)
    const overlaps = (x: number, y: number) =>
      layoutBlocks.some((block) => {
        const horizontalOverlap = x < block.x + block.width + 24 && x + BLOCK_WIDTH + 24 > block.x
        const verticalOverlap = y < block.y + block.height + 24 && y + BLOCK_HEIGHT + 24 > block.y
        return horizontalOverlap && verticalOverlap
      })

    for (let i = 0; i < 16; i += 1) {
      const x = Math.round(minX + Math.random() * Math.max(0, maxX - minX))
      const y = Math.round(minY + Math.random() * Math.max(0, maxY - minY))
      if (!overlaps(x, y)) return { x, y }
    }

    return findSmartPosition()
  }

  return (
    <Dialog open={open} onOpenChange={handleReset}>
      <DialogContent className="sm:max-w-[480px]">
        {step === "input" && !user && isAIEnabled && !showManual && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-normal">새 블럭 만들기</h2>
              <p className="text-sm text-muted-foreground">AI 생성은 로그인 후 사용할 수 있어요.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={onLogin}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    AI로 생성
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Google 로그인 후 AI가 자동으로 정리해요</p>
                </div>
              </button>
              <button
                onClick={() => setShowManual(true)}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <PenLine className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">직접 입력</div>
                  <p className="text-xs text-muted-foreground mt-0.5">제목과 내용을 직접 작성해요</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "input" && (user || !isAIEnabled || showManual) && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-normal">
                {isAIEnabled && user ? "추가할 업무를 간단히 적어주세요." : "새 블럭 만들기"}
              </h2>
              {(!isAIEnabled || !user) && <p className="text-sm text-muted-foreground">제목과 내용을 직접 입력하세요.</p>}
            </div>

            {isAIEnabled && user ? (
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

                  <div className="space-y-2">
                    <Label htmlFor="manual-url" className="text-sm font-normal">
                      {t("label.url")} ({t("label.optional")})
                    </Label>
                    <Input
                      id="manual-url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://"
                      className="font-light"
                    />
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

              <div className="space-y-2">
                <Label htmlFor="preview-url" className="text-sm font-normal">
                  {t("label.url")} ({t("label.optional")})
                </Label>
                <Input
                  id="preview-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  className="font-light"
                />
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
