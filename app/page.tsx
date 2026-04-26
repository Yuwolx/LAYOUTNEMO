"use client"

import { useState, useEffect, useCallback } from "react"
import { Canvas } from "@/components/canvas"
import { Header } from "@/components/header"
import { CreateBlockDialog } from "@/components/create-block-dialog"
import { ReflectionDialog } from "@/components/reflection-dialog"
import { AreaManagementDialog } from "@/components/area-management-dialog"
import { TrashDialog } from "@/components/trash-dialog"
import { CanvasSelectorDialog } from "@/components/canvas-selector-dialog"
import { AboutDialog } from "@/components/about-dialog"
import { ArchiveDock } from "@/components/archive-dock"
import { ArchiveDialog } from "@/components/archive-dialog"
import type { WorkBlock, Zone, Canvas as CanvasType } from "@/types"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedCanvasName } from "@/lib/i18n/seed"

// 기본 결(Facet) 5종. 설계 문서 (ARCHITECTURE.md) 와 정합.
// 참고: v1 은 이 배열을 첫 진입 시 seed 로 사용하고, 이후엔 사용자 편집 가능.
const initialZones: Zone[] = [
  { id: "planning",  label: "기획",     color: "rgba(147, 197, 253, 0.1)" }, // 인디고 톤
  { id: "development", label: "개발",   color: "rgba(167, 243, 208, 0.1)" }, // 에메랄드 톤
  { id: "design",    label: "디자인",   color: "rgba(251, 207, 232, 0.1)" }, // 핑크 톤
  { id: "marketing", label: "마케팅",   color: "rgba(254, 215, 170, 0.1)" }, // 앰버 톤
  { id: "daily",     label: "일상",     color: "rgba(221, 214, 254, 0.1)" }, // 슬레이트 톤
]

