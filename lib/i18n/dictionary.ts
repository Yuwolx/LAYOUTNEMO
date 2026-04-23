/**
 * LAYOUTNEMO UI 문자열 사전.
 *
 * 원칙
 * - UI 크롬(버튼 / 라벨 / 다이얼로그 타이틀 / 메뉴) 만 번역.
 * - 사용자가 직접 적은 콘텐츠 (블럭 제목 / 설명 / 결 이름) 는 번역 대상 아님.
 * - 가이드 블럭 본문은 v1 에서는 한국어 버전만 유지 (언어 토글에 영향 없음).
 */

export type Language = "ko" | "en"

export type TranslationKey = keyof typeof DICT.ko

export const DICT = {
  ko: {
    // Header
    "header.createBlock": "새 블럭 만들기",
    "header.reflect": "정리하기",
    "header.addFacet": "+ 결 추가",
    "header.aiAssist": "AI 보조",
    "header.darkMode": "다크 모드 전환",
    "header.lightMode": "라이트 모드 전환",
    "header.showRelationships": "연결 보기",
    "header.hideRelationships": "연결 숨기기",
    "header.showCompleted": "갈무리 보기",
    "header.hideCompleted": "갈무리 숨기기",
    "header.trash": "휴지통",
    "header.reset": "초기화",
    "header.undo": "되돌리기",
    "header.redo": "재실행",
    "header.switchLanguage": "English",
    "header.lastSaved": "마지막 저장",

    // Dialogs
    "dialog.createBlock.title": "새 블럭 만들기",
    "dialog.blockDetail.title": "블럭 상세",
    "dialog.reflect.title": "정리하기",
    "dialog.manageFacets.title": "결 관리",
    "dialog.manageFacets.description": "작업 공간의 결을 추가하거나 수정할 수 있어요.",
    "dialog.manageFacets.placeholder": "새 결 이름",
    "dialog.trash.title": "휴지통",
    "dialog.canvasSelector.title": "캔버스 선택",

    // Labels (common)
    "label.facet": "결",
    "label.facetRequired": "결 (필수)",
    "label.urgency": "시급도",
    "label.dueDate": "기한",
    "label.title": "제목",
    "label.description": "설명",
    "label.notes": "상세 메모",
    "label.optional": "선택",

    // Urgency
    "urgency.stable": "안정",
    "urgency.thinking": "생각 중",
    "urgency.lingering": "머물러 있음",
    "urgency.urgent": "시급",
    "urgency.stable.color": "회색",
    "urgency.thinking.color": "파란색",
    "urgency.lingering.color": "노란색",
    "urgency.urgent.color": "주황색",

    // Actions
    "action.save": "저장",
    "action.cancel": "취소",
    "action.delete": "삭제",
    "action.restore": "복원",
    "action.complete": "갈무리",
    "action.archive": "갈무리",
    "action.unarchive": "꺼내기",
    "action.edit": "편집",
    "action.add": "추가",
    "action.apply": "적용",
    "action.skip": "건너뛰기",
    "action.close": "닫기",

    // Reflection (정리하기)
    "reflect.intro.heading": "정리하기는 AI가 작업 공간을 깊이 분석합니다:",
    "reflect.intro.item1": "블럭 간 관계와 패턴 발견",
    "reflect.intro.item2": "결 분포와 배치 최적화",
    "reflect.intro.item3": "연결이 필요한 블럭 찾기",
    "reflect.intro.item4": "시급도와 우선순위 검토",
    "reflect.intro.subnote": "더 정교한 분석을 위해 시간이 조금 걸립니다.",
    "reflect.action.start": "시작하기",
    "reflect.action.analyzing": "분석 중...",
    "reflect.progress.almost": "곧 완료됩니다...",
    "reflect.progress.wait": "조금만 기다려주세요",
    "reflect.priority.high": "높은 우선순위",
    "reflect.priority.medium": "보통 우선순위",
    "reflect.priority.low": "낮은 우선순위",
    "reflect.type.connection": "연결",
    "reflect.type.position": "위치",
    "reflect.type.zone": "결",
    "reflect.type.urgency": "시급도",
    "reflect.changes.heading": "변경될 내용:",
    "reflect.action.skip": "건너뛰기",
    "reflect.action.apply": "적용하기",
    "reflect.action.later": "나중에 다시 볼게요",
    "reflect.summary.applied": "적용",
    "reflect.summary.skipped": "건너뜀",
    "reflect.summary.suffix": "개",
    "reflect.health.label": "전체 상태:",
    "reflect.health.good": "✓ 좋음",
    "reflect.health.needs_attention": "⚠ 주의 필요",
    "reflect.health.critical": "⚠ 개선 필요",
    "reflect.blocks.total": "총 블럭",
    "reflect.blocks.completed": "완료",
    "reflect.message.allReviewed": "모든 제안을 검토했습니다",
    "reflect.message.error": "분석 중 오류가 발생했습니다",
    "reflect.stage.analyzing": "블럭 배치 패턴 분석 중...",

    // Confirmations
    "confirm.reset": "모든 데이터를 초기화하고 처음 상태로 돌아갑니다. 가이드 블럭과 예시 블럭도 다시 나타납니다. 계속하시겠습니까?",

    // Archive dock & dialog
    "archive.dock.label": "갈무리함",
    "archive.dock.hint": "여기로 드래그해 갈무리",
    "archive.dialog.title": "갈무리함",
    "archive.dialog.description": "갈무리한 블럭들입니다. 타일을 클릭하면 다시 꺼낼 수 있어요.",
    "archive.dialog.empty": "아직 갈무리된 블럭이 없어요.",
    "archive.dialog.count": "개 보관됨",
  },
  en: {
    // Header
    "header.createBlock": "Create Block",
    "header.reflect": "Reflect",
    "header.addFacet": "+ Add Facet",
    "header.aiAssist": "AI Assist",
    "header.darkMode": "Switch to dark mode",
    "header.lightMode": "Switch to light mode",
    "header.showRelationships": "Show connections",
    "header.hideRelationships": "Hide connections",
    "header.showCompleted": "Show archive",
    "header.hideCompleted": "Hide archive",
    "header.trash": "Trash",
    "header.reset": "Reset",
    "header.undo": "Undo",
    "header.redo": "Redo",
    "header.switchLanguage": "한국어",
    "header.lastSaved": "Last saved",

    // Dialogs
    "dialog.createBlock.title": "Create Block",
    "dialog.blockDetail.title": "Block Details",
    "dialog.reflect.title": "Reflect",
    "dialog.manageFacets.title": "Manage Facets",
    "dialog.manageFacets.description": "Add or edit facets in this workspace.",
    "dialog.manageFacets.placeholder": "New facet name",
    "dialog.trash.title": "Trash",
    "dialog.canvasSelector.title": "Select Canvas",

    // Labels (common)
    "label.facet": "Facet",
    "label.facetRequired": "Facet (required)",
    "label.urgency": "Urgency",
    "label.dueDate": "Due date",
    "label.title": "Title",
    "label.description": "Description",
    "label.notes": "Notes",
    "label.optional": "optional",

    // Urgency
    "urgency.stable": "Stable",
    "urgency.thinking": "Thinking",
    "urgency.lingering": "Lingering",
    "urgency.urgent": "Urgent",
    "urgency.stable.color": "gray",
    "urgency.thinking.color": "blue",
    "urgency.lingering.color": "yellow",
    "urgency.urgent.color": "orange",

    // Actions
    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.restore": "Restore",
    "action.complete": "Archive",
    "action.archive": "Archive",
    "action.unarchive": "Restore",
    "action.edit": "Edit",
    "action.add": "Add",
    "action.apply": "Apply",
    "action.skip": "Skip",
    "action.close": "Close",

    // Reflection
    "reflect.intro.heading": "Reflect analyzes your workspace in depth:",
    "reflect.intro.item1": "Find relationships and patterns between blocks",
    "reflect.intro.item2": "Optimize facet distribution and placement",
    "reflect.intro.item3": "Identify blocks that need to be connected",
    "reflect.intro.item4": "Review urgency and priority",
    "reflect.intro.subnote": "This takes a moment for a more thorough analysis.",
    "reflect.action.start": "Start",
    "reflect.action.analyzing": "Analyzing...",
    "reflect.progress.almost": "Almost done...",
    "reflect.progress.wait": "Just a moment",
    "reflect.priority.high": "High priority",
    "reflect.priority.medium": "Medium priority",
    "reflect.priority.low": "Low priority",
    "reflect.type.connection": "Connection",
    "reflect.type.position": "Position",
    "reflect.type.zone": "Facet",
    "reflect.type.urgency": "Urgency",
    "reflect.changes.heading": "What will change:",
    "reflect.action.skip": "Skip",
    "reflect.action.apply": "Apply",
    "reflect.action.later": "Review later",
    "reflect.summary.applied": "Applied",
    "reflect.summary.skipped": "Skipped",
    "reflect.summary.suffix": "",
    "reflect.health.label": "Overall state:",
    "reflect.health.good": "✓ Good",
    "reflect.health.needs_attention": "⚠ Needs attention",
    "reflect.health.critical": "⚠ Needs improvement",
    "reflect.blocks.total": "Total blocks",
    "reflect.blocks.completed": "completed",
    "reflect.message.allReviewed": "All suggestions reviewed",
    "reflect.message.error": "Something went wrong during analysis",
    "reflect.stage.analyzing": "Analyzing block patterns...",

    // Confirmations
    "confirm.reset": "This resets everything to the initial state. Guide and example blocks will reappear. Continue?",

    // Archive dock & dialog
    "archive.dock.label": "Archive",
    "archive.dock.hint": "Drop here to archive",
    "archive.dialog.title": "Archive",
    "archive.dialog.description": "Archived blocks. Click a tile to bring it back.",
    "archive.dialog.empty": "No archived blocks yet.",
    "archive.dialog.count": "archived",
  },
} as const
