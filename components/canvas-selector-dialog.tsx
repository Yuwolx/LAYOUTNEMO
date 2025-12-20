"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Plus } from "lucide-react"
import type { Canvas } from "@/types"

interface CanvasSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canvases: Canvas[]
  currentCanvasId: string
  onSelectCanvas: (id: string) => void
  onRenameCanvas: (id: string, newName: string) => void
  onDeleteCanvas: (id: string) => void
  onCreateCanvas: (name: string) => void
}

export function CanvasSelectorDialog({
  open,
  onOpenChange,
  canvases,
  currentCanvasId,
  onSelectCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  onCreateCanvas,
}: CanvasSelectorDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [newCanvasName, setNewCanvasName] = useState("")

  const handleStartEdit = (canvas: Canvas) => {
    setEditingId(canvas.id)
    setEditingName(canvas.name)
  }

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onRenameCanvas(editingId, editingName.trim())
      setEditingId(null)
      setEditingName("")
    }
  }

  const handleCreateCanvas = () => {
    if (newCanvasName.trim()) {
      onCreateCanvas(newCanvasName.trim())
      setNewCanvasName("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>캔버스 선택</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                ${currentCanvasId === canvas.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"}
              `}
            >
              {editingId === canvas.id ? (
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit()
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  className="flex-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    onSelectCanvas(canvas.id)
                    onOpenChange(false)
                  }}
                  className="flex-1 text-left font-medium"
                >
                  {canvas.name}
                </button>
              )}

              <div className="flex items-center gap-2">
                {editingId === canvas.id ? (
                  <Button size="sm" onClick={handleSaveEdit}>
                    저장
                  </Button>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => handleStartEdit(canvas)} className="h-8 w-8">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {canvases.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeleteCanvas(canvas.id)}
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Input
            placeholder="새 캔버스 이름"
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateCanvas()
            }}
          />
          <Button onClick={handleCreateCanvas}>
            <Plus className="w-4 h-4 mr-2" />
            생성
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
