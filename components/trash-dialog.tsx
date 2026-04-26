"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WorkBlock } from "@/types"
import { RotateCcw, Trash2 } from "lucide-react"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedBlockField } from "@/lib/i18n/seed"

interface TrashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deletedBlocks: WorkBlock[]
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
}

export function TrashDialog({ open, onOpenChange, deletedBlocks, onRestore, onPermanentDelete }: TrashDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const emptyText = language === "en" ? "Trash is empty." : "휴지통이 비어있습니다."
  const permaDeleteText = language === "en" ? "Delete forever" : "영구 삭제"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">{t("dialog.trash.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {deletedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyText}</p>
          ) : (
            deletedBlocks.map((block) => {
              const displayTitle = translateSeedBlockField(block, "title", language) ?? block.title
              const displayDescription = translateSeedBlockField(block, "description", language) ?? block.description
              return (
                <div
                  key={block.id}
                  className="p-4 border border-border/40 rounded-lg bg-background/50 hover:bg-background transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-normal text-base mb-1">{displayTitle}</h4>
                      {displayDescription && (
                        <p className="text-sm text-muted-foreground/80 line-clamp-2">{displayDescription}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => onRestore(block.id)} className="text-xs">
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        {t("action.restore")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPermanentDelete(block.id)}
                        className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        {permaDeleteText}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
