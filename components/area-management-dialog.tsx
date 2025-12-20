"use client"

import { useState } from "react"
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const [newZoneLabel, setNewZoneLabel] = useState("")

  const handleEdit = (zone: Zone) => {
    setEditingId(zone.id)
    setEditingLabel(zone.label)
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
          <DialogTitle className="text-xl font-light">영역 관리</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2 font-light">
            작업 공간의 영역을 추가하거나 수정할 수 있어요.
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
                    저장
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-normal">{zone.label}</span>
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
            placeholder="새 영역 이름"
            className="flex-1"
          />
          <Button onClick={handleAddZone} disabled={!newZoneLabel.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>

        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full mt-2">
          닫기
        </Button>
      </DialogContent>
    </Dialog>
  )
}
