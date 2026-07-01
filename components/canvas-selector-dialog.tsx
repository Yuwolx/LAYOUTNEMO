"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Plus, Download } from "lucide-react"
import type { Canvas } from "@/types"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedCanvasName } from "@/lib/i18n/seed"

interface CanvasSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canvases: Canvas[]
  currentCanvasId: string
  onSelectCanvas: (id: string) => void
  onRenameCanvas: (id: string, newName: string) => void
  onDeleteCanvas: (id: string) => void
  onCreateCanvas: (name: string) => void
  onExport: () => void
  user: { id: string } | null
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
  onExport,
  user,
}: CanvasSelectorDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const newCanvasPlaceholder = language === "en" ? "New canvas name" : "새 캔버스 이름"
  const createLabel = language === "en" ? "Create" : "생성"
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [newCanvasName, setNewCanvasName] = useState("")

  const handleStartEdit = (canvas: Canvas) => {
    setEditingId(canvas.id)
    setEditingName(translateSeedCanvasName(canvas, language))
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

  const handleDeleteCanvas = (canvas: Canvas) => {
    const name = translateSeedCanvasName(canvas, language)
    const message =
      language === "en"
        ? `Delete the canvas "${name}"? All of its blocks and facets will be removed.`
        : `'${name}' 캔버스를 삭제할까요? 이 캔버스의 블럭과 결이 모두 사라집니다.`
    if (!window.confirm(message)) return
    onDeleteCanvas(canvas.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("dialog.canvasSelector.title")}</DialogTitle>
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
                  {translateSeedCanvasName(canvas, language)}
                </button>
              )}

              <div className="flex items-center gap-2">
                {editingId === canvas.id ? (
                  <Button size="sm" onClick={handleSaveEdit}>
                    {t("action.save")}
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
                        onClick={() => handleDeleteCanvas(canvas)}
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

        {user ? (
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Input
              placeholder={newCanvasPlaceholder}
              value={newCanvasName}
              onChange={(e) => setNewCanvasName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCanvas()
              }}
            />
            <Button onClick={handleCreateCanvas}>
              <Plus className="w-4 h-4 mr-2" />
              {createLabel}
            </Button>
          </div>
        ) : (
          <p className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
            로그인하면 여러 캔버스를 사용할 수 있어요
          </p>
        )}

        <div className="mt-3 flex justify-center">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            {language === "en" ? "Export all as JSON (backup)" : "전체 백업 내보내기 (.json)"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
