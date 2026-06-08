"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WorkBlock, Urgency } from "@/types"
import { URGENCY_KEYS, URGENCY_META } from "@/lib/constants/urgency"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedBlockField, translateSeedZoneLabel } from "@/lib/i18n/seed"

interface BlockDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  block: WorkBlock
  onUpdate: (updates: Partial<WorkBlock>, skipHistory?: boolean) => void
  zones: Array<{ id: string; label: string }>
}

const URGENCY_COLOR_HEX: Record<Urgency, string> = {
  stable: "rgb(147, 197, 253)",
  thinking: "rgb(212, 212, 216)",
  lingering: "rgb(134, 239, 172)",
  urgent: "rgb(252, 165, 165)",
}

type DraftValues = {
  title: string
  description: string | undefined
  detailedNotes: string
  dueDate: string
  zone: string
  urgency: Urgency
  url: string
}

type DraftBaseline = {
  titleDisplay: string
  descriptionDisplay: string | undefined
  notesDisplay: string
  sourceTitle: string
  sourceDescription: string | undefined
  sourceNotes: string
}

export function BlockDetailDialog({ open, onOpenChange, block, onUpdate, zones }: BlockDetailDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const displayTitle = translateSeedBlockField(block, "title", language) ?? block.title
  const displayDescription = translateSeedBlockField(block, "description", language) ?? block.description
  const displayNotes = translateSeedBlockField(block, "detailedNotes", language) ?? block.detailedNotes
  // 편집 폼은 현재 언어의 번역본을 초기값으로 보여준다.
  // 사용자가 실제로 편집했을 때만 저장값을 덮어쓰고, 그대로 두면 원본(ko) 그대로 유지.
  const [title, setTitle] = useState(displayTitle)
  const [description, setDescription] = useState(displayDescription)
  const [detailedNotes, setDetailedNotes] = useState(displayNotes || "")
  const [dueDate, setDueDate] = useState(block.dueDate || "")
  const [zone, setZone] = useState(block.zone)
  const [urgency, setUrgency] = useState<Urgency>(block.urgency || "thinking")
  const [url, setUrl] = useState(block.url || "")
  const isCompleted = block.isCompleted || false
  const isGuide = block.isGuide || false

  const baselineRef = useRef<DraftBaseline>({
    titleDisplay: displayTitle,
    descriptionDisplay: displayDescription,
    notesDisplay: displayNotes || "",
    sourceTitle: block.title,
    sourceDescription: block.description,
    sourceNotes: block.detailedNotes || "",
  })
  const lastSavedDraftRef = useRef("")
  const lastHistoryDraftRef = useRef("")

  const buildUpdates = useCallback((values: DraftValues): Partial<WorkBlock> => {
    const baseline = baselineRef.current
    return {
      title: values.title === baseline.titleDisplay ? baseline.sourceTitle : values.title,
      description:
        values.description === baseline.descriptionDisplay
          ? baseline.sourceDescription
          : values.description,
      detailedNotes:
        values.detailedNotes === baseline.notesDisplay
          ? baseline.sourceNotes
          : values.detailedNotes,
      dueDate: values.dueDate || undefined,
      zone: values.zone,
      urgency: values.urgency,
      url: values.url.trim() || undefined,
    }
  }, [])

  const getCurrentDraftValues = useCallback(
    (): DraftValues => ({
      title,
      description,
      detailedNotes,
      dueDate,
      zone,
      urgency,
      url,
    }),
    [description, detailedNotes, dueDate, title, urgency, url, zone],
  )

  useEffect(() => {
    if (open) {
      const nextValues: DraftValues = {
        title: displayTitle,
        description: displayDescription,
        detailedNotes: displayNotes || "",
        dueDate: block.dueDate || "",
        zone: block.zone,
        urgency: block.urgency || "thinking",
        url: block.url || "",
      }

      baselineRef.current = {
        titleDisplay: nextValues.title,
        descriptionDisplay: nextValues.description,
        notesDisplay: nextValues.detailedNotes,
        sourceTitle: block.title,
        sourceDescription: block.description,
        sourceNotes: block.detailedNotes || "",
      }

      setTitle(nextValues.title)
      setDescription(nextValues.description)
      setDetailedNotes(nextValues.detailedNotes)
      setDueDate(nextValues.dueDate)
      setZone(nextValues.zone)
      setUrgency(nextValues.urgency)
      setUrl(nextValues.url)

      const serialized = JSON.stringify(buildUpdates(nextValues))
      lastSavedDraftRef.current = serialized
      lastHistoryDraftRef.current = serialized
    }
    // autosave 로 block prop 이 바뀌어도 입력 중인 폼은 다시 초기화하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, block.id, language])

  const commitDraft = useCallback(
    (skipHistory = true, forceHistory = false) => {
      if (!open || isGuide || isCompleted) return

      const updates = buildUpdates(getCurrentDraftValues())
      const serialized = JSON.stringify(updates)

      if (forceHistory) {
        if (serialized !== lastHistoryDraftRef.current) {
          lastSavedDraftRef.current = serialized
          lastHistoryDraftRef.current = serialized
          onUpdate(updates, false)
        }
        return
      }

      if (serialized === lastSavedDraftRef.current) return
      lastSavedDraftRef.current = serialized
      onUpdate(updates, skipHistory)
    },
    [buildUpdates, getCurrentDraftValues, isCompleted, isGuide, onUpdate, open],
  )

  useEffect(() => {
    if (!open || isGuide || isCompleted) return
    const timer = window.setTimeout(() => commitDraft(true), 500)
    return () => window.clearTimeout(timer)
  }, [commitDraft, isCompleted, isGuide, open])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) commitDraft(false, true)
    onOpenChange(nextOpen)
  }

  const handleComplete = () => {
    // 갈무리 — 위치/크기/시급도 전부 원본 유지. 꺼냈을 때 원래 자리로 복귀되도록.
    const updates = buildUpdates(getCurrentDraftValues())
    const serialized = JSON.stringify({ ...updates, isCompleted: true })
    lastSavedDraftRef.current = serialized
    lastHistoryDraftRef.current = serialized
    onUpdate({ ...updates, isCompleted: true })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[760px] lg:max-w-[860px] max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-light">{isGuide ? (t("dialog.blockDetail.title") === "Block Details" ? "Guide" : "사용 설명서") : t("dialog.blockDetail.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {isGuide ? (
            <div className="space-y-4">
              <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {displayNotes}
              </div>
              <div className="pt-4 border-t border-border/30">
                <Button onClick={() => onOpenChange(false)} className="w-full">
                  {t("action.close")}
                </Button>
              </div>
            </div>
          ) : isCompleted ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">{t("label.title")}</Label>
                <p className="text-base font-normal">{displayTitle}</p>
              </div>

              {displayNotes && (
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">{t("label.notes")}</Label>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {displayNotes}
                  </p>
                </div>
              )}

              {block.dueDate && (
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground">{t("label.dueDate")}</Label>
                  <p className="text-sm">{block.dueDate}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-normal">
                  {t("label.title")}
                </Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="detailed-notes-top" className="text-sm font-normal">
                  {t("label.notes")}
                </Label>
                <Textarea
                  id="detailed-notes-top"
                  value={detailedNotes}
                  onChange={(e) => setDetailedNotes(e.target.value)}
                  placeholder={t("label.notes")}
                  className="min-h-[120px] resize-none text-base leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-normal">{t("label.facet")}</Label>
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
                      {translateSeedZoneLabel(z, language)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-normal">{t("label.urgency")}</Label>
                <div className="space-y-2">
                  {URGENCY_KEYS.map((key) => {
                    const color = URGENCY_COLOR_HEX[key]
                    return (
                      <button
                        key={key}
                        onClick={() => setUrgency(key)}
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
                        <span className="text-sm font-light">{t(`urgency.${key}`)} ({t(`urgency.${key}.color`)})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due-date" className="text-sm font-normal">
                  {t("label.dueDate")}
                </Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="font-light"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="block-url" className="text-sm font-normal">
                  {t("label.url")} ({t("label.optional")})
                </Label>
                <Input
                  id="block-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  className="font-light"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/30">
                <Button onClick={handleComplete} variant="outline" className="flex-1 font-light bg-transparent">
                  {t("action.archive")}
                </Button>
                <Button onClick={() => handleDialogOpenChange(false)} className="flex-1">
                  {t("action.close")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
