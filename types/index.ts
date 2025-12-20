export interface WorkBlock {
  id: string
  title: string
  description: string
  x: number
  y: number
  width: number
  height: number
  zone: string
  urgency?: "stable" | "thinking" | "lingering" | "urgent"
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
}

export interface Zone {
  id: string
  label: string
  color: string
}

export interface AIControlBlock extends WorkBlock {
  isAIControl: true
  aiEnabled: boolean
}

export interface Canvas {
  id: string
  name: string
  blocks: WorkBlock[]
  zones: Zone[]
  createdAt: number
  updatedAt: number
}
