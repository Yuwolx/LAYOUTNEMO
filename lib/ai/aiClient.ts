import type { CreateBlockAIInput, CreateBlockAIOutput, TidySuggestionInput, TidySuggestionResult } from "./types"

// 브라우저에서 호출하는 AI 클라이언트 래퍼. 실제 OpenAI 호출은 /app/api/ai/* 라우트에서 수행.

export async function createBlockWithAI(input: CreateBlockAIInput): Promise<CreateBlockAIOutput> {
  try {
    const response = await fetch("/api/ai/create-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API request failed:", errorText)
      throw new Error("API request failed")
    }

    const aiOutput = (await response.json()) as CreateBlockAIOutput
    return aiOutput
  } catch (error) {
    console.error("AI API Error:", error)
    return getMockBlockCreationOutput(input)
  }
}

export async function getNextTidySuggestion(input: TidySuggestionInput): Promise<TidySuggestionResult> {
  try {
    const response = await fetch("/api/ai/tidy-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API request failed:", errorText)
      throw new Error("API request failed")
    }

    const aiOutput = (await response.json()) as TidySuggestionResult
    return aiOutput
  } catch (error) {
    console.error("AI API Error:", error)
    return getMockTidySuggestion(input)
  }
}

// API 호출 실패 시 UI 가 빈 상태로 멈추지 않도록 쓰는 fallback.

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
    suggestedDueDate: null,
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
        newValue: randomQuestion.type === "urgency" ? "thinking" : null,
        reason: "현재 상태를 점검해보면 좋을 것 같아요.",
      },
    },
    hasMore: true,
  }
}
