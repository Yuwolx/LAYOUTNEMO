"use client"

import { useState, useEffect } from "react"
import { Canvas } from "@/components/canvas"
import { Header } from "@/components/header"
import { CreateBlockDialog } from "@/components/create-block-dialog"
import { ReflectionDialog } from "@/components/reflection-dialog"
import { AreaManagementDialog } from "@/components/area-management-dialog"
import { TrashDialog } from "@/components/trash-dialog"
import { CanvasSelectorDialog } from "@/components/canvas-selector-dialog"
import type { WorkBlock, Zone, Canvas as CanvasType } from "@/types"

const initialZones: Zone[] = [
  { id: "planning", label: "기획", color: "rgba(147, 197, 253, 0.1)" },
  { id: "development", label: "개발", color: "rgba(167, 243, 208, 0.1)" },
  { id: "operations", label: "운영", color: "rgba(254, 215, 170, 0.1)" },
  { id: "personal", label: "개인 생각", color: "rgba(221, 214, 254, 0.1)" },
]

const initialBlocks: WorkBlock[] = [
  {
    id: "guide",
    title: "사용 설명서 (먼저 읽어주세요)",
    description: `이 블럭을 클릭해서 자세히 보세요.

블럭을 만들고, 영역으로 렌즈를 바꾸고, 공간으로 연결을 표현합니다.`,
    x: 120,
    y: 120,
    width: 420,
    height: 200,
    zone: "personal",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `1) 블럭 만들기
오른쪽 위 '새 블럭 만들기'에서 업무를 추가합니다. AI가 켜져 있으면 입력한 내용을 분석해서 제목과 요약을 정리하고, 적합한 영역을 추천합니다. AI가 꺼져 있으면 직접 입력해야 합니다.

2) 영역(렌즈)
상단바 아래 '영역'을 누르면 해당 영역의 블럭이 강조됩니다. 다른 영역의 블럭은 숨기지 않고 흐리게만 표시되어 맥락을 유지합니다. 영역은 필터가 아니라 렌즈입니다.

3) 연결(연관 관계)
블럭을 서로 가까이 두거나 살짝 겹치면 자동으로 연결됩니다. 연결선은 부드러운 곡선으로 나타나며, 연결을 끊으려면 선을 클릭하세요.

4) AI 보조
헤더의 'AI 보조' 버튼을 클릭해서 AI를 켜거나 끌 수 있습니다. AI가 꺼져 있으면 '정리하기' 기능은 사용할 수 없습니다.

5) 정리하기(체크포인트)
정리하기는 자동 정리가 아니라 상태 점검용 체크포인트입니다. AI는 한 번에 하나씩 제안을 보여주고, 수락한 변경만 적용됩니다.

6) 캔버스 전환
로고 옆의 캔버스 이름 버튼을 클릭하면 여러 작업 공간을 만들고 전환할 수 있습니다. 각 캔버스는 독립적인 블럭과 영역을 가집니다. (단축키: Cmd/Ctrl + K)`,
  },
  {
    id: "shortcuts-guide",
    title: "단축키 안내",
    description: "자주 사용하는 단축키를 확인하세요",
    x: 120,
    y: 360,
    width: 380,
    height: 200,
    zone: "personal",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `단축키 목록:

• Cmd/Ctrl + N: 새 블럭 만들기
• Cmd/Ctrl + Z: 되돌리기
• Cmd/Ctrl + K: 캔버스 선택
• Alt/Option + 클릭: 블럭 복사
• Esc: 다이얼로그 닫기

블럭 복사:
Alt 또는 Option 키를 누른 상태에서 블럭을 클릭하면 해당 블럭이 복사됩니다. 복사된 블럭은 원본 옆에 생성됩니다.`,
  },
  {
    id: "example-1",
    title: "사용자 인터뷰 진행",
    description: "5명의 잠재 고객과 인터뷰를 진행하고 니즈 파악 및 피드백 수집",
    x: 600,
    y: 120,
    width: 320,
    height: 160,
    zone: "planning",
    urgency: "urgent",
    dueDate: "2025-01-05",
  },
  {
    id: "example-2",
    title: "프로토타입 개발",
    description: "핵심 기능에 대한 MVP 프로토타입 제작 및 테스트 준비",
    x: 960,
    y: 120,
    width: 320,
    height: 160,
    zone: "development",
    urgency: "normal",
    relatedTo: ["example-1"],
  },
  {
    id: "example-3",
    title: "마케팅 채널 분석",
    description: "효과적인 마케팅 채널 조사 및 예산 배분 우선순위 선정",
    x: 600,
    y: 320,
    width: 320,
    height: 160,
    zone: "operations",
    urgency: "thinking",
    dueDate: "2025-01-15",
  },
  {
    id: "example-4",
    title: "디자인 시스템 구축",
    description: "일관된 UI/UX를 위한 컴포넌트 라이브러리와 디자인 가이드라인 작성",
    x: 960,
    y: 320,
    width: 320,
    height: 160,
    zone: "development",
    urgency: "stable",
    relatedTo: ["example-2"],
  },
  {
    id: "example-5",
    title: "경쟁사 분석 보고서",
    description: "주요 경쟁사 3곳의 전략, 가격, 포지셔닝 비교 분석",
    x: 1320,
    y: 120,
    width: 320,
    height: 160,
    zone: "planning",
    urgency: "lingering",
    dueDate: "2025-01-20",
  },
]

