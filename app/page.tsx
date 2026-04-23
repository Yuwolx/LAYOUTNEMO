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
    title: "사용 설명서 (먼저 읽어주세요)",
    description: `이 블럭을 클릭해서 자세히 보세요.

블럭을 만들고, 결로 맥락을 나누고, 공간으로 연결을 표현합니다.`,
    x: 120,
    y: 120,
    width: 420,
    height: 200,
    zone: "daily",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `1) 블럭 만들기
오른쪽 위 '새 블럭 만들기'에서 업무를 추가합니다. AI가 켜져 있으면 입력한 내용을 분석해서 제목과 요약을 정리하고, 적합한 결을 추천합니다. AI가 꺼져 있으면 직접 입력해야 합니다.

블럭 생성 시 긴급도(urgent, thinking, lingering, stable)와 마감일 정보를 작성하면, AI가 이를 분석하여 자동으로 블럭의 옵션을 선택합니다. 예: "내일까지 완료해야 할 긴급한 업무"라고 작성하면 긴급도를 'urgent'로, 마감일을 내일로 설정합니다.

2) 결
결은 블럭이 가진 속성 태그입니다. "기획의 결", "개발의 결" 처럼 업무의 맥락을 나누는 기준이에요.

상단바 아래 결 버튼을 누르면 그 결에 속한 블럭만 또렷하게 강조됩니다. 나머지 블럭은 사라지지 않고 흐리게만 표시되어, 전체 맥락은 그대로 둔 채 지금 집중하고 싶은 결만 도드라지게 볼 수 있어요. 칸에 넣어 분류하는 게 아니라, 같은 블럭들을 다른 시선으로 다시 보는 개념입니다.

3) 연결(연관 관계)
블럭을 서로 가까이 두거나 살짝 겹치면 자동으로 연결됩니다. 연결선은 부드러운 곡선으로 나타나며, 연결을 끊으려면 선을 클릭하세요.

4) AI 보조
헤더의 'AI 보조' 버튼을 클릭해서 AI를 켜거나 끌 수 있습니다. AI가 꺼져 있으면 '정리하기' 기능은 사용할 수 없습니다.

5) 정리하기(체크포인트)
정리하기는 자동 정리가 아니라 상태 점검용 체크포인트입니다. AI는 한 번에 하나씩 제안을 보여주고, 수락한 변경만 적용됩니다.

6) 캔버스 전환
로고 옆의 캔버스 이름 버튼을 클릭하면 여러 작업 공간을 만들고 전환할 수 있습니다. 각 캔버스는 독립적인 블럭과 결을 가집니다. (단축키: Cmd/Ctrl + K)

7) 시급도 표시
블럭의 그림자 색상으로 머릿속에서 차지하는 무게를 표현합니다. (블럭 크기는 모두 동일)
• 안정 (회색): 천천히 진행해도 되는 일
• 생각 중 (파란색): 아직 구체화되지 않은 아이디어
• 머물러 있음 (노란색): 미루고 있지만 언젠가 해야 할 일
• 시급 (주황색): 즉시 처리가 필요한 일

8) 완료 표시
블럭 상세 정보에서 '완료' 체크박스를 클릭하면 블럭을 완료 상태로 표시할 수 있습니다. 또한 블럭을 우측으로 드래그해 화면 오른쪽 하단의 '완료된 업무' 영역으로 이동시키면 자동으로 완료 처리됩니다. 완료된 블럭은 흐리게 표시됩니다.

9) 휴지통
삭제한 블럭은 최대 10개까지 휴지통에 보관됩니다. 헤더의 휴지통 아이콘을 클릭해 삭제된 블럭을 확인하고 복구할 수 있습니다.

10) 마감일 설정
블럭 상세 정보에서 마감일을 추가할 수 있습니다. 마감일이 설정된 블럭은 우측 상단에 날짜가 표시됩니다.

11) 결 커스터마이징
'결 관리' 버튼을 클릭해 새로운 결을 추가하거나 기존 결을 수정, 삭제할 수 있습니다. 각 결은 고유의 색상을 가집니다.`,
  },
  {
    id: "shortcuts-guide",
    title: "단축키 안내",
    description: "자주 사용하는 단축키를 확인하세요",
    x: 120,
    y: 360,
    width: 380,
    height: 200,
    zone: "daily",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `단축키 목록:

• Cmd/Ctrl + N: 새 블럭 만들기
• Cmd/Ctrl + Z: 되돌리기
• Cmd/Ctrl + Shift + Z: 재실행
• Cmd/Ctrl + Y: 재실행 (대체)
• Cmd/Ctrl + K: 캔버스 선택
• Alt/Option + 클릭: 블럭 복사
• Esc: 다이얼로그 닫기

되돌리기 & 재실행:
헤더의 화살표 아이콘(↶↷)으로도 조작할 수 있습니다. 좌측 화살표는 되돌리기, 우측 화살표는 재실행입니다.

블럭 복사:
Alt 또는 Option 키를 누른 상태에서 블럭을 클릭하면 해당 블럭이 복사됩니다. 복사된 블럭은 원본 옆에 생성되며, 모든 정보(긴급도, 마감일, 메모 등)가 함께 복사됩니다.`,
  },
  {
    id: "example-1",
    title: "사용자 인터뷰 진행",
    description: "5명의 잠재 고객과 인터뷰를 진행하고 니즈 파악 및 피드백 수집",
    x: 650,
    y: 120,
    width: 360,
    height: 160,
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
    width: 360,
    height: 160,
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
    width: 360,
    height: 160,
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
    width: 360,
    height: 160,
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
    width: 360,
    height: 160,
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
  blocks: canvas.blocks.map((b) => ({
    ...b,
    zone: LEGACY_ZONE_ID_MAP[b.zone] ?? b.zone,
  })),
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

  const activeBlocks = blocks.filter((b) => !b.isDeleted)

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

    if (updates.isCompleted === true && !block.isCompleted) {
      const completedBlocks = blocks.filter((b) => b.isCompleted)

      const COMPLETION_ZONE_WIDTH = 400
      const COMPLETION_ZONE_HEIGHT = 600
      const COMPLETED_BLOCK_WIDTH = 340
      const COMPLETED_BLOCK_HEIGHT = 56
      const COMPLETED_BLOCK_SPACING = 8
      const COMPLETION_PADDING = 60

      const canvasWidth = typeof window !== "undefined" ? window.innerWidth : 1920
      const canvasHeight = typeof window !== "undefined" ? window.innerHeight - 140 : 1080 - 140

      const stackY =
        canvasHeight -
        COMPLETION_ZONE_HEIGHT +
        COMPLETION_PADDING +
        completedBlocks.length * (COMPLETED_BLOCK_HEIGHT + COMPLETED_BLOCK_SPACING)

      updates = {
        ...updates,
        originalState: {
          width: block.width,
          height: block.height,
          urgency: block.urgency || "stable",
        },
        x: canvasWidth - COMPLETION_ZONE_WIDTH + COMPLETION_PADDING,
        y: stackY,
        width: COMPLETED_BLOCK_WIDTH,
        height: COMPLETED_BLOCK_HEIGHT,
        relatedTo: [],
      }
    }

    if (updates.isCompleted === false && block.isCompleted) {
      const COMPLETION_ZONE_WIDTH = 400
      const COMPLETION_ZONE_HEIGHT = 600
      const COMPLETED_BLOCK_WIDTH = 340
      const COMPLETED_BLOCK_HEIGHT = 56
      const COMPLETED_BLOCK_SPACING = 8
      const COMPLETION_PADDING = 60

      const canvasWidth = typeof window !== "undefined" ? window.innerWidth : 1920
      const canvasHeight = typeof window !== "undefined" ? window.innerHeight - 140 : 1080 - 140

      const otherCompletedBlocks = blocks.filter((b) => b.isCompleted && b.id !== id).sort((a, b) => a.y - b.y)

      const batchUpdates = otherCompletedBlocks.map((completedBlock, index) => ({
        id: completedBlock.id,
        updates: {
          y:
            canvasHeight -
            COMPLETION_ZONE_HEIGHT +
            COMPLETION_PADDING +
            index * (COMPLETED_BLOCK_HEIGHT + COMPLETED_BLOCK_SPACING),
        },
      }))

      if (batchUpdates.length > 0) {
        const newBlocks = blocks.map((b) => {
          if (b.id === id) {
            return { ...b, ...updates }
          }
          const batchUpdate = batchUpdates.find((u) => u.id === b.id)
          return batchUpdate ? { ...b, ...batchUpdate.updates } : b
        })
        if (skipHistory) {
          setBlocks(newBlocks)
        } else {
          saveToHistory(newBlocks)
        }
        return
      }
    }

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
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = e.metaKey || e.ctrlKey

      // modifier 키만 눌린 경우 무시
      if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") {
        return
      }

      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      if (modifier && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        handleRedo()
        return
      }

      if (modifier && e.key === "y") {
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
    <div className={`min-h-screen ${isDarkMode ? "dark bg-zinc-900 text-zinc-100" : "bg-[#fafaf9] text-foreground"}`}>
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
        blocks={activeBlocks}
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
    </div>
  )
}
