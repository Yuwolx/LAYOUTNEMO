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
  /** 외부 링크 URL — 있으면 카드 하단에 링크 아이콘 노출, 클릭 시 새 탭으로 이동 */
  url?: string
  /** 태그 — 있으면 카드 제목 앞에 [태그] 형태로 노출 (예: [LAYOUT] 디자인 작업) */
  tag?: string
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
