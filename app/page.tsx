"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Canvas } from "@/components/canvas"
import { Header, type SyncStatus } from "@/components/header"
import { CreateBlockDialog } from "@/components/create-block-dialog"
import { ReflectionDialog } from "@/components/reflection-dialog"
import { AreaManagementDialog } from "@/components/area-management-dialog"
import { CanvasSelectorDialog } from "@/components/canvas-selector-dialog"
import { AboutDialog } from "@/components/about-dialog"
import dynamic from "next/dynamic"
import { isMasterEmail } from "@/lib/constants/master"
import { FREE_CANVAS_LIMIT } from "@/lib/constants/plans"
import { WelcomeDialog } from "@/components/welcome-dialog"
import { BlockSearchDialog } from "@/components/block-search-dialog"
import { BlockDetailDialog } from "@/components/block-detail-dialog"
import { ArchiveDock } from "@/components/archive-dock"
import { ArchiveDialog } from "@/components/archive-dialog"
import type { CanvasViewport, WorkBlock, Zone, Canvas as CanvasType } from "@/types"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedCanvasName } from "@/lib/i18n/seed"
import { useAuth } from "@/lib/auth/context"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { deleteBlocks, deleteZones, deleteCanvas, loadUserCanvases, saveCanvas, migrateLocalToSupabase, resetUserCanvases, getUserProfile } from "@/lib/supabase/db"
import { AI_LIMITS } from "@/lib/ai/quota"
import { captureEvent } from "@/lib/supabase/events"
import { toast } from "sonner"

// recharts 를 메인 캔버스 번들에 넣지 않도록 열 때만 로드
const InsightsDialog = dynamic(
  () => import("@/components/insights-dialog").then((m) => m.InsightsDialog),
  { ssr: false },
)

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

3) 결
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
블럭 상세에서 마감일을 추가하면 카드 제목 아래에 표시됩니다.

