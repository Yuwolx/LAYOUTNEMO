"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Plus, Download, Lock } from "lucide-react"
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
  /** 캔버스 추가 생성 가능 여부 — 무료 플랜 한도 도달 시 false (유료화 대비 잠금) */
  canCreate: boolean
  /** 플랜 정보 로딩 완료 여부 — false 면 잠금 문구 대신 중립 상태 (pro 유저 오인 방지) */
  planReady: boolean
  /** 캔버스를 지우면 무료 한도 때문에 다시 못 만드는 상황인지 — 삭제 확인창에 경고 추가 */
  deleteLosesSlot: boolean
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
  canCreate,
  planReady,
  deleteLosesSlot,
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
    let message =
      language === "en"
        ? `Delete the canvas "${name}"? All of its blocks and facets will be removed.`
        : `'${name}' 캔버스를 삭제할까요? 이 캔버스의 블럭과 결이 모두 사라집니다.`
    if (deleteLosesSlot) {
      // 한도 초과분(기존 다중 캔버스)은 지우면 되돌릴 수 없다 — 조용한 다운그레이드 방지.
      message +=
        language === "en"
          ? "\n\nNote: on the free plan you won't be able to create a new canvas afterward."
          : "\n\n참고: 무료 플랜에서는 삭제 후 새 캔버스를 다시 만들 수 없어요."
    }
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
                ${currentCanvasId === canvas.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-[#3b414d] hover:bg-gray-50 dark:hover:bg-[#333944]"}
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
          canCreate ? (
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
          ) : planReady ? (
            <p className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              {language === "en"
                ? "More canvases are coming with the paid plan."
                : "추가 캔버스는 준비 중인 유료 플랜에서 열려요."}
            </p>
          ) : (
            // 플랜 로딩 전 — pro 유저에게 잠금 문구를 잘못 보여주지 않도록 중립 상태
            <div className="mt-6 pt-4 border-t" aria-hidden />
          )
        ) : (
          <p className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
            {language === "en"
              ? "Sign in to sync your canvas across devices."
              : "로그인하면 캔버스가 기기 간에 동기화돼요."}
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
