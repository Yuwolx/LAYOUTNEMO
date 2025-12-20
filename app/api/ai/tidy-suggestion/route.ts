import { NextResponse } from "next/server"
import { TIDY_SUGGESTION_PROMPT } from "@/lib/ai/prompts"
import type { TidySuggestionInput, TidySuggestionResult } from "@/lib/ai/types"

export async function POST(req: Request) {
  try {
    const input: TidySuggestionInput = await req.json()

    if (input.blocks.length === 0) {
      return NextResponse.json({
        suggestion: null,
        hasMore: false,
      })
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error("[v0] OPENAI_API_KEY is not configured")
      throw new Error("OPENAI_API_KEY is not configured")
    }

    const zonesText =
      input.zones && input.zones.length > 0 ? input.zones.map((z) => z.label).join(", ") : "영역 정보 없음"

    const prompt = TIDY_SUGGESTION_PROMPT.replace("{{BLOCKS}}", JSON.stringify(input.blocks))
      .replace("{{ZONES}}", zonesText)
      .replace("{{PREVIOUS_SUGGESTIONS}}", input.previousSuggestions?.join(", ") || "없음")

    console.log("[v0] Calling OpenAI API for tidy suggestion")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates structured JSON responses.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] OpenAI API Error:", error)
      throw new Error(`OpenAI API failed: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] OpenAI API response received")
    const text = data.choices[0].message.content

    // Parse AI response (expecting JSON format)
    const aiOutput: TidySuggestionResult = JSON.parse(text)

    return NextResponse.json(aiOutput)
  } catch (error) {
    console.error("[v0] AI API Error:", error)
    return NextResponse.json({ error: "AI 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
