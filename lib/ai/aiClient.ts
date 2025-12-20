import type { CreateBlockAIInput, CreateBlockAIOutput, TidySuggestionInput, TidySuggestionResult } from "./types"

// ============================================
// AI Integration Guide
// ============================================
//
// GPT API는 반드시 서버 사이드에서 호출해야 합니다.
// API 키를 클라이언트에 노출하면 안됩니다!
//
// 권장 방법:
// 1. /app/api/ai/create-block/route.ts 생성
// 2. /app/api/ai/tidy-suggestion/route.ts 생성
// 3. 서버에서 OpenAI API 호출
// 4. 이 파일의 함수들이 위 API 라우트를 fetch()로 호출
//
// 예시:
// export async function createBlockWithAI(input: CreateBlockAIInput) {
//   const response = await fetch('/api/ai/create-block', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(input)
//   })
//   return response.json()
// }
//
// 서버 사이드 API 라우트 예시 (/app/api/ai/create-block/route.ts):
// import OpenAI from 'openai'
// import { CREATE_BLOCK_PROMPT } from '@/lib/ai/prompts'
//
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY // NEXT_PUBLIC_ 접두사 없이!
// })
//
// export async function POST(req: Request) {
//   const input = await req.json()
//   // OpenAI API 호출 로직
//   // ...
//   return Response.json(result)
// }
//
// ============================================

/**
 * 새 블럭 생성을 위한 AI 제안
 * 서버 사이드 API 라우트를 통해 OpenAI 호출
 */
export async function createBlockWithAI(input: CreateBlockAIInput): Promise<CreateBlockAIOutput> {
  try {
    console.log("[v0] Calling createBlockWithAI API")
    const response = await fetch("/api/ai/create-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] API request failed:", errorText)
      throw new Error("API request failed")
    }

    const aiOutput = (await response.json()) as CreateBlockAIOutput
    console.log("[v0] AI block creation successful")
    return aiOutput
  } catch (error) {
    console.error("[v0] AI API Error:", error)
    // Fallback to mock data on error
    console.log("[v0] Falling back to mock data")
    return getMockBlockCreationOutput(input)
  }
}

/**
 * 정리하기 체크포인트 제안
 * 서버 사이드 API 라우트를 통해 OpenAI 호출
 */
export async function getNextTidySuggestion(input: TidySuggestionInput): Promise<TidySuggestionResult> {
  try {
    const response = await fetch("/api/ai/tidy-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] API request failed:", errorText)
      throw new Error("API request failed")
    }

    const aiOutput = (await response.json()) as TidySuggestionResult
    console.log("[v0] AI tidy suggestion successful")
    return aiOutput
  } catch (error) {
    console.error("[v0] AI API Error:", error)
    // Fallback to mock data on error
    console.log("[v0] Falling back to mock data")
    return getMockTidySuggestion(input)
  }
}

// ============================================
// Mock Data Functions (fallback으로 유지)
// ============================================

function getMockBlockCreationOutput(input: CreateBlockAIInput): CreateBlockAIOutput {
  const words = input.userInput.trim().split(" ")
  const title = words.slice(0, 5).join(" ")
  const summary = input.userInput.length > 50 ? input.userInput.substring(0, 47) + "..." : input.userInput

  const reasons = [
    "최근 이 영역에서 유사한 업무가 있었어요.",
    "이 영역의 다른 업무와 연관성이 있어 보여요.",
    "현재 진행 중인 업무와 같은 맥락으로 보여요.",
  ]

  const suggestedZone = input.zones[Math.floor(Math.random() * input.zones.length)].id

  return {
    title,
    summary,
    suggestedZone,
    zoneReason: reasons[Math.floor(Math.random() * reasons.length)],
    suggestedUrgency: "stable",
  }
}

function getMockTidySuggestion(input: TidySuggestionInput): TidySuggestionResult {
  if (input.blocks.length === 0) {
    return {
      suggestion: null,
      hasMore: false,
    }
  }

  const mockQuestions = [
    {
      type: "position" as const,
      question: "이 블럭의 위치가 지금 사고 흐름과 조금 어긋나 보일 수 있어요. 옮겨볼까요?",
      field: "position",
    },
    {
      type: "urgency" as const,
      question: "오래 움직이지 않은 블럭이 있어요. 멈춘 생각일지도 몰라요.",
      field: "urgency",
    },
    {
      type: "size" as const,
      question: "자주 정리되는 블럭이 있어요. 더 중요하게 다뤄볼까요?",
      field: "size",
    },
  ]

  const randomQuestion = mockQuestions[Math.floor(Math.random() * mockQuestions.length)]
  const randomBlock = input.blocks[Math.floor(Math.random() * input.blocks.length)]

  return {
    suggestion: {
      type: randomQuestion.type,
      blockId: randomBlock.id,
      question: randomQuestion.question,
      proposedChange: {
        field: randomQuestion.field,
        newValue: randomQuestion.type === "urgency" ? "thinking" : {},
        reason: "현재 상태를 점검해보면 좋을 것 같아요.",
      },
    },
    hasMore: true,
  }
}
