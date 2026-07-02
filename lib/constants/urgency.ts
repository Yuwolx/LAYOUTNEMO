import type { Urgency } from "@/types"

/**
 * 시급도 4단계의 단일 소스(Single Source of Truth).
 *
 * - 블럭 크기는 모두 동일하며, 중요도는 오직 "색상"으로만 표현한다.
 * - 이 파일의 값이 블럭 카드의 그림자 색, 다이얼로그 라벨, 가이드 문구 전부를 지배한다.
 * - 내부 키는 기존 저장 데이터 호환을 위해 유지한다:
 *   thinking=미정(회색), stable=여유(파랑), lingering=진행(초록), urgent=시급(빨강).
 *
 * (이전 기획에는 "normal" 5단계가 있었으나, 현재 구현은 "normal" 을 제외한 4단계다.)
 */
export const URGENCY_KEYS: readonly Urgency[] = ["thinking", "stable", "lingering", "urgent"] as const

export const URGENCY_META: Record<Urgency, {
  /** 블럭 상세 / 필터에 노출되는 공식 한국어 라벨 */
  label: string
  /** 한 줄 의미 설명 (가이드 / 툴팁용) */
  description: string
  /** 시각적으로 연상되는 색상 키워드 (가이드 문구용) */
  colorName: string
  /** 라이트 모드 블럭 그림자 Tailwind 클래스 */
  shadowLight: string
  /** 다크 모드 블럭 그림자 Tailwind 클래스 */
  shadowDark: string
}> = {
  stable: {
    label: "여유",
    description: "할 일은 맞지만 급하지 않은 일",
    colorName: "파란색",
    shadowLight: "shadow-[0_6px_28px_rgba(147,197,253,0.65)]",
    shadowDark: "shadow-[0_6px_26px_rgba(147,197,253,0.50)]",
  },
  thinking: {
    label: "미정",
    description: "일단 적어뒀지만 할지 말지 아직 모르는 일",
    colorName: "회색",
    shadowLight: "shadow-[0_4px_18px_rgba(0,0,0,0.10)]",
    // 다크 모드 배경(#151823)이 거의 검정이라 검정 그림자는 묻힘.
    // 흰색 계열의 부드러운 광으로 대비 확보.
    shadowDark: "shadow-[0_4px_20px_rgba(255,255,255,0.08)]",
  },
  lingering: {
    label: "진행",
    description: "꾸준히 진행하거나 계속 관리 중인 일",
    colorName: "초록색",
    shadowLight: "shadow-[0_6px_28px_rgba(134,239,172,0.65)]",
    shadowDark: "shadow-[0_6px_26px_rgba(134,239,172,0.50)]",
  },
  urgent: {
    label: "시급",
    description: "즉시 처리가 필요한 일",
    colorName: "빨간색",
    shadowLight: "shadow-[0_6px_30px_rgba(252,165,165,0.70)]",
    shadowDark: "shadow-[0_6px_28px_rgba(252,165,165,0.55)]",
  },
}

/** 다이얼로그 등에서 "여유 (파란색)" 형태로 보여줄 때 사용 */
export function formatUrgencyLabel(urgency: Urgency): string {
  const meta = URGENCY_META[urgency]
  return `${meta.label} (${meta.colorName})`
}

/** 시급도 색 RGB 트리플 (블럭 그림자와 같은 계열). 링/점 등 인라인 스타일용. */
export const URGENCY_RGB: Record<Urgency, string> = {
  thinking: "212, 212, 216",
  stable: "147, 197, 253",
  lingering: "134, 239, 172",
  urgent: "252, 165, 165",
}

/** 대표(공지) 블럭 전용 색 — 시급도 4색·선택 보라와 겹치지 않는 앰버. 핀/링/글로우 통일용. */
export const NOTICE_RGB = "245, 158, 11"
