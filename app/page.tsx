"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Canvas } from "@/components/canvas"
import { Header } from "@/components/header"
import { CreateBlockDialog } from "@/components/create-block-dialog"
import { ReflectionDialog } from "@/components/reflection-dialog"
import { AreaManagementDialog } from "@/components/area-management-dialog"
import { CanvasSelectorDialog } from "@/components/canvas-selector-dialog"
import { AboutDialog } from "@/components/about-dialog"
import { ArchiveDock } from "@/components/archive-dock"
import { ArchiveDialog } from "@/components/archive-dialog"
import type { CanvasViewport, WorkBlock, Zone, Canvas as CanvasType } from "@/types"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedCanvasName } from "@/lib/i18n/seed"
import { useAuth } from "@/lib/auth/context"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { deleteCanvas, loadUserCanvases, saveCanvas, migrateLocalToSupabase, resetUserCanvases } from "@/lib/supabase/db"
import { captureEvent } from "@/lib/supabase/events"

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
    height: 168,
    zone: "daily",
    urgency: "stable",
    isGuide: true,
    detailedNotes: `LAYOUTNEMO 는 할 일을 리스트나 보드에 넣지 않고, 캔버스 위에 펼쳐놓는 도구입니다.

1) 블럭 만들기
오른쪽 위 '새 블럭 만들기' 또는 Cmd/Ctrl + N. AI 보조가 켜져 있으면 한 줄만 적어도 제목·요약·결·상태·링크까지 자동으로 정리해줍니다. 입력에 https:// 가 있으면 링크로 추출해요. 꺼져 있으면 직접 입력하세요. 내용은 비워둬도 됩니다.

2) AI 자동 반영 (8초)
AI 가 응답한 뒤 8초 동안 손대지 않으면 자동으로 블럭이 생성됩니다. 카운트다운이 보이고, 어디든 클릭하거나 입력하면 즉시 멈춥니다. "취소" 글자도 누를 수 있어요.

3) 결(Facet)
블럭이 속한 큰 맥락입니다. "기획", "개발" 같은 식으로 업무의 결을 나눠요. 상단의 결 버튼을 누르면 그 결의 블럭만 또렷해지고 나머지는 흐려집니다. 칸막이가 아니라 시선의 필터에 가깝습니다. 결 버튼은 드래그해서 순서를 바꿀 수 있어요.

4) 링크 (선택)
블럭에 외부 URL 을 달아두면 카드 본문 아래 우측에 작은 링크 버튼이 보입니다. 클릭하면 새 탭으로 이동.

5) 연결
연결은 두 가지 드래그 제스처가 명확히 구분됩니다.
• 그냥 드래그: 원하는 자리에 블럭을 옮길 뿐, 연결은 만들지 않음. 블럭 위에 블럭을 쌓아도 연결이 생기지 않아요.
• Shift + 드래그: 한 블럭을 다른 블럭 위에 떨어뜨리면 곡선으로 이어지고, 드래그한 블럭은 원래 자리로 부드럽게 돌아옵니다 (위치는 바꾸지 않고 연결만 만드는 토스 제스처).
연결을 끊으려면 선을 클릭하세요.

6) 상태
블럭의 그림자 색으로 머릿속 무게를 표현합니다. 크기는 바뀌지 않습니다.
• 미정 (회색): 일단 적어뒀지만 할지 말지 아직 모르는 일
• 여유 (파랑): 할 일은 맞지만 급하지 않은 일
• 진행 (초록): 꾸준히 진행하거나 계속 관리 중인 일
• 시급 (빨강): 바로 처리해야 하는 일

7) 캔버스 이동
스페이스바를 누른 채 마우스로 드래그하면 캔버스 전체가 따라옵니다 (피그마 방식).

8) 갈무리
지금 안 보고 싶은 블럭은 블럭 메뉴나 상세 화면의 '갈무리'로 치워두세요. 우하단 갈무리함에서 다시 꺼내면 원래 자리로 돌아옵니다.

9) AI 보조 / 정리하기
헤더의 'AI 보조' 토글로 켜고 끕니다. AI 가 켜져 있을 때 '정리하기' 버튼으로 캔버스 상태에 대한 제안을 받을 수 있습니다. 우선순위는 같은 결 → 내용 유사도 → 위치 순서. 한 번에 하나씩 보여주고, 수락한 변경만 적용됩니다.

10) 캔버스 전환
로고 옆 캔버스 이름을 누르거나 Cmd/Ctrl + K 로 여러 작업 공간을 오갈 수 있습니다. 각 캔버스는 독립적인 블럭과 결을 가집니다.

11) 결 커스터마이징
'결 관리' 버튼에서 결을 추가/수정/삭제할 수 있습니다. 각 결은 고유의 색을 가져요.

12) 마감일
블럭 상세에서 마감일을 추가하면 카드 제목 아래에 표시됩니다.`,
  },
  {
    id: "shortcuts-guide",
    title: "단축키",
    description: "캔버스 이동은 스페이스바 + 드래그, 새 블럭은 Cmd/Ctrl + N. 클릭하면 전체 단축키 목록을 볼 수 있어요.",
    x: 120,
    y: 320,
    width: 280,
    height: 168,
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
• 블럭 메뉴/상세: 갈무리
• Shift + 한 블럭을 다른 블럭에 드롭: 연결 + 원위치 복귀 (토스)
• 연결선 클릭: 연결 끊기

[참고]
헤더의 화살표 ↶↷ 로도 되돌리기/다시 실행이 가능합니다.
텍스트 입력 중에는 Cmd/Ctrl + Z 가 캔버스 되돌리기 대신 일반 텍스트 되돌리기로 동작합니다.`,
  },
  {
    id: "example-1",
    title: "사용자 인터뷰 진행",
    detailedNotes: "5명의 잠재 고객과 인터뷰를 진행하고 니즈 파악 및 피드백 수집",
    x: 650,
    y: 120,
    width: 280,
    height: 116,
    zone: "planning",
    urgency: "urgent",
    dueDate: "2025-01-05",
  },
  {
    id: "example-2",
    title: "프로토타입 개발",
    detailedNotes: "핵심 기능에 대한 MVP 프로토타입 제작 및 테스트 준비",
    x: 1050,
    y: 120,
    width: 280,
    height: 116,
    zone: "development",
    urgency: "stable",
    relatedTo: ["example-1"],
  },
  {
    id: "example-3",
    title: "마케팅 채널 분석",
    detailedNotes: "효과적인 마케팅 채널 조사 및 예산 배분 우선순위 선정",
    x: 650,
    y: 320,
    width: 280,
    height: 116,
    zone: "marketing",
    urgency: "thinking",
    dueDate: "2025-01-15",
  },
  {
    id: "example-4",
    title: "디자인 시스템 구축",
    detailedNotes: "일관된 UI/UX를 위한 컴포넌트 라이브러리와 디자인 가이드라인 작성",
    x: 1050,
    y: 320,
    width: 280,
    height: 116,
    zone: "design",
    urgency: "stable",
    relatedTo: ["example-2"],
  },
  {
    id: "example-5",
    title: "경쟁사 분석 보고서",
    detailedNotes: "주요 경쟁사 3곳의 전략, 가격, 포지셔닝 비교 분석",
    x: 1450,
    y: 120,
    width: 280,
    height: 116,
    zone: "planning",
    urgency: "lingering",
    dueDate: "2025-01-20",
  },
]

const STORAGE_KEY = "layout_canvases"
const CURRENT_CANVAS_KEY = "layout_current_canvas"
const GUIDE_BLOCK_TEMPLATES = new Map(initialBlocks.filter((block) => block.isGuide).map((block) => [block.id, block]))

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

const migrateGuideBlock = (block: WorkBlock): WorkBlock => {
  if (!block.isGuide) return block

  const template = GUIDE_BLOCK_TEMPLATES.get(block.id)
  if (!template) return block

  return {
    ...block,
    title: template.title,
    description: template.description,
    detailedNotes: template.detailedNotes,
    urgency: template.urgency,
  }
}

const migrateCanvas = (canvas: CanvasType): CanvasType => ({
  ...canvas,
  zones: canvas.zones.map((z) => ({
    ...z,
    id: LEGACY_ZONE_ID_MAP[z.id] ?? z.id,
  })),
  blocks: canvas.blocks.map((b) => {
    const source = { ...(b as WorkBlock & { tag?: string }) }
    delete source.tag
    let migrated: WorkBlock = { ...source, zone: LEGACY_ZONE_ID_MAP[source.zone] ?? source.zone }
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
    migrated = migrateGuideBlock(migrated)
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
  const { user } = useAuth()
  const supabaseRef = useRef(createSupabaseBrowserClient())
  const remoteSyncReadyRef = useRef(false)
  const hadStoredCanvasesAtBootRef = useRef(false)
  const [canvases, setCanvases] = useState<CanvasType[]>([getDefaultCanvas()])
  const [currentCanvasId, setCurrentCanvasId] = useState<string>("main")
  const [lastSaved, setLastSaved] = useState<Date>(new Date())
  const [isClient, setIsClient] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showRelationships, setShowRelationships] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false)
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false)
  const [isCanvasSelectorOpen, setIsCanvasSelectorOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  // AI 보조 토글. localStorage 영속화 — 새로고침해도 유지.
  const [isAIEnabled, setIsAIEnabledRaw] = useState(true)
  const setIsAIEnabled = (next: boolean) => {
    setIsAIEnabledRaw(next)
    try {
      localStorage.setItem("layout_ai_enabled", String(next))
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    try {
      const stored = localStorage.getItem("layout_ai_enabled")
      if (stored !== null) setIsAIEnabledRaw(stored === "true")
    } catch {
      // ignore
    }
  }, [])
  const [previewBlock, setPreviewBlock] = useState<Partial<WorkBlock> | null>(null)
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport | null>(null)

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

  const handleCanvasViewportChange = useCallback((next: CanvasViewport) => {
    setCanvasViewport((prev) => {
      if (
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev
      }
      return next
    })
  }, [])

  useEffect(() => {
    setIsClient(true)
    hadStoredCanvasesAtBootRef.current = Boolean(localStorage.getItem(STORAGE_KEY))
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

  // 로그인 시: Supabase 데이터 로드 or localStorage → Supabase 최초 마이그레이션
  useEffect(() => {
    remoteSyncReadyRef.current = false
    if (!isClient || !user || !supabaseRef.current) return
    const supabase = supabaseRef.current
    const userId = user.id

    ;(async () => {
      try {
        const remoteCanvases = await loadUserCanvases(supabase, userId)
        const localCanvases = hadStoredCanvasesAtBootRef.current ? loadCanvases() : []
        const remoteLooksBroken =
          remoteCanvases.length > 0 &&
          remoteCanvases.every((canvas) => canvas.zones.length === 0 && canvas.blocks.length === 0)

        if (remoteCanvases.length === 0 || remoteLooksBroken) {
          // 최초 로그인 → localStorage 데이터를 Supabase로 이전
          if (remoteLooksBroken) {
            await Promise.all(remoteCanvases.map((canvas) => deleteCanvas(supabase, canvas.id)))
          }
          const canvasesToMigrate = localCanvases.length > 0 ? localCanvases : [getDefaultCanvas()]
          const migrated = await migrateLocalToSupabase(supabase, userId, canvasesToMigrate)
          setCanvases(migrated)
          setCurrentCanvasId(migrated[0]?.id ?? "main")
          remoteSyncReadyRef.current = true
          return
        }

        // 로그아웃 시점 — 이 이후의 로컬 변경만 "오프라인 작업"으로 간주
        const lastSyncedRaw = localStorage.getItem("layout_last_synced_at")
        const lastSyncedAt = parseInt(lastSyncedRaw ?? "0", 10)
        const shouldMergeOfflineChanges = Boolean(lastSyncedRaw) && Number.isFinite(lastSyncedAt) && lastSyncedAt > 0

        if (!shouldMergeOfflineChanges) {
          const orderedRemote = [...remoteCanvases].sort((a, b) => a.createdAt - b.createdAt)
          const storedCanvasId = loadCurrentCanvasId()
          const activeId = orderedRemote.some((canvas) => canvas.id === storedCanvasId)
            ? storedCanvasId
            : orderedRemote[0]?.id ?? "main"

          setCanvases(orderedRemote)
          setCurrentCanvasId(activeId)
          localStorage.removeItem("layout_last_synced_at")
          captureEvent(supabase, userId, "session_start")
          remoteSyncReadyRef.current = true
          return
        }

        const remoteById = new Map(remoteCanvases.map((c) => [c.id, c]))
        const localById = new Map(localCanvases.map((c) => [c.id, c]))
        const allIds = new Set([...remoteById.keys(), ...localById.keys()])

        const toUpload: CanvasType[] = []
        const merged: CanvasType[] = []
        const conflicted: CanvasType[] = []

        allIds.forEach((id) => {
          const remote = remoteById.get(id)
          const local = localById.get(id)

          if (remote && local) {
            const localChangedOffline = local.updatedAt > lastSyncedAt
            const remoteChangedSinceLogout = remote.updatedAt > lastSyncedAt

            if (localChangedOffline && remoteChangedSinceLogout) {
              // 양쪽 모두 로그아웃 이후 변경 → 충돌: remote 우선 + 충돌 목록에 기록
              merged.push(remote)
              conflicted.push(local)
            } else if (localChangedOffline) {
              // 로컬만 변경 (다른 기기 작업 없음) → 로컬 우선, Supabase 업로드
              merged.push(local)
              toUpload.push(local)
            } else {
              // remote가 최신이거나 둘 다 변경 없음
              merged.push(remote)
            }
          } else if (remote) {
            merged.push(remote)
          } else if (local) {
            merged.push(local)
            toUpload.push(local)
          }
        })

        if (toUpload.length > 0) {
          await Promise.all(toUpload.map((c, i) => saveCanvas(supabase, userId, c, i)))
        }

        merged.sort((a, b) => a.createdAt - b.createdAt)
        setCanvases(merged)
        setCurrentCanvasId(merged[0]?.id ?? "main")
        localStorage.removeItem("layout_last_synced_at")
        captureEvent(supabase, userId, "session_start")
        remoteSyncReadyRef.current = true

        if (conflicted.length > 0) {
          console.warn(
            `[sync] ${conflicted.length}개 캔버스에서 충돌 발생. 다른 기기의 최신 버전을 사용합니다.`,
            conflicted.map((c) => c.name),
          )
        }
      } catch (err) {
        console.error("Supabase load error:", err)
        // 실패해도 로컬 데이터로 계속 동작
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isClient])

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

  // Supabase 저장 debounce 타이머
  const supabaseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isClient) return

    // localStorage 즉시 저장
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(canvases))
      localStorage.setItem(CURRENT_CANVAS_KEY, currentCanvasId)
      setLastSaved(new Date())
    } catch (error) {
      console.error("Failed to save to localStorage:", error)
    }

    // Supabase 저장 (로그인 상태일 때만, 2초 debounce)
    if (!user || !supabaseRef.current) return
    if (!remoteSyncReadyRef.current) return
    const supabase = supabaseRef.current
    const userId = user.id

    if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current)
    supabaseSaveTimer.current = setTimeout(() => {
      Promise.all(canvases.map((c, i) => saveCanvas(supabase, userId, c, i))).catch((err) =>
        console.error("Supabase save error:", err),
      )
    }, 2000)
  }, [canvases, currentCanvasId, isClient, user])

  // 갈무리(archive)된 블럭은 캔버스에 렌더링하지 않고 독/모달에서만 노출.
  const archivedBlocks = blocks.filter((b) => !b.isDeleted && b.isCompleted && !b.isGuide)
  const activeBlocks = blocks.filter((b) => !b.isDeleted)
  const canvasBlocks = activeBlocks.filter((b) => !b.isCompleted)

  const persistCanvasNow = (canvas: CanvasType) => {
    if (!user || !supabaseRef.current || !remoteSyncReadyRef.current) return
    const existingPosition = canvases.findIndex((c) => c.id === canvas.id)
    const position = existingPosition >= 0 ? existingPosition : canvases.length
    saveCanvas(supabaseRef.current, user.id, canvas, position).catch((err) =>
      console.error("Supabase immediate save error:", err),
    )
  }

  const saveToHistory = (newBlocks: WorkBlock[]) => {
    const nextCanvas = currentCanvas ? { ...currentCanvas, blocks: newBlocks, updatedAt: Date.now() } : null
    // 캔버스는 즉시 업데이트
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId && nextCanvas ? nextCanvas : canvas,
      ),
    )
    if (nextCanvas) persistCanvasNow(nextCanvas)

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
    if (user && supabaseRef.current) {
      captureEvent(supabaseRef.current, user.id, "block_created", { urgency: block.urgency })
    }
  }

  // 갈무리함에서 캔버스로 꺼내기 (isCompleted=false).
  const handleUnarchiveBlock = (id: string) => {
    const newBlocks = blocks.map((b) => (b.id === id ? { ...b, isCompleted: false } : b))
    saveToHistory(newBlocks)
  }

  const handleDeleteArchivedBlock = (id: string) => {
    const newBlocks = blocks.filter((block) => block.id !== id)
    saveToHistory(newBlocks)
    if (user && supabaseRef.current) {
      captureEvent(supabaseRef.current, user.id, "block_deleted")
    }
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
    if (user && supabaseRef.current && remoteSyncReadyRef.current) {
      deleteCanvas(supabaseRef.current, id).catch((err) => console.error("Supabase delete canvas error:", err))
    }
    if (currentCanvasId === id) {
      const remainingCanvas = canvases.find((c) => c.id !== id)
      if (remainingCanvas) {
        setCurrentCanvasId(remainingCanvas.id)
      }
    }
  }

  const handleCreateCanvas = (name: string) => {
    const sourceZones = zones.length > 0 ? zones : initialZones
    const zoneIdMap = new Map<string, string>()
    const newZones = sourceZones.map((zone) => {
      const id = crypto.randomUUID()
      zoneIdMap.set(zone.id, id)
      return { ...zone, id }
    })
    const sourceGuideBlocks = blocks.filter((block) => block.isGuide).slice(0, 2)
    const guideBlocks = (sourceGuideBlocks.length > 0 ? sourceGuideBlocks : initialBlocks.filter((block) => block.isGuide)).map(
      (block) => ({
        ...block,
        id: crypto.randomUUID(),
        zone: zoneIdMap.get(block.zone) ?? newZones[0]?.id ?? "",
        relatedTo: [],
      }),
    )
    const newCanvas: CanvasType = {
      id: crypto.randomUUID(),
      name,
      blocks: guideBlocks,
      zones: newZones,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setCanvases((prev) => [...prev, newCanvas])
    setCurrentCanvasId(newCanvas.id)
    persistCanvasNow(newCanvas)
  }

  const handleUpdateZones = (newZones: Zone[]) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, zones: newZones, updatedAt: Date.now() } : canvas,
      ),
    )
  }

  // 헤더 결 탭 드래그 정렬: 새 순서의 zone id 배열을 받아 그 순서대로 zones 재구성.
  const handleReorderZones = (orderedIds: string[]) => {
    const byId = new Map(zones.map((z) => [z.id, z]))
    const reordered = orderedIds.map((id) => byId.get(id)).filter((z): z is Zone => Boolean(z))
    // 누락된 zone 이 있으면 뒤에 그대로 붙임 (안전망).
    zones.forEach((z) => {
      if (!orderedIds.includes(z.id)) reordered.push(z)
    })
    handleUpdateZones(reordered)
  }

  const handleCopyBlock = (sourceBlockId: string) => {
    const sourceBlock = blocks.find((b) => b.id === sourceBlockId)
    if (!sourceBlock || sourceBlock.isGuide) return

    const newBlock: WorkBlock = {
      ...sourceBlock,
      id: crypto.randomUUID(),
      x: sourceBlock.x + 30,
      y: sourceBlock.y + 30,
      relatedTo: [],
    }

    const newBlocks = [...blocks, newBlock]
    saveToHistory(newBlocks)
  }

  const handleReset = async () => {
    // reset 은 의도적으로 가이드/예시까지 포함한 "완전 초기화" 의미.
    if (confirm(t("confirm.reset"))) {
      try {
        const defaultCanvas = getDefaultCanvas()

        if (user && supabaseRef.current) {
          remoteSyncReadyRef.current = false
          await resetUserCanvases(supabaseRef.current, user.id)
          const migrated = await migrateLocalToSupabase(supabaseRef.current, user.id, [defaultCanvas])
          const activeCanvas = migrated[0] ?? defaultCanvas
          setCanvases(migrated)
          setCurrentCanvasId(activeCanvas.id)
          setHistory([{ canvasId: activeCanvas.id, blocks: activeCanvas.blocks }])
          setHistoryIndex(0)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          localStorage.setItem(CURRENT_CANVAS_KEY, activeCanvas.id)
          remoteSyncReadyRef.current = true
          return
        }

        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CURRENT_CANVAS_KEY)
        window.location.reload()
      } catch (error) {
        console.error("Failed to reset:", error)
        alert("초기화에 실패했어요. 브라우저 콘솔의 Failed to reset 오류를 확인해 주세요.")
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
        setIsCanvasSelectorOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleUndo, handleRedo])

  // 새로고침 직후 SSR/초기 렌더는 default state 로 그려진 뒤, useEffect 가 localStorage 의 저장 상태로
  // 갈아치우면서 잠깐 "옛 위치 → 새 위치" 점프(또는 애니메이션) 가 보였다. isClient 전엔 빈 배경만 그려서
  // 사용자가 항상 저장된 상태부터 보도록 한다.
  if (!isClient) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? "dark bg-[#151823]" : "bg-[#fafaf9]"}`}
        aria-hidden
      />
    )
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-[#151823] text-zinc-100" : "bg-[#fafaf9] text-foreground"}`}>
      <Header
        onCreateBlock={() => setIsCreateDialogOpen(true)}
        onReflect={() => setIsReflectionDialogOpen(true)}
        zones={zones}
        selectedZone={selectedZone}
        onZoneSelect={setSelectedZone}
        onManageAreas={() => setIsAreaManagementOpen(true)}
        onReorderZones={handleReorderZones}
        showRelationships={showRelationships}
        onToggleRelationships={() => setShowRelationships(!showRelationships)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
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
        onUpdateBlock={handleUpdateBlock}
        onBatchUpdateBlocks={handleBatchUpdateBlocks}
        onCopyBlock={handleCopyBlock}
        isDarkMode={isDarkMode}
        previewBlock={previewBlock} // 미리보기 블록 전달
        onViewportChange={handleCanvasViewportChange}
      />

      <CreateBlockDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateBlock={handleCreateBlock}
        zones={zones}
        isAIEnabled={isAIEnabled}
        existingBlocks={activeBlocks}
        visibleCanvasBounds={canvasViewport}
        onShowPreview={setPreviewBlock} // 미리보기 핸들러 전달
      />

      <ReflectionDialog
        open={isReflectionDialogOpen}
        onOpenChange={setIsReflectionDialogOpen}
        blocks={activeBlocks}
        onUpdateBlocks={setBlocks}
        isAIEnabled={isAIEnabled}
        zones={zones}
      />

      <AreaManagementDialog
        open={isAreaManagementOpen}
        onOpenChange={setIsAreaManagementOpen}
        zones={zones}
        onUpdateZones={handleUpdateZones}
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
        isDarkMode={isDarkMode}
        onClick={() => setIsArchiveOpen(true)}
      />

      <ArchiveDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        archivedBlocks={archivedBlocks}
        zones={zones}
        onRestore={handleUnarchiveBlock}
        onDelete={handleDeleteArchivedBlock}
      />
    </div>
  )
}