const initialBlocks: WorkBlock[] = [
  {
    id: "guide",
    title: "사용 설명서",
    description: "블럭을 만들고, 결로 맥락을 나누고, 가까이 두면 자동으로 이어집니다. 클릭하면 전체 사용법을 볼 수 있어요.",
    x: 120,
    y: 120,
    width: 280,
    height: 140,
    zone: "daily",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `LAYOUTNEMO 는 할 일을 리스트나 보드에 넣지 않고, 캔버스 위에 펼쳐놓는 도구입니다.

1) 블럭 만들기
오른쪽 위 '새 블럭 만들기' 또는 Cmd/Ctrl + N. AI 보조가 켜져 있으면 한 줄만 적어도 제목·요약·결·시급도를 자동으로 정리해줍니다. 꺼져 있으면 직접 입력하세요. 내용은 비워둬도 됩니다.

2) 결(Facet)
블럭이 가진 맥락 태그입니다. "기획", "개발" 같은 식으로 업무의 결을 나눠요. 상단의 결 버튼을 누르면 그 결의 블럭만 또렷해지고 나머지는 흐려집니다. 칸막이가 아니라 시선의 필터에 가깝습니다.

3) 연결
블럭을 서로 가까이 두면 자동으로 곡선이 이어집니다. 연결을 끊으려면 선을 클릭하세요.

4) 시급도
블럭의 그림자 색으로 머릿속 무게를 표현합니다. 크기는 바뀌지 않습니다.
• 안정 (회색): 천천히 진행
• 생각 중 (파랑): 아직 구체화되지 않음
• 머물러 있음 (노랑): 미루고 있는 일
• 시급 (주황): 즉시 처리 필요

5) 캔버스 이동
스페이스바를 누른 채 마우스로 드래그하면 캔버스 전체가 따라옵니다 (피그마 방식).

6) 갈무리
지금 안 보고 싶은 블럭은 우하단 박스 아이콘으로 드래그해 치워두세요. 다시 꺼내면 원래 자리로 돌아옵니다.

7) AI 보조 / 정리하기
헤더의 'AI 보조' 토글로 켜고 끕니다. AI 가 켜져 있을 때 '정리하기' 버튼으로 캔버스 상태에 대한 제안을 받을 수 있습니다. 한 번에 하나씩 보여주고, 수락한 변경만 적용됩니다.

8) 캔버스 전환
로고 옆 캔버스 이름을 누르거나 Cmd/Ctrl + K 로 여러 작업 공간을 오갈 수 있습니다. 각 캔버스는 독립적인 블럭과 결을 가집니다.

9) 결 커스터마이징
'결 관리' 버튼에서 결을 추가/수정/삭제할 수 있습니다. 각 결은 고유의 색을 가져요.

10) 휴지통
삭제한 블럭은 최대 10개까지 휴지통에 보관됩니다. 헤더의 휴지통 아이콘에서 복구할 수 있어요.

11) 마감일
블럭 상세에서 마감일을 추가하면 카드 우측 상단에 표시됩니다.`,
  },
  {
    id: "shortcuts-guide",
    title: "단축키",
    description: "캔버스 이동은 스페이스바 + 드래그, 새 블럭은 Cmd/Ctrl + N. 클릭하면 전체 단축키 목록을 볼 수 있어요.",
    x: 120,
    y: 320,
    width: 280,
    height: 140,
    zone: "daily",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `[캔버스 조작]
• 스페이스바 + 드래그: 캔버스 이동 (피그마 방식)
• Alt/Option + 블럭 클릭: 블럭 복사
• Shift + 블럭 드롭: 연결만 만들고 원위치로 (연결 토스)

[작업]
• Cmd/Ctrl + N: 새 블럭 만들기
• Cmd/Ctrl + Z: 되돌리기
• Cmd/Ctrl + Shift + Z: 다시 실행
• Cmd/Ctrl + Y: 다시 실행 (대체)
• Cmd/Ctrl + K: 캔버스 선택

[다이얼로그]
• Esc: 열려 있는 다이얼로그 닫기
• Enter: 다음 단계 / 확정

[마우스]
• 블럭 드래그: 위치 이동
• 블럭 → 우하단 박스: 갈무리
• 두 블럭을 가까이: 자동 연결
• 연결선 클릭: 연결 끊기

[참고]
헤더의 화살표 ↶↷ 로도 되돌리기/다시 실행이 가능합니다.
텍스트 입력 중에는 Cmd/Ctrl + Z 가 캔버스 되돌리기 대신 일반 텍스트 되돌리기로 동작합니다.`,
  },
  {
    id: "example-1",
    title: "사용자 인터뷰 진행",
    description: "5명의 잠재 고객과 인터뷰를 진행하고 니즈 파악 및 피드백 수집",
    x: 650,
    y: 120,
    width: 200,
    height: 96,
    zone: "planning",
    urgency: "urgent",
    dueDate: "2025-01-05",
  },
  {
    id: "example-2",
    title: "프로토타입 개발",
    description: "핵심 기능에 대한 MVP 프로토타입 제작 및 테스트 준비",
    x: 1050,
    y: 120,
    width: 200,
    height: 96,
    zone: "development",
    urgency: "stable",
    relatedTo: ["example-1"],
  },
  {
    id: "example-3",
    title: "마케팅 채널 분석",
    description: "효과적인 마케팅 채널 조사 및 예산 배분 우선순위 선정",
    x: 650,
    y: 320,
    width: 200,
    height: 96,
    zone: "marketing",
    urgency: "thinking",
    dueDate: "2025-01-15",
  },
  {
    id: "example-4",
    title: "디자인 시스템 구축",
    description: "일관된 UI/UX를 위한 컴포넌트 라이브러리와 디자인 가이드라인 작성",
    x: 1050,
    y: 320,
    width: 200,
    height: 96,
    zone: "design",
    urgency: "stable",
    relatedTo: ["example-2"],
  },
  {
    id: "example-5",
    title: "경쟁사 분석 보고서",
    description: "주요 경쟁사 3곳의 전략, 가격, 포지셔닝 비교 분석",
    x: 1450,
    y: 120,
    width: 200,
    height: 96,
    zone: "planning",
    urgency: "lingering",
    dueDate: "2025-01-20",
  },
]

const STORAGE_KEY = "layout_canvases"
const CURRENT_CANVAS_KEY = "layout_current_canvas"

