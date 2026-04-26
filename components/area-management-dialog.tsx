"use client"

import { useState } from "react"
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
}

export function AreaManagementDialog({ open, onOpenChange, zones, onUpdateZones }: AreaManagementDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const [newZoneLabel, setNewZoneLabel] = useState("")

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
    onUpdateZones(zones.filter((z) => z.id !== id))
  }

  const handleAddZone = () => {
    if (newZoneLabel.trim()) {
      const newZone: Zone = {
        id: `zone-${Date.now()}`,
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
              className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-background hover:bg-accent/20 transition-colors"
            >
              {editingId === zone.id ? (
                <>
                  <Input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
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
          ))}
        </div>

        <div className="flex gap-2 pt-4 border-t border-border/30 mt-2">
          <Input
            value={newZoneLabel}
            onChange={(e) => setNewZoneLabel(e.target.value)}
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