13) 대표 블럭(공지)
중요한 블럭 하나를 캔버스 상단에 공지처럼 띄워둘 수 있습니다. 블럭의 ⋮ 메뉴에서 '대표로 고정'을 누르면, 캔버스를 팬하거나 옮겨도 상단 배너에 항상 보입니다. 배너를 누르면 그 블럭 상세가 열리고, 배너의 ✕ 또는 메뉴의 '고정 해제'로 내릴 수 있어요. 대표 블럭은 캔버스마다 하나이며, 새로 고정하면 이전 대표는 자동으로 해제됩니다.`,
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
// localStorage 캔버스 데이터가 "누구 것"인지 표시. 다른 계정이 로그인했을 때
// 이전 계정의 로컬 캐시를 자기 데이터로 잘못 병합/업로드하는 것을 막는 데 쓴다.
const LOCAL_OWNER_KEY = "layout_local_owner"
const ONBOARDED_KEY = "layout_onboarded"
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

  // 새 캔버스로 복제된 가이드는 id 가 UUID 라 id 매칭이 안 된다.
  // 가이드는 편집 불가이고 제목("사용 설명서"/"단축키")은 불변이므로 제목으로도 찾는다.
  const template =
    GUIDE_BLOCK_TEMPLATES.get(block.id) ??
    initialBlocks.find((t) => t.isGuide && t.title === block.title)
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

// soft-delete 된 블럭(tombstone)의 하드 정리 유예기간. 이 기간 안에는 어떤 기기/탭의
// 전량 upsert 도 tombstone 을 그대로 upsert 할 뿐이라 부활이 불가능하고,
// 지난 뒤에는 로그인 시점에 실제 행을 지운다.
const DELETED_BLOCK_TTL_MS = 30 * 24 * 60 * 60 * 1000

const pruneOldDeletedBlocks = (
  canvases: CanvasType[],
): { canvases: CanvasType[]; prunedIds: string[] } => {
  const prunedIds: string[] = []
  const cutoff = Date.now() - DELETED_BLOCK_TTL_MS
  const next = canvases.map((canvas) => {
    const kept = canvas.blocks.filter((b) => {
      const expired = b.isDeleted && (b.deletedAt ?? 0) < cutoff
      if (expired) prunedIds.push(b.id)
      return !expired
    })
    return kept.length === canvas.blocks.length ? canvas : { ...canvas, blocks: kept }
  })
  return { canvases: next, prunedIds }
}

const loadCanvases = (): CanvasType[] => {
  if (typeof window === "undefined") return [getDefaultCanvas()]

  try {
    const storedCanvases = localStorage.getItem(STORAGE_KEY)
    if (storedCanvases) {
      const parsed = JSON.parse(storedCanvases) as CanvasType[]
      // 유예기간 지난 삭제 tombstone 은 로컬에서도 정리 (클라우드 행은 로그인 병합이 정리).
      return pruneOldDeletedBlocks(parsed.map(migrateCanvas)).canvases
    }
  } catch (error) {
    console.error("Failed to load canvases:", error)
    // 파싱 실패한 원본을 대피 — 이대로 default 로 부팅하면 400ms 뒤 debounce 저장이
    // (수동 복구 가능했을) 원본을 default 캔버스로 영구히 덮어쓴다.
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) localStorage.setItem("layout_corrupt_backup", raw)
    } catch {
      /* 백업조차 실패하면 어쩔 수 없음 */
    }
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
  // 콜백/이펙트 안 토스트에서 최신 언어를 읽기 위한 ref 미러 (stale closure 방지).
  const languageRef = useRef(language)
  languageRef.current = language
  const isEn = () => languageRef.current === "en"
  const t = useT()
  const { user, signInWithGoogle } = useAuth()
  const supabaseRef = useRef(createSupabaseBrowserClient())
  const remoteSyncReadyRef = useRef(false)
  const hadStoredCanvasesAtBootRef = useRef(false)
  const [canvases, setCanvases] = useState<CanvasType[]>([getDefaultCanvas()])
  const [currentCanvasId, setCurrentCanvasId] = useState<string>("main")
  const [lastSaved, setLastSaved] = useState<Date>(new Date())
  // 헤더 동기화 상태 아이콘용. 성공은 조용히(아이콘), 예외만 토스트.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced")
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [showRelationships, setShowRelationships] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false)
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false)
  const [isCanvasSelectorOpen, setIsCanvasSelectorOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ blockId: string; nonce: number } | null>(null)
  const [detailBlockId, setDetailBlockId] = useState<string | null>(null)
  const [aiUsage, setAiUsage] = useState<{ create: number; tidy: number; plan: string } | null>(null)
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
      prev.map((c) => {
        if (c.id !== snap.canvasId) return c
        // 스냅샷이 그 사이 삭제된 결을 가리키면 미분류로 비운다.
        // 안 그러면 Undo 가 죽은 zone_id 를 부활시켜 autosave 가 FK 위반으로 죽는다.
        const validZoneIds = new Set(c.zones.map((z) => z.id))
        const blocks = snap.blocks.map((b) =>
          b.zone && !validZoneIds.has(b.zone) ? { ...b, zone: "" } : b,
        )
        return { ...c, blocks, updatedAt: Date.now() }
      }),
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
    const hadStoredCanvases = Boolean(localStorage.getItem(STORAGE_KEY))
    hadStoredCanvasesAtBootRef.current = hadStoredCanvases
    // 첫 방문(저장된 캔버스도, 온보딩 완료 표시도 없음)일 때 환영 모달 1회 노출.
    // URL 에 ?welcome 가 있으면 (온보딩 다시 보기) 언제든 강제로 노출.
    const forceWelcome = new URLSearchParams(window.location.search).has("welcome")
    if (forceWelcome || (!hadStoredCanvases && !localStorage.getItem(ONBOARDED_KEY))) {
      setIsWelcomeOpen(true)
    }
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
    // 계정 전환 레이스 가드: A 로드가 진행 중일 때 B 로 바뀌면, 늦게 끝난 A 로드가
    // B 세션의 canvases 를 덮고 remoteSyncReadyRef 를 되돌려 A 데이터가 B 계정으로
    // 저장될 수 있다. cancelled 면 어떤 setState/ref 복원도 하지 않는다.
    let cancelled = false

    setSyncStatus("syncing")
    ;(async () => {
      try {
        const remoteCanvases = await loadUserCanvases(supabase, userId)
        if (cancelled) return
        // 로컬 캐시가 지금 로그인한 계정 것이 아니면(다른 계정이 쓰던 것 / 게스트 데이터가 아닌 남의 계정)
        // 절대 병합/마이그레이션 대상으로 쓰지 않는다 — 안 그러면 이전 계정의 캔버스가
        // 지금 로그인한 계정으로 그대로 복제되어 들어간다.
        const storedOwner = localStorage.getItem(LOCAL_OWNER_KEY)
        const localBelongsHere = storedOwner === userId || (storedOwner === null && remoteCanvases.length === 0)
        // 다른 계정(또는 미확정 소유)의 로컬 캐시는 병합 대상이 아니지만, 곧 이 계정의
        // 데이터로 덮어써 사라지므로 지우기 전에 백업해 둔다 — 이전 계정의 오프라인 편집 대피.
        if (hadStoredCanvasesAtBootRef.current && !localBelongsHere) {
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) localStorage.setItem("layout_prev_account_backup", raw)
          } catch (backupErr) {
            console.error("prev account backup failed:", backupErr)
          }
        }
        const localCanvases = hadStoredCanvasesAtBootRef.current && localBelongsHere ? loadCanvases() : []
        // 모든 캔버스에 zones도 blocks도 없고, 로컬에 실제 데이터가 있을 때만 "깨진 것"으로 판단.
        // 빈 캔버스를 일부러 만들었거나 네트워크 부분 실패 시 오탐 방지.
        const remoteLooksBroken =
          remoteCanvases.length > 0 &&
          remoteCanvases.every((canvas) => canvas.zones.length === 0 && canvas.blocks.length === 0) &&
          localCanvases.some((canvas) => canvas.zones.length > 0 || canvas.blocks.length > 0)

        if (remoteCanvases.length === 0 || remoteLooksBroken) {
          // 최초 로그인 → localStorage 데이터를 Supabase로 이전
          if (remoteLooksBroken) {
            await Promise.all(remoteCanvases.map((canvas) => deleteCanvas(supabase, canvas.id)))
          }
          const canvasesToMigrate = localCanvases.length > 0 ? localCanvases : [getDefaultCanvas()]
          const migrated = await migrateLocalToSupabase(supabase, userId, canvasesToMigrate)
          if (cancelled) return
          setCanvases(migrated)
          setCurrentCanvasId(migrated[0]?.id ?? "main")
          // 마이그레이션 결과로 히스토리 리셋 — 부트 시점 로컬 스냅샷이 history[0] 에 남아
          // 있으면 Undo 한 번에 마이그레이션 이전 상태로 되돌아가 그대로 재업로드된다.
          setHistory([{ canvasId: migrated[0]?.id ?? "main", blocks: migrated[0]?.blocks ?? [] }])
          setHistoryIndex(0)
          localStorage.setItem("layout_last_synced_at", Date.now().toString())
          setSyncStatus("synced")
          setLastSyncedAt(new Date())
          remoteSyncReadyRef.current = true
          return
        }

        // 클라우드 우선 병합.
        // 로그인하면 언제나 "클라우드"를 기준으로 삼는다 — 로컬이 클라우드를 조용히 덮어쓰지 않도록.
        // 다만 로그아웃 이후 이 기기에서 바꾼 내용이 있으면, 덮어쓰기 전에 백업해두고 사용자에게 알린다.
        // (백업은 항상 최신 1개만 유지. 필요하면 layout_offline_backup 키에서 복구 가능.)
        const lastSyncedRaw = localStorage.getItem("layout_last_synced_at")
        const lastSyncedAt = parseInt(lastSyncedRaw ?? "0", 10)
        const hadOfflineEdits =
          Boolean(lastSyncedRaw) &&
          Number.isFinite(lastSyncedAt) &&
          lastSyncedAt > 0 &&
          localCanvases.some((canvas) => canvas.updatedAt > lastSyncedAt)

        if (hadOfflineEdits) {
          try {
            localStorage.setItem("layout_offline_backup", JSON.stringify(localCanvases))
          } catch (backupErr) {
            console.error("offline backup failed:", backupErr)
          }
          // 예외 상황에만 알림 — 클라우드에 못 올라간 편집을 덮어쓰기 전에 백업했다는 사실.
          // (평상시 동기화 성공은 헤더 아이콘으로만 조용히 표시)
          toast.message(isEn() ? "Loaded your cloud data" : "클라우드 내용을 불러왔어요", {
            description: isEn()
              ? "Some changes on this device hadn't reached the cloud, so they were backed up before overwriting."
              : "이 기기의 변경 중 클라우드에 못 올라간 게 있어, 덮어쓰기 전에 따로 백업해뒀어요.",
            duration: 5000,
          })
        }

        const orderedRemote = [...remoteCanvases].sort((a, b) => a.createdAt - b.createdAt)
        const storedCanvasId = loadCurrentCanvasId()
        const activeId = orderedRemote.some((canvas) => canvas.id === storedCanvasId)
          ? storedCanvasId
          : orderedRemote[0]?.id ?? "main"

        // 원격 데이터도 가이드 블럭 최신화(migrateCanvas)를 거친다 — 안 거치면 옛 버전의
        // 한국어 가이드 본문이 seed 원문과 달라져 영어 모드에서 번역이 풀린다(편집으로 오판).
        // 유예기간 지난 삭제 tombstone 은 이 시점에 하드 정리 (실패해도 다음 로그인에 재시도).
        const pruned = pruneOldDeletedBlocks(orderedRemote.map(migrateCanvas))
        const mergedCanvases = pruned.canvases
        if (pruned.prunedIds.length > 0) {
          deleteBlocks(supabase, pruned.prunedIds).catch((err) =>
            console.error("tombstone prune failed:", err),
          )
        }
        setCanvases(mergedCanvases)
        setCurrentCanvasId(activeId)
        // 병합 결과로 히스토리 리셋 — 부트 시점 로컬 스냅샷이 history[0] 에 남아 있으면
        // Undo 한 번에 동기화 이전 로컬 상태로 롤백되고 그게 클라우드로 재업로드된다.
        const activeCanvas = mergedCanvases.find((c) => c.id === activeId)
        setHistory([{ canvasId: activeId, blocks: activeCanvas?.blocks ?? [] }])
        setHistoryIndex(0)
        // "지금 클라우드와 일치" 시각 기록. 예전엔 여기서 지우고 signOut 에서만 기록해서,
        // 탭을 그냥 닫으면(로그아웃 안 함) 다음 로그인 때 오프라인 편집 감지가 불가능했다.
        localStorage.setItem("layout_last_synced_at", Date.now().toString())
        setSyncStatus("synced")
        setLastSyncedAt(new Date())
        captureEvent(supabase, userId, "session_start")
        remoteSyncReadyRef.current = true
      } catch (err) {
        if (cancelled) return
        console.error("Supabase load error:", err)
        setSyncStatus("error")
        const message = err instanceof Error ? err.message : "Unknown sync error"
        // remoteSyncReadyRef 는 false로 유지 — 불완전한 상태를 덮어쓰지 않도록 저장을 막는다.
        // 다만 사용자는 알아야 한다: 로컬 저장은 계속되지만 클라우드 동기화는 멈춘 상태.
        toast.error(isEn() ? "Cloud sync failed. Changes are saved on this device but won't reach your other devices." : "클라우드 동기화에 실패했어요. 이 기기에는 저장되지만 다른 기기에는 반영되지 않아요.", {
          description: message,
          duration: 8000,
        })
      }
    })()
    return () => {
      cancelled = true
    }
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

  // Supabase 저장 debounce + 실패 재시도.
  const supabaseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncSaveErrorShownRef = useRef(false)
  // 클라우드에 아직 반영 안 된 변경이 있는지. 재시도/온라인 복귀 판단에 쓴다.
  const cloudDirtyRef = useRef(false)
  // 재시도 시점의 최신 canvases 를 읽기 위한 ref 미러 (실패한 시점의 스냅샷이 아니라).
  const canvasesRef = useRef(canvases)
  useEffect(() => {
    canvasesRef.current = canvases
  }, [canvases])

  // localStorage 저장 debounce. 예전엔 canvases 가 바뀔 때마다 즉시 전체 stringify + 동기 쓰기를
  // 했는데, 블럭 드래그는 매 pointermove 마다 canvases 를 갱신하므로 폰에서 프레임이 밀렸다.
  // 쓰기는 조용해진 뒤 한 번으로 모으고, 탭 이탈(pagehide/hidden) 시엔 즉시 flush 해 유실을 막는다.
  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localDirtyRef = useRef(false)
  const currentCanvasIdRef = useRef(currentCanvasId)
  useEffect(() => {
    currentCanvasIdRef.current = currentCanvasId
  }, [currentCanvasId])

  const flushLocalSave = useCallback(() => {
    if (localSaveTimer.current) {
      clearTimeout(localSaveTimer.current)
      localSaveTimer.current = null
    }
    if (!localDirtyRef.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(canvasesRef.current))
      localStorage.setItem(CURRENT_CANVAS_KEY, currentCanvasIdRef.current)
      // 동기화가 끝나 이 canvases가 실제로 이 계정 것이라고 확정된 뒤에만 소유자 표시.
      // 로그아웃 상태에서는 절대 건드리지 않음 — 마지막 로그인 계정 표시가 남아있어야
      // 같은 계정 재로그인 시 오프라인 변경 병합이 정상 동작한다.
      if (user && remoteSyncReadyRef.current) {
        localStorage.setItem(LOCAL_OWNER_KEY, user.id)
      }
      // 쓰기가 전부 성공한 뒤에만 dirty 해제 — 쿼터 초과 등으로 실패하면 dirty 를 유지해
      // 다음 flush(다음 변경 or pagehide)가 재시도한다.
      localDirtyRef.current = false
      setLastSaved(new Date())
    } catch (error) {
      console.error("Failed to save to localStorage:", error)
    }
  }, [user])

  const flushCloudSave = useCallback(() => {
    if (!user || !supabaseRef.current || !remoteSyncReadyRef.current) return
    const supabase = supabaseRef.current
    const userId = user.id
    const snapshot = canvasesRef.current
    cloudDirtyRef.current = false
    setSyncStatus("syncing")
    Promise.all(snapshot.map((c, i) => saveCanvas(supabase, userId, c, i)))
      .then(() => {
        // 클라우드와 일치한 시각 — 다음 로그인의 오프라인 편집 감지(백업 여부 판단) 기준.
        // signOut 에서만 기록하면 탭을 그냥 닫은 세션의 편집은 감지가 안 된다.
        try {
          localStorage.setItem("layout_last_synced_at", Date.now().toString())
        } catch {
          /* 기록 실패는 감지 정확도만 낮출 뿐 — 무시 */
        }
        // 복구 알림은 토스트 대신 헤더 아이콘이 앰버→회색으로 돌아오는 것으로 충분.
        syncSaveErrorShownRef.current = false
        // 저장이 도는 사이 새 편집이 생겼으면(dirty) 아직 synced 가 아니다 — 다음 저장이 내린다.
        if (!cloudDirtyRef.current) {
          setSyncStatus("synced")
          setLastSyncedAt(new Date())
        }
      })
      .catch((err) => {
        console.error("Supabase save error:", err)
        cloudDirtyRef.current = true
        setSyncStatus("error")
        // 10초 뒤 자동 재시도 (변경이 새로 생기면 debounce 경로가 먼저 저장할 수도 있다 — 무해).
        // 네트워크 복귀 시엔 아래 online 리스너가 즉시 재시도.
        if (saveRetryTimer.current) clearTimeout(saveRetryTimer.current)
        saveRetryTimer.current = setTimeout(() => flushCloudSave(), 10_000)
        if (!syncSaveErrorShownRef.current) {
          syncSaveErrorShownRef.current = true
          toast.error(isEn() ? "Cloud save failed. Retrying automatically." : "클라우드 저장에 실패했어요. 자동으로 다시 시도할게요.", {
            description: err instanceof Error ? err.message : String(err),
            duration: 8000,
          })
        }
      })
  }, [user])

  // 탭을 벗어나면(홈으로, 앱 전환, 닫기) 대기 중인 저장을 즉시 커밋 — 로컬과 클라우드 둘 다.
  // 클라우드 flush 를 빼면, 폰에서 편집 직후 앱을 닫을 때 2초 debounce 가 못 돌아
  // last_synced_at 이 안 갱신되고, 다음 부트가 "오프라인 편집"으로 오판해 백업 토스트를 띄운다.
  useEffect(() => {
    const flush = () => {
      flushLocalSave()
      if (cloudDirtyRef.current) {
        if (supabaseSaveTimer.current) {
          clearTimeout(supabaseSaveTimer.current)
          supabaseSaveTimer.current = null
        }
        flushCloudSave()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [flushLocalSave, flushCloudSave])

  // 네트워크 복귀 시 미반영 변경 즉시 재저장.
  useEffect(() => {
    const handleOnline = () => {
      if (cloudDirtyRef.current) flushCloudSave()
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [flushCloudSave])

  // 로그아웃/언마운트 시 재시도 타이머 정리.
  useEffect(() => {
    return () => {
      if (saveRetryTimer.current) {
        clearTimeout(saveRetryTimer.current)
        saveRetryTimer.current = null
      }
    }
  }, [user])

  useEffect(() => {
    if (!isClient) return

    if (supabaseSaveTimer.current) {
      clearTimeout(supabaseSaveTimer.current)
      supabaseSaveTimer.current = null
    }

    // localStorage 저장 (400ms debounce — 드래그 중엔 쓰지 않고 손을 뗀 뒤 한 번)
    localDirtyRef.current = true
    if (localSaveTimer.current) clearTimeout(localSaveTimer.current)
    localSaveTimer.current = setTimeout(flushLocalSave, 400)

    // Supabase 저장 (로그인 상태일 때만, 2초 debounce)
    if (!user || !supabaseRef.current) return
    if (!remoteSyncReadyRef.current) return

    cloudDirtyRef.current = true
    // 편집 즉시 "동기화 중" — Google Docs 의 "저장 중..." 과 같은 타이밍.
    setSyncStatus("syncing")
    supabaseSaveTimer.current = setTimeout(flushCloudSave, 2000)

    return () => {
      if (supabaseSaveTimer.current) {
        clearTimeout(supabaseSaveTimer.current)
        supabaseSaveTimer.current = null
      }
    }
  }, [canvases, currentCanvasId, isClient, user, flushCloudSave, flushLocalSave])

  // AI 사용량(쿼터) 헤더 표시용. 로그인 시 + AI 다이얼로그가 닫힐 때마다 최신화.
  useEffect(() => {
    if (!user || !supabaseRef.current) {
      setAiUsage(null)
      return
    }
    if (isCreateDialogOpen || isReflectionDialogOpen) return
    let cancelled = false
    getUserProfile(supabaseRef.current, user.id)
      .then((p) => {
        if (cancelled || !p) return
        setAiUsage({ create: p.ai_create_used ?? 0, tidy: p.ai_tidy_used ?? 0, plan: p.plan ?? "free" })
      })
      .catch(() => {
        /* 프로필 조회 실패는 표시만 못 할 뿐이라 조용히 무시 */
      })
    return () => {
      cancelled = true
    }
  }, [user, isCreateDialogOpen, isReflectionDialogOpen])

  // 갈무리(archive)된 블럭은 캔버스에 렌더링하지 않고 독/모달에서만 노출.
  const archivedBlocks = blocks.filter((b) => !b.isDeleted && b.isCompleted && !b.isGuide)
  const activeBlocks = blocks.filter((b) => !b.isDeleted)
  const canvasBlocks = activeBlocks.filter((b) => !b.isCompleted)
  // 대표 배너 클릭 시 열 상세 블럭 (id 로 추적해 항상 최신 상태 반영).
  const detailBlock = detailBlockId ? canvasBlocks.find((b) => b.id === detailBlockId) ?? null : null

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
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId && nextCanvas ? nextCanvas : canvas,
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

  const handleBatchUpdateBlocks = (
    updates: Array<{ id: string; updates: Partial<WorkBlock> }>,
    skipHistory = false,
  ) => {
    const newBlocks = blocks.map((block) => {
      const update = updates.find((u) => u.id === block.id)
      return update ? { ...block, ...update.updates } : block
    })
    if (skipHistory) setBlocks(newBlocks)
    else saveToHistory(newBlocks)
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
    // soft-delete: 배열에서 빼지 않고 isDeleted 마킹만. 하드 삭제(deleteBlocks)는 삭제
    // 사실을 모르는 다른 탭/기기의 전량 upsert 가 행을 되살렸다(부활 버그). 마킹은 일반
    // 저장 경로(upsert is_deleted)로 전파되고, 오프라인/저장 실패여도 나중에 함께 동기화
    // 된다. 오래된 tombstone 은 로그인 시 pruneOldDeletedBlocks 가 하드 정리.
    const newBlocks = blocks.map((block) => {
      if (block.id === id) return { ...block, isDeleted: true, deletedAt: Date.now() }
      return block.relatedTo?.includes(id)
        ? { ...block, relatedTo: block.relatedTo.filter((rid) => rid !== id) }
        : block
    })
    saveToHistory(newBlocks)
    if (user && supabaseRef.current) {
      captureEvent(supabaseRef.current, user.id, "block_deleted")
    }
  }

  const handleClearArchivedBlocks = () => {
    if (archivedBlocks.length === 0) return
    if (!confirm(isEn() ? "Empty the archive?" : "갈무리함을 모두 비울까요?")) return

    const archivedIds = new Set(archivedBlocks.map((block) => block.id))
    const now = Date.now()
    const newBlocks = blocks.map((block) => {
      if (archivedIds.has(block.id)) return { ...block, isDeleted: true, deletedAt: now }
      return block.relatedTo?.some((rid) => archivedIds.has(rid))
        ? { ...block, relatedTo: block.relatedTo.filter((rid) => !archivedIds.has(rid)) }
        : block
    })
    saveToHistory(newBlocks)
    if (user && supabaseRef.current) {
      captureEvent(supabaseRef.current, user.id, "block_deleted", { count: archivedIds.size })
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

  // 캔버스 개수 한도 — 무료 플랜은 FREE_CANVAS_LIMIT 개까지. pro/마스터는 무제한 (유료화 대비).
  const canCreateCanvas =
    isMasterEmail(user?.email) || aiUsage?.plan === "pro" || canvases.length < FREE_CANVAS_LIMIT
  // 프로필(plan) 로딩 전에는 잠금 문구를 띄우지 않는다 —
  // pro 유저가 로딩 창에서 "유료 플랜에서 열려요"를 보는 사고 방지 (fetch 실패 시에도 중립 상태 유지).
  const planReady = !user || aiUsage !== null
  // 한도 초과분(기존 다중 캔버스) 삭제는 비가역 — 지우면 무료 한도 때문에 다시 못 만든다는 경고용.
  const deleteLosesSlot =
    Boolean(user) &&
    !isMasterEmail(user?.email) &&
    aiUsage?.plan !== "pro" &&
    canvases.length > FREE_CANVAS_LIMIT

  const handleCreateCanvas = (name: string) => {
    if (!canCreateCanvas) return
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

  // 전체 캔버스를 JSON 파일로 내보내기 (로컬 백업 / 이식용). 로그인 없이도 동작.
  const handleExportAll = () => {
    const payload = {
      app: "LAYOUTNEMO",
      version: 1,
      exportedAt: new Date().toISOString(),
      currentCanvasId,
      canvases,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `layoutnemo-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success(language === "en" ? "Backup downloaded." : "백업 파일을 내려받았어요.")
  }

  // 블럭 검색 결과 선택 → 캔버스를 그 블럭으로 이동 (nonce 로 같은 블럭 재이동도 트리거).
  const handleJumpToBlock = (blockId: string) => {
    setFocusRequest({ blockId, nonce: Date.now() })
  }

  // 대표(공지) 블럭 토글. 캔버스당 1개만 유지 — 새로 고정하면 기존 대표는 해제.
  const handleTogglePin = (blockId: string) => {
    const target = blocks.find((b) => b.id === blockId)
    if (!target) return
    const willPin = !target.isPinned
    const newBlocks = blocks.map((b) => {
      if (b.id === blockId) return { ...b, isPinned: willPin }
      if (willPin && b.isPinned) return { ...b, isPinned: false }
      return b
    })
    saveToHistory(newBlocks)
  }

  const handleUpdateZones = (newZones: Zone[]) => {
    // 사라진 결을 감지해 명시적으로만 삭제한다. (saveCanvas 는 결을 지우지 않으므로,
    // 여기서 지우지 않으면 클라우드에 유령 결이 남는다.)
    const newIds = new Set(newZones.map((z) => z.id))
    const removedIds = (currentCanvas?.zones ?? [])
      .map((z) => z.id)
      .filter((id) => !newIds.has(id))
    const removedSet = new Set(removedIds)

    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              zones: newZones,
              // 삭제된 결을 가리키던 블럭은 로컬에서도 결을 비운다. 안 그러면 DB 의
              // zone_id(on delete set null)와 어긋나, 다음 autosave 가 삭제된 zone_id 로
              // 블럭을 upsert → FK 위반 → 해당 캔버스 블럭 저장이 통째로 죽는다.
              blocks: canvas.blocks.map((b) => (removedSet.has(b.zone) ? { ...b, zone: "" } : b)),
              updatedAt: Date.now(),
            }
          : canvas,
      ),
    )

    if (removedIds.length > 0 && user && supabaseRef.current && remoteSyncReadyRef.current) {
      deleteZones(supabaseRef.current, removedIds).catch((err) => {
        console.error("Supabase delete zones error:", err)
        toast.error(isEn() ? "Couldn't sync the facet deletion to the cloud." : "결 삭제를 클라우드에 반영하지 못했어요.", {
          description: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  // 결 삭제 + 그 결 블럭 재배정 (결 관리 다이얼로그의 삭제 경로).
  // moveToZoneId 가 "" 이면 미분류. tombstone 포함 전체 블럭을 옮겨야
  // 죽은 zone_id 가 남아 autosave 가 FK 위반으로 죽는 일이 없다.
  const handleDeleteZone = (zoneId: string, moveToZoneId: string) => {
    const survivingZones = zones.filter((z) => z.id !== zoneId)
    const target = survivingZones.some((z) => z.id === moveToZoneId) ? moveToZoneId : ""

    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              zones: survivingZones,
              blocks: canvas.blocks.map((b) => (b.zone === zoneId ? { ...b, zone: target } : b)),
              updatedAt: Date.now(),
            }
          : canvas,
      ),
    )

    if (user && supabaseRef.current && remoteSyncReadyRef.current) {
      deleteZones(supabaseRef.current, [zoneId]).catch((err) => {
        console.error("Supabase delete zones error:", err)
        toast.error(isEn() ? "Couldn't sync the facet deletion to the cloud." : "결 삭제를 클라우드에 반영하지 못했어요.", {
          description: err instanceof Error ? err.message : String(err),
        })
      })
    }
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

        // reload 가 일으키는 pagehide flush 가 방금 지운 데이터를 되살리지 않도록,
        // 대기 중인 debounce 저장을 먼저 무효화한다.
        localDirtyRef.current = false
        if (localSaveTimer.current) {
          clearTimeout(localSaveTimer.current)
          localSaveTimer.current = null
        }
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CURRENT_CANVAS_KEY)
        window.location.reload()
      } catch (error) {
        console.error("Failed to reset:", error)
        alert(isEn() ? "Reset failed. Check the 'Failed to reset' error in the browser console." : "초기화에 실패했어요. 브라우저 콘솔의 Failed to reset 오류를 확인해 주세요.")
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

      if (modifier && e.key === "f") {
        e.preventDefault()
        setIsSearchOpen(true)
        return
      }

      if (e.key === "Escape") {
        setIsCreateDialogOpen(false)
        setIsReflectionDialogOpen(false)
        setIsAreaManagementOpen(false)
        setIsCanvasSelectorOpen(false)
        setIsSearchOpen(false)
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
        className={`min-h-screen ${isDarkMode ? "dark bg-[#21252b]" : "bg-[#fafaf9]"}`}
        aria-hidden
      />
    )
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-[#21252b] text-foreground" : "bg-[#fafaf9] text-foreground"}`}>
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
        syncStatus={user ? syncStatus : null}
        lastSyncedAt={lastSyncedAt}
        onReset={handleReset}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenInsights={user ? () => setIsInsightsOpen(true) : undefined}
        aiUsage={aiUsage}
        isReflecting={isReflectionDialogOpen}
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
        focusRequest={focusRequest}
        onTogglePin={handleTogglePin}
        onOpenDetail={(id) => setDetailBlockId(id)}
        isReflecting={isReflectionDialogOpen}
      />

      <CreateBlockDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateBlock={handleCreateBlock}
        zones={zones}
        isAIEnabled={isAIEnabled}
        existingBlocks={activeBlocks}
        visibleCanvasBounds={canvasViewport}
        onShowPreview={setPreviewBlock}
        user={user}
        onLogin={signInWithGoogle}
      />

      <ReflectionDialog
        open={isReflectionDialogOpen}
        onOpenChange={setIsReflectionDialogOpen}
        blocks={activeBlocks}
        // id 단위 병합이라 activeBlocks 에 없는 soft-delete 블럭(동기화 tombstone)이 보존되고,
        // 수락 1회 = 히스토리 1커밋이라 Undo 로 되돌릴 수 있다.
        onApplyChanges={handleBatchUpdateBlocks}
        isAIEnabled={isAIEnabled}
        zones={zones}
      />

      <AreaManagementDialog
        open={isAreaManagementOpen}
        onOpenChange={setIsAreaManagementOpen}
        zones={zones}
        onUpdateZones={handleUpdateZones}
        blockCountByZone={activeBlocks.reduce<Record<string, number>>((acc, b) => {
          if (b.zone) acc[b.zone] = (acc[b.zone] ?? 0) + 1
          return acc
        }, {})}
        onDeleteZone={handleDeleteZone}
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
        canCreate={canCreateCanvas}
        planReady={planReady}
        deleteLosesSlot={deleteLosesSlot}
        onExport={handleExportAll}
        user={user}
      />

      <BlockSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        blocks={canvasBlocks}
        zones={zones}
        onJump={handleJumpToBlock}
      />

      {detailBlock && (
        <BlockDetailDialog
          open
          onOpenChange={(o) => {
            if (!o) setDetailBlockId(null)
          }}
          block={detailBlock}
          onUpdate={(updates, skipHistory) => handleUpdateBlock(detailBlock.id, updates, skipHistory)}
          zones={zones}
        />
      )}

      <AboutDialog open={isAboutOpen} onOpenChange={setIsAboutOpen} />
      <InsightsDialog
        open={isInsightsOpen}
        onOpenChange={setIsInsightsOpen}
        canvases={canvases}
        isMaster={isMasterEmail(user?.email)}
      />

      <WelcomeDialog
        open={isWelcomeOpen}
        onOpenChange={(open) => {
          setIsWelcomeOpen(open)
          // 닫는 순간 온보딩 완료로 표시 → 다음 방문부터 뜨지 않음.
          if (!open) localStorage.setItem(ONBOARDED_KEY, "1")
        }}
      />

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
        onClearAll={handleClearArchivedBlocks}
      />
    </div>
  )
}
