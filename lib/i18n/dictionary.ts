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
    "header.showCompleted": "완료 보기",
    "header.hideCompleted": "완료 숨기기",
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
    "action.complete": "완료",
    "action.edit": "편집",
    "action.add": "추가",
    "action.apply": "적용",
    "action.skip": "건너뛰기",
    "action.close": "닫기",
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
    "header.showCompleted": "Show completed",
    "header.hideCompleted": "Hide completed",
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
    "action.complete": "Complete",
    "action.edit": "Edit",
    "action.add": "Add",
    "action.apply": "Apply",
    "action.skip": "Skip",
    "action.close": "Close",
  },
} as const
