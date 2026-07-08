"use client"

import { Package } from "lucide-react"
import { useT } from "@/lib/i18n/context"

interface ArchiveDockProps {
  archivedCount: number
  isDarkMode: boolean
  onClick: () => void
}

/**
 * 우하단 고정 박스 아이콘.
 * - 클릭하면 갈무리함 다이얼로그 오픈.
 */
export function ArchiveDock({ archivedCount, isDarkMode, onClick }: ArchiveDockProps) {
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
          isDarkMode
            ? "bg-[#282c34] text-[#dfe3ea] border border-[#3b414d] hover:bg-[#333944] hover:border-[#4a5160] shadow-lg"
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
            ${isDarkMode ? "bg-[#dfe3ea] text-[#21252b]" : "bg-foreground text-background"}
            shadow-sm
          `}
        >
          {archivedCount}
        </span>
      )}
    </button>
  )
}
