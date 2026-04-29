"use client"

import { useState, useEffect } from "react"
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
  onUpdate: (updates: Partial<WorkBlock>) => void
  zones: Array<{ id: string; label: string }>
}

const URGENCY_COLOR_HEX: Record<Urgency, string> = {
  stable: "rgb(156, 163, 175)",
  thinking: "rgb(59, 130, 246)",
  lingering: "rgb(251, 191, 36)",
  urgent: "rgb(251, 146, 60)",
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
  const [urgency, setUrgency] = useState<"stable" | "thinking" | "lingering" | "urgent">(block.urgency || "stable")
  const [url, setUrl] = useState(block.url || "")
  const [tag, setTag] = useState(block.tag || "")

  useEffect(() => {
    if (open) {
      setTitle(displayTitle)
      setDescription(displayDescription)
      setDetailedNotes(displayNotes || "")
      setDueDate(block.dueDate || "")
      setZone(block.zone)
      setUrgency(block.urgency || "stable")
      setUrl(block.url || "")
      setTag(block.tag || "")
    }
  }, [open, block, language, displayTitle, displayDescription, displayNotes])

  const handleSave = () => {
    // 번역본을 그대로 두고 저장하면 원본(ko) 보존. 편집했으면 입력값 반영.
    const finalTitle = title === displayTitle ? block.title : title
    const finalDescription = description === displayDescription ? block.description : description
    const finalNotes = detailedNotes === (displayNotes || "") ? (block.detailedNotes || "") : detailedNotes
    onUpdate({
      title: finalTitle,
      description: finalDescription,
      detailedNotes: finalNotes,
      dueDate: dueDate || undefined,
      zone,
      urgency,
      url: url.trim() || undefined,
      tag: tag.trim() || undefined,
    })
    onOpenChange(false)
  }

  const handleComplete = () => {
    // 갈무리 — 위치/크기/시급도 전부 원본 유지. 꺼냈을 때 원래 자리로 복귀되도록.
    onUpdate({ isCompleted: true })
    onOpenChange(false)
  }

  const isCompleted = block.isCompleted || false
  const isGuide = block.isGuide || false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-light">{isGuide ? (t("dialog.blockDetail.title") === "Block Details" ? "Guide" : "사용 설명서") : t("dialog.blockDetail.title")}</DialogTitle>
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

              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">{t("label.description")}</Label>
                <p className="text-sm text-muted-foreground leading-relaxed">{displayDescription}</p>
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
                <Label htmlFor="description" className="text-sm font-normal">
                  {t("label.description")}
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] resize-none"
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
                <Label htmlFor="detailed-notes" className="text-sm font-normal">
                  {t("label.notes")}
                </Label>
                <Textarea
                  id="detailed-notes"
                  value={detailedNotes}
                  onChange={(e) => setDetailedNotes(e.target.value)}
                  placeholder={t("label.notes")}
                  className="min-h-[140px] resize-none"
                />
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
                <Label htmlFor="block-tag" className="text-sm font-normal">
                  {t("label.tag")} ({t("label.optional")})
                </Label>
                <Input
                  id="block-tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder={t("placeholder.tag")}
                  maxLength={20}
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
                <Button onClick={handleSave} className="flex-1">
                  {t("action.save")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
