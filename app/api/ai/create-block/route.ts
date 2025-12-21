import { NextResponse } from "next/server"
import { CREATE_BLOCK_PROMPT } from "@/lib/ai/prompts"
import type { CreateBlockAIInput, CreateBlockAIOutput } from "@/lib/ai/types"

export async function POST(req: Request) {
  try {
    const input: CreateBlockAIInput = await req.json()

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured")
    }

    const today = new Date().toISOString().split("T")[0]
    const areaList = input.zones.map((z) => z.label).join(", ")

    const prompt = CREATE_BLOCK_PROMPT.replace("{USER_INPUT}", input.userInput)
      .replace("{TODAY_DATE}", today)
      .replace("{AREA_LIST}", areaList)

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
            content:
              "You are a helpful assistant that analyzes user input and extracts structured task information. Only fill in information that is explicitly present in the input.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("OpenAI API Error:", error)
      throw new Error(`OpenAI API failed: ${response.status}`)
    }

    const data = await response.json()
    const text = data.choices[0].message.content

    const aiOutput: CreateBlockAIOutput = JSON.parse(text)

    return NextResponse.json(aiOutput)
  } catch (error) {
    console.error("AI API Error:", error)
    return NextResponse.json({ error: "AI 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
