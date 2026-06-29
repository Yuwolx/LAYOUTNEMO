"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RotateCcw, Package, Trash2 } from "lucide-react"
import type { WorkBlock, Zone } from "@/types"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedBlockField } from "@/lib/i18n/seed"
import { URGENCY_META } from "@/lib/constants/urgency"

interface ArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  archivedBlocks: WorkBlock[]
  zones: Zone[]
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

/**
 * 갈무리함 다이얼로그. 조약돌(작은 정사각형) 타일 그리드로 표시.
 * - 타일 hover: "꺼내기" / "삭제" 액션
 * - 결 색상을 타일 상단 띠로 얇게 표시해 출처 식별
 * - 시급도는 좌상단 작은 점으로만 표현 (공간 절약)
 */
export function ArchiveDialog({
  open,
  onOpenChange,
  archivedBlocks,
  zones,
  onRestore,
  onDelete,
  onClearAll,
}: ArchiveDialogProps) {
  const { language } = useLanguage()
  const t = useT()

  const urgencyDotColor: Record<string, string> = {
    stable: "bg-blue-300",
    thinking: "bg-zinc-300",
    lingering: "bg-green-300",
    urgent: "bg-red-300",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-10">
            <DialogTitle className="flex items-center gap-2 text-xl font-light">
              <Package className="w-5 h-5" />
              {t("archive.dialog.title")}
              {archivedBlocks.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {archivedBlocks.length}
                  {language === "ko" ? t("archive.dialog.count") : ` ${t("archive.dialog.count")}`}
                </span>
              )}
            </DialogTitle>
            {archivedBlocks.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={onClearAll}
                className="h-8 shrink-0 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                {language === "ko" ? "비우기" : "Clear"}
              </Button>
            )}
          </div>
          <DialogDescription className="text-sm leading-relaxed font-light pt-1">
            {t("archive.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {archivedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t("archive.dialog.empty")}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {archivedBlocks.map((block) => {
                const zone = zones.find((z) => z.id === block.zone)
                const title = translateSeedBlockField(block, "title", language) ?? block.title
                const dotClass = urgencyDotColor[block.urgency || "thinking"]
                return (
                  <div
                    key={block.id}
                    className="group relative aspect-square rounded-xl border border-border/60 bg-card hover:bg-accent/40 transition-all overflow-hidden"
                  >
                    {/* 결 색상 띠 */}
                    {zone && (
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: zone.color.replace("0.1", "0.8") }}
                      />
                    )}
                    {/* 시급도 점 */}
                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${dotClass}`} />

                    {/* 타일 본문 */}
                    <div className="p-2.5 pt-4 h-full flex items-start">
                      <h4 className="text-xs font-medium leading-snug line-clamp-4 text-card-foreground pr-3">
                        {title}
                      </h4>
                    </div>

                    {/* hover 액션 */}
                    <div className="absolute inset-0 bg-background/92 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onRestore(block.id)}
                        className="w-full text-[11px] h-7"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        {t("action.unarchive")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(block.id)}
                        className="w-full text-[11px] h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {t("action.delete")}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
