export type Urgency = "stable" | "thinking" | "lingering" | "urgent"

export interface WorkBlock {
  id: string
  title: string
  description: string
  x: number
  y: number
  width: number
  height: number
  zone: string
  urgency?: Urgency
  dueDate?: string
  relatedTo?: string[]
  isGuide?: boolean
  isCompleted?: boolean
  isDeleted?: boolean
  deletedAt?: number
  detailedNotes?: string
  originalState?: {
    width: number
    height: number
    urgency: string
  }
  /** AI 토글 전용 특수 블럭 여부 (guide 블럭 중 하나) */
  isAIControl?: boolean
  /** isAIControl=true 일 때만 의미. 현재 AI 기능 on/off 상태 */
  aiEnabled?: boolean
}

export interface Zone {
  id: string
  label: string
  color: string
}

export interface Canvas {
  id: string
  name: string
  blocks: WorkBlock[]
  zones: Zone[]
  createdAt: number
  updatedAt: number
}
