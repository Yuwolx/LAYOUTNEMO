"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WorkBlock } from "@/types"
import { RotateCcw, Trash2 } from "lucide-react"

interface TrashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deletedBlocks: WorkBlock[]
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
}

export function TrashDialog({ open, onOpenChange, deletedBlocks, onRestore, onPermanentDelete }: TrashDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal">휴지통</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {deletedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">휴지통이 비어있습니다.</p>
          ) : (
            deletedBlocks.map((block) => (
              <div
                key={block.id}
                className="p-4 border border-border/40 rounded-lg bg-background/50 hover:bg-background transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-normal text-base mb-1">{block.title}</h4>
                    {block.description && (
                      <p className="text-sm text-muted-foreground/80 line-clamp-2">{block.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => onRestore(block.id)} className="text-xs">
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      복원
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPermanentDelete(block.id)}
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      영구 삭제
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
