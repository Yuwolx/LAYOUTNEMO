import type { Urgency } from "@/types"

/**
 * 시급도 4단계의 단일 소스(Single Source of Truth).
 *
 * - 블럭 크기는 모두 동일하며, 중요도는 오직 "색상"으로만 표현한다.
 * - 이 파일의 값이 블럭 카드의 그림자 색, 다이얼로그 라벨, 가이드 문구 전부를 지배한다.
 *
 * (이전 기획에는 "normal" 5단계가 있었으나, 현재 구현은 "normal" 을 제외한 4단계다.)
 */
export const URGENCY_KEYS: readonly Urgency[] = ["stable", "thinking", "lingering", "urgent"] as const

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
    label: "안정",
    description: "천천히 진행해도 되는 일",
    colorName: "회색",
    shadowLight: "shadow-[0_4px_18px_rgba(0,0,0,0.12)]",
    shadowDark: "shadow-[0_4px_18px_rgba(0,0,0,0.45)]",
  },
  thinking: {
    label: "생각 중",
    description: "아직 구체화되지 않은 아이디어",
    colorName: "파란색",
    shadowLight: "shadow-[0_6px_24px_rgba(59,130,246,0.45)]",
    shadowDark: "shadow-[0_6px_22px_rgba(59,130,246,0.55)]",
  },
  lingering: {
    label: "머물러 있음",
    description: "미루고 있지만 언젠가 해야 할 일",
    colorName: "노란색",
    shadowLight: "shadow-[0_6px_24px_rgba(251,191,36,0.5)]",
    shadowDark: "shadow-[0_6px_22px_rgba(251,191,36,0.55)]",
  },
  urgent: {
    label: "시급",
    description: "즉시 처리가 필요한 일",
    colorName: "주황색",
    shadowLight: "shadow-[0_6px_26px_rgba(251,146,60,0.55)]",
    shadowDark: "shadow-[0_6px_24px_rgba(251,146,60,0.6)]",
  },
}

/** 다이얼로그 등에서 "안정 (회색)" 형태로 보여줄 때 사용 */
export function formatUrgencyLabel(urgency: Urgency): string {
  const meta = URGENCY_META[urgency]
  return `${meta.label} (${meta.colorName})`
}
