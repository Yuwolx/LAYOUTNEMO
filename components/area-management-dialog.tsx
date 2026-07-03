"use client"

import { useEffect, useState } from "react"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedZoneLabel } from "@/lib/i18n/seed"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Zone } from "@/types"

interface AreaManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  zones: Zone[]
  onUpdateZones: (zones: Zone[]) => void
  /** 결 id → 그 결에 속한 (삭제되지 않은) 블럭 수. 삭제 시 재배정 안내에 사용. */
  blockCountByZone: Record<string, number>
  /** 결 삭제 + 그 결 블럭 재배정. moveToZoneId 가 "" 이면 미분류. */
  onDeleteZone: (zoneId: string, moveToZoneId: string) => void
}

export function AreaManagementDialog({
  open,
  onOpenChange,
  zones,
  onUpdateZones,
  blockCountByZone,
  onDeleteZone,
}: AreaManagementDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const [newZoneLabel, setNewZoneLabel] = useState("")
  // 삭제 진행 중인 결 id + 그 블럭들을 옮길 대상 ("" = 미분류)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState("")

  useEffect(() => {
    if (open) {
      setEditingId(null)
      setDeletingId(null)
      setMoveTarget("")
    }
  }, [open])

  const handleEdit = (zone: Zone) => {
    setEditingId(zone.id)
    setEditingLabel(translateSeedZoneLabel(zone, language))
  }

  const handleSaveEdit = () => {
    if (editingId && editingLabel.trim()) {
      onUpdateZones(zones.map((z) => (z.id === editingId ? { ...z, label: editingLabel } : z)))
      setEditingId(null)
      setEditingLabel("")
    }
  }

  const handleDelete = (id: string) => {
    const zone = zones.find((z) => z.id === id)
    const label = zone ? translateSeedZoneLabel(zone, language) : id
    const count = blockCountByZone[id] ?? 0

    // 블럭이 없으면 재배정할 게 없으므로 바로 확인 후 삭제.
    if (count === 0) {
      const message =
        language === "en" ? `Delete the facet "${label}"?` : `'${label}' 결을 삭제할까요?`
      if (!window.confirm(message)) return
      onDeleteZone(id, "")
      return
    }

    // 블럭이 있으면 어디로 옮길지 고르는 단계를 연다.
    setEditingId(null)
    setDeletingId(id)
    setMoveTarget("")
  }

  const handleConfirmDelete = () => {
    if (!deletingId) return
    onDeleteZone(deletingId, moveTarget)
    setDeletingId(null)
    setMoveTarget("")
  }

  const handleAddZone = () => {
    if (newZoneLabel.trim()) {
      const newZone: Zone = {
        id: crypto.randomUUID(),
        label: newZoneLabel,
        color: "rgba(200, 200, 200, 0.1)",
      }
      onUpdateZones([...zones, newZone])
      setNewZoneLabel("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-light">{t("dialog.manageFacets.title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2 font-light">
            {t("dialog.manageFacets.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 pt-4">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="p-3 rounded-xl border border-border/50 bg-background hover:bg-accent/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                {editingId === zone.id ? (
                  <>
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit()
                        if (e.key === "Escape") {
                          setEditingId(null)
                          setEditingLabel("")
                        }
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveEdit}>
                      {t("action.save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      {t("action.cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-normal">{translateSeedZoneLabel(zone, language)}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(zone)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(zone.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>

              {deletingId === zone.id && (
                <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {language === "en"
                      ? `"${translateSeedZoneLabel(zone, language)}" has ${blockCountByZone[zone.id] ?? 0} block(s). ${t("facet.delete.moveHeading")}`
                      : `'${translateSeedZoneLabel(zone, language)}' 결에 블럭 ${blockCountByZone[zone.id] ?? 0}개가 있어요. ${t("facet.delete.moveHeading")}`}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setMoveTarget("")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-light transition-all ${
                        moveTarget === ""
                          ? "bg-foreground text-background"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t("facet.delete.unassigned")}
                    </button>
                    {zones
                      .filter((z) => z.id !== zone.id)
                      .map((z) => (
                        <button
                          key={z.id}
                          onClick={() => setMoveTarget(z.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-light transition-all ${
                            moveTarget === z.id
                              ? "bg-foreground text-background"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {translateSeedZoneLabel(z, language)}
                        </button>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={handleConfirmDelete}>
                      {t("facet.delete.apply")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                      {t("action.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4 border-t border-border/30 mt-2">
          <Input
            value={newZoneLabel}
            onChange={(e) => setNewZoneLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddZone()
            }}
            placeholder={t("dialog.manageFacets.placeholder")}
            className="flex-1"
          />
          <Button onClick={handleAddZone} disabled={!newZoneLabel.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            {t("action.add")}
          </Button>
        </div>

        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full mt-2">
          {t("action.close")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
