"use client"

import { Eye, Moon, Sun, Trash2, Undo2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import type { Zone } from "@/types"

interface HeaderProps {
  onCreateBlock: () => void
  onReflect: () => void
  zones: Zone[]
  selectedZone: string | null
  onZoneSelect: (zoneId: string | null) => void
  onManageAreas: () => void
  showRelationships: boolean
  onToggleRelationships: () => void
  showCompletedBlocks: boolean
  onToggleCompletedBlocks: () => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  trashCount: number
  onOpenTrash: () => void
  onUndo: () => void
  canUndo: boolean
  isAIEnabled: boolean
  onToggleAI: () => void
  currentCanvasName: string
  onOpenCanvasSelector: () => void
  lastSaved: Date
}

export function Header({
  onCreateBlock,
  onReflect,
  zones,
  selectedZone,
  onZoneSelect,
  onManageAreas,
  showRelationships,
  onToggleRelationships,
  showCompletedBlocks,
  onToggleCompletedBlocks,
  isDarkMode,
  onToggleDarkMode,
  trashCount,
  onOpenTrash,
  onUndo,
  canUndo,
  isAIEnabled,
  onToggleAI,
  currentCanvasName,
  onOpenCanvasSelector,
  lastSaved,
}: HeaderProps) {
  const formatLastSaved = () => {
    const now = new Date()
    const diff = now.getTime() - lastSaved.getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 10) return "방금 저장됨"
    if (seconds < 60) return `${seconds}초 전`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    return `${hours}시간 전`
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-sm transition-colors duration-700 ${isDarkMode ? "bg-zinc-900/95" : "bg-[#fafaf9]/95"}`}
    >
      <div className={`border-b transition-colors duration-700 ${isDarkMode ? "border-zinc-800" : "border-border/20"}`}>
        <div className="max-w-[2000px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={isDarkMode ? "/images/lo-logo-dark.png" : "/images/lo-logo.png"}
              alt="LAYOUT"
              width={200}
              height={50}
              className="h-10 w-auto"
              priority
            />
            <button
              onClick={onOpenCanvasSelector}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                isDarkMode
                  ? "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              {currentCanvasName}
            </button>
            <span className={`text-xs ${isDarkMode ? "text-zinc-500" : "text-gray-400"}`}>{formatLastSaved()}</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleAI}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all font-medium border
                ${
                  isAIEnabled
                    ? isDarkMode
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-[0_8px_30px_rgb(59,130,246,0.4)]"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                    : isDarkMode
                      ? "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                      : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
                }
              `}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>

            <Button
              variant="outline"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className={`${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"} ${!canUndo ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Undo2 className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={onOpenTrash}
              className={`relative ${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"}`}
            >
              <Trash2 className="w-4 h-4" />
              {trashCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${isDarkMode ? "bg-zinc-100 text-zinc-900" : "bg-foreground text-background"}`}
                >
                  {trashCount}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onToggleDarkMode}
              className={isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button onClick={onCreateBlock} className="text-sm">
              새 블럭 만들기
            </Button>

            <Button onClick={onReflect} className="text-sm bg-foreground text-background hover:bg-foreground/90">
              정리하기
            </Button>
          </div>
        </div>
      </div>

      <div
        className={`border-t border-b transition-colors duration-700 ${isDarkMode ? "border-zinc-600 border-b border-b-zinc-900" : "border-zinc-300 border-b border-b-stone-50"}`}
      >
        <div className="max-w-[2000px] mx-auto px-8 py-3 flex items-center gap-2">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => onZoneSelect(selectedZone === zone.id ? null : zone.id)}
              className={`
                px-4 py-1.5 rounded-full text-sm transition-all duration-300 font-light
                ${
                  selectedZone === zone.id
                    ? isDarkMode
                      ? "bg-zinc-100 text-zinc-900 font-normal shadow-sm"
                      : "bg-foreground text-background font-normal shadow-sm"
                    : isDarkMode
                      ? "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }
              `}
            >
              {zone.label}
            </button>
          ))}

          <button
            onClick={onManageAreas}
            className={`ml-1 px-2 py-1.5 text-xs rounded-full transition-colors ${isDarkMode ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/40"}`}
          >
            + 영역 추가
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onToggleRelationships}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all
                ${
                  showRelationships
                    ? isDarkMode
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-foreground/10 text-foreground"
                    : isDarkMode
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-muted-foreground/60 hover:bg-accent/40"
                }
              `}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>연결 보기</span>
            </button>

            <button
              onClick={onToggleCompletedBlocks}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all
                ${
                  showCompletedBlocks
                    ? isDarkMode
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-foreground/10 text-foreground"
                    : isDarkMode
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-muted-foreground/60 hover:bg-accent/40"
                }
              `}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>완료 보기</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
