"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import type { WorkBlock, Zone } from "@/types"
import { useLanguage } from "@/lib/i18n/context"
import { translateSeedBlockField, translateSeedZoneLabel } from "@/lib/i18n/seed"

interface BlockSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 현재 캔버스에 보이는(활성) 블럭들 */
  blocks: WorkBlock[]
  zones: Zone[]
  /** 블럭 선택 시 캔버스를 그 블럭으로 이동 */
  onJump: (blockId: string) => void
}

/**
 * 캔버스 안에서 블럭을 제목/메모로 검색해 바로 이동(Cmd/Ctrl+F).
 * 캔버스 선택(Cmd+K)과 별개로, 한 캔버스 안의 블럭을 찾는 용도.
 */
export function BlockSearchDialog({ open, onOpenChange, blocks, zones, onJump }: BlockSearchDialogProps) {
  const { language } = useLanguage()
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (open) setQuery("")
  }, [open])

  const zoneLabel = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId)
    return zone ? translateSeedZoneLabel(zone, language) : ""
  }

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return blocks.slice(0, 8)
    return blocks
      .filter((b) => {
        const title = (translateSeedBlockField(b, "title", language) ?? b.title ?? "").toLowerCase()
        const notes = (translateSeedBlockField(b, "detailedNotes", language) ?? b.detailedNotes ?? "").toLowerCase()
        return title.includes(term) || notes.includes(term)
      })
      .slice(0, 30)
  }, [query, blocks, language])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-base font-normal">
            {language === "en" ? "Find a block" : "블럭 찾기"}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "en" ? "Search by title or notes…" : "제목·메모로 검색…"}
            className="pl-9"
          />
        </div>

        <div className="mt-1 max-h-[52vh] space-y-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              {language === "en" ? "No matching blocks." : "일치하는 블럭이 없어요."}
            </p>
          ) : (
            results.map((b) => {
              const title = translateSeedBlockField(b, "title", language) ?? b.title
              const label = zoneLabel(b.zone)
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    onJump(b.id)
                    onOpenChange(false)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="truncate text-sm font-medium">
                    {title || (language === "en" ? "(untitled)" : "(제목 없음)")}
                  </div>
                  {label && <div className="truncate text-xs text-muted-foreground">{label}</div>}
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
