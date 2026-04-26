"use client"

import { Package } from "lucide-react"
import { useT } from "@/lib/i18n/context"

interface ArchiveDockProps {
  archivedCount: number
  isDragOver: boolean
  isDarkMode: boolean
  onClick: () => void
}

/**
 * 우하단 고정 박스 아이콘.
 * - 블럭을 드래그해 hover 하면 `isDragOver` 가 true 로 들어와 하이라이트.
 * - 클릭하면 갈무리함 다이얼로그 오픈.
 */
export function ArchiveDock({ archivedCount, isDragOver, isDarkMode, onClick }: ArchiveDockProps) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      data-archive-dock
      aria-label={t("archive.dock.label")}
      title={t("archive.dock.label")}
      className={`
        fixed z-40 right-6 bottom-6
        h-14 w-14 rounded-2xl
        flex items-center justify-center
        transition-all duration-200
        ${
          isDragOver
            ? "scale-110 bg-foreground text-background shadow-[0_10px_32px_rgba(0,0,0,0.25)]"
            : isDarkMode
              ? "bg-[#1c2032] text-zinc-200 border border-zinc-700 hover:bg-[#242a3e] hover:border-zinc-600 shadow-lg"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-md"
        }
      `}
    >
      <Package className="w-6 h-6" />
      {archivedCount > 0 && (
        <span
          className={`
            absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full
            text-[11px] font-semibold flex items-center justify-center
            ${isDarkMode ? "bg-zinc-100 text-zinc-900" : "bg-foreground text-background"}
            shadow-sm
          `}
        >
          {archivedCount}
        </span>
      )}
    </button>
  )
}
