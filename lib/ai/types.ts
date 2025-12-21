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
}

export interface CreateBlockAIOutput {
  title: string
  summary: string
  area: string // Changed from suggestedZone
  due_date: string | null // Changed from suggestedDueDate
  urgency: "안정" | "보통" | "시급" // Changed from English to Korean
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
    newValue: any
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
  zoneDistribution: Record<string, number>
  connectionIssues: string[]
  positionIssues: string[]
  urgencyIssues: string[]
  overallHealth: "good" | "needs_attention" | "critical"
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
    currentValue: any
    suggestedValue: any
    reason: string
  }>
}

export interface MultiStageTidyResult {
  stage: TidyAnalysisStage
  analysis?: TidyComprehensiveAnalysis
  suggestions?: TidyDetailedSuggestion[]
  currentSuggestionIndex?: number
}