const STORAGE_KEY = "layout_canvases"
const CURRENT_CANVAS_KEY = "layout_current_canvas"

const loadCanvases = (): CanvasType[] => {
  if (typeof window === "undefined") return []

  const storedCanvases = localStorage.getItem(STORAGE_KEY)
  const storedCurrentCanvasId = localStorage.getItem(CURRENT_CANVAS_KEY)

  if (storedCanvases && storedCurrentCanvasId) {
    return JSON.parse(storedCanvases)
  }

  const defaultCanvas: CanvasType = {
    id: "main",
    name: "메인 캔버스",
    blocks: initialBlocks,
    zones: initialZones,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  return [defaultCanvas]
}

const loadCurrentCanvasId = (): string => {
  const storedCurrentCanvasId = localStorage.getItem(CURRENT_CANVAS_KEY)
  return storedCurrentCanvasId || "main"
}

export default function Page() {
  const [canvases, setCanvases] = useState<CanvasType[]>(loadCanvases())
  const [currentCanvasId, setCurrentCanvasId] = useState<string>(loadCurrentCanvasId())
  const [lastSaved, setLastSaved] = useState<Date>(new Date())

  const currentCanvas = canvases.find((c) => c.id === currentCanvasId) || canvases[0]
  const blocks = currentCanvas?.blocks || []
  const zones = currentCanvas?.zones || initialZones

  const [history, setHistory] = useState<WorkBlock[][]>([blocks])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showRelationships, setShowRelationships] = useState(true)
  const [showCompletedBlocks, setShowCompletedBlocks] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false)
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false)
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false)
  const [isCanvasSelectorOpen, setIsCanvasSelectorOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isAIEnabled, setIsAIEnabled] = useState(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(canvases))
    localStorage.setItem(CURRENT_CANVAS_KEY, currentCanvasId)
    setLastSaved(new Date())
  }, [canvases, currentCanvasId])

  useEffect(() => {
    setCanvases((prev) =>
      prev.map((canvas) => (canvas.id === currentCanvasId ? { ...canvas, blocks, updatedAt: Date.now() } : canvas)),
    )
  }, [blocks, currentCanvasId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault()
        setIsCreateDialogOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        handleUndo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsCanvasSelectorOpen(true)
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
  }, [historyIndex])

  const deletedBlocks = blocks
    .filter((b) => !b.isAIControl && b.isDeleted)
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
    .slice(0, 10)

  const activeBlocks = blocks.filter((b) => !b.isDeleted)

  const saveToHistory = (newBlocks: WorkBlock[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newBlocks)
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(historyIndex + 1)
    }
    setHistory(newHistory)
    setBlocks(newBlocks)
  }

  const setBlocks = (newBlocks: WorkBlock[]) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, blocks: newBlocks, updatedAt: Date.now() } : canvas,
      ),
    )
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setBlocks([...history[newIndex]])
    }
  }

  const handleUpdateBlock = (id: string, updates: Partial<WorkBlock>, skipHistory = false) => {
    const block = blocks.find((b) => b.id === id)
    if (block?.isAIControl && updates.aiEnabled !== undefined) {
      setIsAIEnabled(updates.aiEnabled)
    }

    const newBlocks = blocks.map((block) => (block.id === id ? { ...block, ...updates } : block))
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
    const canvas = canvases.find((c) => c.id === id)
    if (canvas) {
      setHistory([canvas.blocks])
      setHistoryIndex(0)
    }
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
        canUndo={historyIndex > 0}
        isAIEnabled={isAIEnabled}
        onToggleAI={handleToggleAI}
        currentCanvasName={currentCanvas?.name || "메인 캔버스"}
        onOpenCanvasSelector={() => setIsCanvasSelectorOpen(true)}
        lastSaved={lastSaved}
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
      />

      <CreateBlockDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateBlock={handleCreateBlock}
        zones={zones}
        isAIEnabled={isAIEnabled}
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
    </div>
  )
}