const getDefaultCanvas = (): CanvasType => ({
  id: "main",
  name: "메인 캔버스",
  blocks: initialBlocks,
  zones: initialZones,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

// v1 → v1.1 결(Zone) 네이밍 변경에 대한 마이그레이션.
// 이전 id: "personal" / "operations" → 새 id: "daily" / "marketing"
const LEGACY_ZONE_ID_MAP: Record<string, string> = {
  personal: "daily",
  operations: "marketing",
}

const migrateCanvas = (canvas: CanvasType): CanvasType => ({
  ...canvas,
  zones: canvas.zones.map((z) => ({
    ...z,
    id: LEGACY_ZONE_ID_MAP[z.id] ?? z.id,
  })),
  blocks: canvas.blocks.map((b) => {
    const migrated: WorkBlock = { ...b, zone: LEGACY_ZONE_ID_MAP[b.zone] ?? b.zone }
    // 구버전에서 갈무리 처리된 블럭은 x/y 가 우하단 스택 좌표로, 크기는 340x56 으로
    // 변경되어 있다. originalState 에서 원래 크기/시급도를 복원하고,
    // x/y 는 과거 값 그대로 두되 width/height 만 원본으로 되돌린다.
    if (migrated.isCompleted && migrated.originalState) {
      migrated.width = migrated.originalState.width
      migrated.height = migrated.originalState.height
      if (migrated.originalState.urgency) {
        migrated.urgency = migrated.originalState.urgency as WorkBlock["urgency"]
      }
      migrated.originalState = undefined
    }
    return migrated
  }),
})

const loadCanvases = (): CanvasType[] => {
  if (typeof window === "undefined") return [getDefaultCanvas()]

  try {
    const storedCanvases = localStorage.getItem(STORAGE_KEY)
    if (storedCanvases) {
      const parsed = JSON.parse(storedCanvases) as CanvasType[]
      return parsed.map(migrateCanvas)
    }
  } catch (error) {
    console.error("Failed to load canvases:", error)
  }

  return [getDefaultCanvas()]
}

const loadCurrentCanvasId = (): string => {
  if (typeof window === "undefined") return "main"

  try {
    const storedCurrentCanvasId = localStorage.getItem(CURRENT_CANVAS_KEY)
    return storedCurrentCanvasId || "main"
  } catch (error) {
    console.error("Failed to load current canvas ID:", error)
    return "main"
  }
}

export default function Page() {
  const { language } = useLanguage()
  const t = useT()
  const [canvases, setCanvases] = useState<CanvasType[]>([getDefaultCanvas()])
  const [currentCanvasId, setCurrentCanvasId] = useState<string>("main")
  const [lastSaved, setLastSaved] = useState<Date>(new Date())
  const [isClient, setIsClient] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showRelationships, setShowRelationships] = useState(true)
  const [showCompletedBlocks, setShowCompletedBlocks] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false)
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false)
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false)
  const [isCanvasSelectorOpen, setIsCanvasSelectorOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isAIEnabled, setIsAIEnabled] = useState(true)
  const [previewBlock, setPreviewBlock] = useState<Partial<WorkBlock> | null>(null)

  // 현재 캔버스의 blocks 스냅샷만 기록 (v1.1 최적화).
  // 과거: CanvasType[][] 로 모든 캔버스 전체를 스냅샷 → 메모리 부담.
  // 현재: { canvasId, blocks } 만 저장하고 undo 시 해당 캔버스 blocks 만 교체.
  type HistorySnapshot = { canvasId: string; blocks: WorkBlock[] }
  const [history, setHistory] = useState<HistorySnapshot[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const currentCanvas = canvases.find((c) => c.id === currentCanvasId) || canvases[0]
  const blocks = currentCanvas?.blocks || []
  const zones = currentCanvas?.zones || initialZones

  const applySnapshot = useCallback((snap: HistorySnapshot) => {
    setCanvases((prev) =>
      prev.map((c) => (c.id === snap.canvasId ? { ...c, blocks: snap.blocks, updatedAt: Date.now() } : c)),
    )
  }, [])

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      applySnapshot(history[newIndex])
    }
  }, [historyIndex, history, applySnapshot])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      applySnapshot(history[newIndex])
    }
  }, [historyIndex, history, applySnapshot])

  useEffect(() => {
    setIsClient(true)
    const loadedCanvases = loadCanvases()
    const loadedCanvasId = loadCurrentCanvasId()

    if (loadedCanvases.length > 0) {
      setCanvases(loadedCanvases)
      const activeId = loadedCanvasId && loadedCanvases.some((c) => c.id === loadedCanvasId) ? loadedCanvasId : loadedCanvases[0].id
      const activeCanvas = loadedCanvases.find((c) => c.id === activeId) ?? loadedCanvases[0]
      setHistory([{ canvasId: activeCanvas.id, blocks: activeCanvas.blocks }])
      setHistoryIndex(0)
    }

    if (loadedCanvasId && loadedCanvases.some((c) => c.id === loadedCanvasId)) {
      setCurrentCanvasId(loadedCanvasId)
    }
  }, [])

  // 캔버스 전환 시 해당 캔버스의 현재 blocks 로 히스토리를 리셋한다.
  // (과거엔 전체 캔버스 스냅샷을 공유했으나, 현재는 캔버스 단위로 독립 유지)
  useEffect(() => {
    if (!isClient) return
    const active = canvases.find((c) => c.id === currentCanvasId)
    if (!active) return
    setHistory([{ canvasId: active.id, blocks: active.blocks }])
    setHistoryIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCanvasId, isClient])

  useEffect(() => {
    if (!isClient) return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(canvases))
      localStorage.setItem(CURRENT_CANVAS_KEY, currentCanvasId)
      setLastSaved(new Date())
    } catch (error) {
      console.error("Failed to save to localStorage:", error)
    }
  }, [canvases, currentCanvasId, isClient])

  const deletedBlocks = blocks
    .filter((b) => !b.isAIControl && b.isDeleted)
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
    .slice(0, 10)

  // 갈무리(archive)된 블럭은 캔버스에 렌더링하지 않고 독/모달에서만 노출.
  const archivedBlocks = blocks.filter((b) => !b.isDeleted && b.isCompleted && !b.isGuide)
  const activeBlocks = blocks.filter((b) => !b.isDeleted)
  const canvasBlocks = activeBlocks.filter((b) => !b.isCompleted)

  const saveToHistory = (newBlocks: WorkBlock[]) => {
    // 캔버스는 즉시 업데이트
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, blocks: newBlocks, updatedAt: Date.now() } : canvas,
      ),
    )

    // redo 분기 제거 + 새 스냅샷 추가 + 50개 제한
    const truncated = history.slice(0, historyIndex + 1)
    truncated.push({ canvasId: currentCanvasId, blocks: newBlocks })
    const limited = truncated.length > 50 ? truncated.slice(truncated.length - 50) : truncated
    setHistory(limited)
    setHistoryIndex(limited.length - 1)
  }

  const setBlocks = (newBlocks: WorkBlock[]) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, blocks: newBlocks, updatedAt: Date.now() } : canvas,
      ),
    )
  }

  const handleUpdateBlock = (id: string, updates: Partial<WorkBlock>, skipHistory = false) => {
    const block = blocks.find((b) => b.id === id)
    if (!block) return

    if (block?.isAIControl && updates.aiEnabled !== undefined) {
      setIsAIEnabled(updates.aiEnabled)
    }

    // 갈무리 UX 전환:
    // 이전에는 isCompleted=true 시 블럭을 우하단 스택 좌표로 이동 + 크기 축소 + 관계선 초기화했음.
    // 지금은 갈무리 블럭이 캔버스에서 제외되고 ArchiveDialog 에서만 노출되므로,
    // 위치/크기/관계선을 그대로 유지해서 꺼냈을 때 원래 자리로 즉시 복귀되도록 한다.
    const newBlocks = blocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
    if (skipHistory) {
      setBlocks(newBlocks)
    } else {
      saveToHistory(newBlocks)
    }
  }

  const handleBatchUpdateBlocks = (updates: Array<{ id: string; updates: Partial<WorkBlock> }>) => {
    const newBlocks = blocks.map((block) => {
      const update = updates.find((u) => u.id === block.id)
      return update ? { ...block, ...update.updates } : block
    })
    saveToHistory(newBlocks)
  }

  const handleCreateBlock = (block: WorkBlock) => {
    const newBlocks = [...blocks, block]
    saveToHistory(newBlocks)
    setIsCreateDialogOpen(false)
  }

  const handleArchiveBlock = (id: string) => {
    const newBlocks = blocks.map((block) =>
      block.id === id ? { ...block, isDeleted: true, deletedAt: Date.now() } : block,
    )
    saveToHistory(newBlocks)
  }

  const handleRestoreBlock = (id: string) => {
    const newBlocks = blocks.map((block) =>
      block.id === id ? { ...block, isDeleted: false, deletedAt: undefined } : block,
    )
    saveToHistory(newBlocks)
  }

  const handlePermanentDelete = (id: string) => {
    const newBlocks = blocks.filter((block) => block.id !== id)
    saveToHistory(newBlocks)
  }

  // 갈무리함에서 캔버스로 꺼내기 (isCompleted=false).
  const handleUnarchiveBlock = (id: string) => {
    const newBlocks = blocks.map((b) => (b.id === id ? { ...b, isCompleted: false } : b))
    saveToHistory(newBlocks)
  }

  const handleToggleAI = () => {
    setIsAIEnabled(!isAIEnabled)
  }

  const handleSelectCanvas = (id: string) => {
    setCurrentCanvasId(id)
  }

  const handleRenameCanvas = (id: string, newName: string) => {
    setCanvases((prev) =>
      prev.map((canvas) => (canvas.id === id ? { ...canvas, name: newName, updatedAt: Date.now() } : canvas)),
    )
  }

  const handleDeleteCanvas = (id: string) => {
    if (canvases.length === 1) return
    setCanvases((prev) => prev.filter((c) => c.id !== id))
    if (currentCanvasId === id) {
      const remainingCanvas = canvases.find((c) => c.id !== id)
      if (remainingCanvas) {
        setCurrentCanvasId(remainingCanvas.id)
      }
    }
  }

  const handleCreateCanvas = (name: string) => {
    const newCanvas: CanvasType = {
      id: `canvas-${Date.now()}`,
      name,
      blocks: [blocks[0], blocks[1]],
      zones: initialZones,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setCanvases((prev) => [...prev, newCanvas])
    setCurrentCanvasId(newCanvas.id)
  }

  const handleUpdateZones = (newZones: Zone[]) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, zones: newZones, updatedAt: Date.now() } : canvas,
      ),
    )
  }

  const handleCopyBlock = (sourceBlockId: string) => {
    const sourceBlock = blocks.find((b) => b.id === sourceBlockId)
    if (!sourceBlock || sourceBlock.isGuide) return

    const newBlock: WorkBlock = {
      ...sourceBlock,
      id: `block-${Date.now()}`,
      x: sourceBlock.x + 30,
      y: sourceBlock.y + 30,
      relatedTo: [],
    }

    const newBlocks = [...blocks, newBlock]
    saveToHistory(newBlocks)
  }

  const handleReset = () => {
    // reset 은 의도적으로 가이드/예시까지 포함한 "완전 초기화" 의미.
    // 평상시 가이드 블럭을 삭제하고 싶으면 헤더의 휴지통에서 영구삭제하면 된다.
    if (confirm(t("confirm.reset"))) {
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CURRENT_CANVAS_KEY)
        window.location.reload()
      } catch (error) {
        console.error("Failed to reset:", error)
      }
    }
  }

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = e.metaKey || e.ctrlKey
      const editable = isEditable(e.target)

      // modifier 키만 눌린 경우 무시
      if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") {
        return
      }

      // Undo/Redo 는 텍스트 편집 중에는 브라우저 기본동작(텍스트 undo)에 양보.
      if (modifier && e.key === "z" && !e.shiftKey) {
        if (editable) return
        e.preventDefault()
        handleUndo()
        return
      }

      if (modifier && e.key === "z" && e.shiftKey) {
        if (editable) return
        e.preventDefault()
        handleRedo()
        return
      }

      if (modifier && e.key === "y") {
        if (editable) return
        e.preventDefault()
        handleRedo()
        return
      }

      if (modifier && e.key === "n") {
        e.preventDefault()
        setIsCreateDialogOpen(true)
        return
      }

      if (modifier && e.key === "k") {
        e.preventDefault()
        setIsCanvasSelectorOpen(true)
        return
      }

      if (e.key === "Escape") {
        setIsCreateDialogOpen(false)
        setIsReflectionDialogOpen(false)
        setIsAreaManagementOpen(false)
        setIsTrashDialogOpen(false)
        setIsCanvasSelectorOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleUndo, handleRedo])

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-[#151823] text-zinc-100" : "bg-[#fafaf9] text-foreground"}`}>
      <Header
        onCreateBlock={() => setIsCreateDialogOpen(true)}
        onReflect={() => setIsReflectionDialogOpen(true)}
        zones={zones}
        selectedZone={selectedZone}
        onZoneSelect={setSelectedZone}
        onManageAreas={() => setIsAreaManagementOpen(true)}
        showRelationships={showRelationships}
        onToggleRelationships={() => setShowRelationships(!showRelationships)}
        showCompletedBlocks={showCompletedBlocks}
        onToggleCompletedBlocks={() => setShowCompletedBlocks(!showCompletedBlocks)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        trashCount={deletedBlocks.length}
        onOpenTrash={() => setIsTrashDialogOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        isAIEnabled={isAIEnabled}
        onToggleAI={handleToggleAI}
        currentCanvasName={currentCanvas ? translateSeedCanvasName(currentCanvas, language) : (language === "en" ? "Main Canvas" : "메인 캔버스")}
        onOpenCanvasSelector={() => setIsCanvasSelectorOpen(true)}
        lastSaved={lastSaved}
        onReset={handleReset}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      <Canvas
        blocks={canvasBlocks}
        zones={zones}
        selectedZone={selectedZone}
        showRelationships={showRelationships}
        showCompletedBlocks={showCompletedBlocks}
        onUpdateBlock={handleUpdateBlock}
        onBatchUpdateBlocks={handleBatchUpdateBlocks}
        onCopyBlock={handleCopyBlock}
        onArchiveBlock={handleArchiveBlock}
        isDarkMode={isDarkMode}
        previewBlock={previewBlock} // 미리보기 블록 전달
      />

      <CreateBlockDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateBlock={handleCreateBlock}
        zones={zones}
        isAIEnabled={isAIEnabled}
        existingBlocks={activeBlocks}
        onShowPreview={setPreviewBlock} // 미리보기 핸들러 전달
      />

      <ReflectionDialog
        open={isReflectionDialogOpen}
        onOpenChange={setIsReflectionDialogOpen}
        blocks={activeBlocks}
        onUpdateBlocks={(updatedBlocks) => {
          setBlocks([...updatedBlocks, ...deletedBlocks])
        }}
        isAIEnabled={isAIEnabled}
        zones={zones}
      />

      <AreaManagementDialog
        open={isAreaManagementOpen}
        onOpenChange={setIsAreaManagementOpen}
        zones={zones}
        onUpdateZones={handleUpdateZones}
      />

      <TrashDialog
        open={isTrashDialogOpen}
        onOpenChange={setIsTrashDialogOpen}
        deletedBlocks={deletedBlocks}
        onRestore={handleRestoreBlock}
        onPermanentDelete={handlePermanentDelete}
      />

      <CanvasSelectorDialog
        open={isCanvasSelectorOpen}
        onOpenChange={setIsCanvasSelectorOpen}
        canvases={canvases}
        currentCanvasId={currentCanvasId}
        onSelectCanvas={handleSelectCanvas}
        onRenameCanvas={handleRenameCanvas}
        onDeleteCanvas={handleDeleteCanvas}
        onCreateCanvas={handleCreateCanvas}
      />

      <AboutDialog open={isAboutOpen} onOpenChange={setIsAboutOpen} />

      <ArchiveDock
        archivedCount={archivedBlocks.length}
        isDragOver={false}
        isDarkMode={isDarkMode}
        onClick={() => setIsArchiveOpen(true)}
      />

      <ArchiveDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        archivedBlocks={archivedBlocks}
        zones={zones}
        onRestore={handleUnarchiveBlock}
        onDelete={handleArchiveBlock}
      />
    </div>
  )
}
