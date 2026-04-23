/** 정리하기 / 블럭 생성 제안에서 변경 가능한 필드 값의 가능한 타입들 */
export type FieldChangeValue = string | number | string[] | boolean | null

export interface CreateBlockAIInput {
  userInput: string
  existingBlocks: {
    id: string
    title: string
    zone: string
    urgency: string
  }[]
  zones: {
    id: string
    label: string
  }[]
  /** AI 응답 언어. 기본값은 한국어. */
  language?: "ko" | "en"
}

export interface CreateBlockAIOutput {
  title: string
  summary: string
  suggestedZone: string
  zoneReason: string
  suggestedDueDate: string | null
  suggestedUrgency: "stable" | "thinking" | "lingering" | "urgent"
}

export interface TidySuggestionInput {
  blocks: {
    id: string
    title: string
    description: string
    zone: string
    urgency: string
    x: number
    y: number
    lastModified?: number
  }[]
  zones: {
    id: string
    label: string
  }[]
}

export interface TidySuggestion {
  type: "position" | "urgency" | "zone" | "size" | "connection"
  blockId: string
  question: string
  proposedChange: {
    field: string
    newValue: FieldChangeValue
    reason: string
  }
}

export interface TidySuggestionResult {
  suggestion: TidySuggestion | null
  hasMore: boolean
}

export interface TidyAnalysisStage {
  stage: "analyzing" | "suggestions" | "applying" | "complete"
  message: string
  progress: number
}

export interface TidyComprehensiveAnalysis {
  totalBlocks: number
  completedBlocks?: number
  zoneDistribution: Record<string, number>
  connectionIssues: string[]
  positionIssues: string[]
  urgencyIssues: string[]
  overallHealth: "good" | "needs_attention" | "critical"
  insight?: string
}

export interface TidyDetailedSuggestion {
  id: string
  type: "position" | "urgency" | "zone" | "connection" | "cleanup"
  priority: "high" | "medium" | "low"
  blockIds: string[]
  question: string
  changes: Array<{
    blockId: string
    field: string
    currentValue: FieldChangeValue
    suggestedValue: FieldChangeValue
    reason: string
  }>
}

export interface MultiStageTidyResult {
  stage: TidyAnalysisStage
  analysis?: TidyComprehensiveAnalysis
  suggestions?: TidyDetailedSuggestion[]
  currentSuggestionIndex?: number
}
