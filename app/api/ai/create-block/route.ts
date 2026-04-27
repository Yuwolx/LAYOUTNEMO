import { NextResponse } from "next/server"
import { CREATE_BLOCK_PROMPT } from "@/lib/ai/prompts"
import type { CreateBlockAIInput } from "@/lib/ai/types"
import { createBlockAIOutputSchema, type AIErrorPayload } from "@/lib/ai/schemas"

const errorResponse = (code: AIErrorPayload["code"], message: string, status: number) =>
  NextResponse.json<{ error: AIErrorPayload }>({ error: { code, message } }, { status })

export async function POST(req: Request) {
  let input: CreateBlockAIInput
  try {
    input = await req.json()
  } catch {
    return errorResponse("invalid_response", "Request body is not valid JSON.", 400)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return errorResponse(
      "missing_api_key",
      "OPENAI_API_KEY is not configured on the server.",
      503,
    )
  }

  const today = new Date().toISOString().split("T")[0]
  const areaList = input.zones.map((z) => z.label).join(", ")
  const language = input.language ?? "ko"

  const prompt = CREATE_BLOCK_PROMPT.replace("{USER_INPUT}", input.userInput)
    .replace("{TODAY_DATE}", today)
    .replace("{AREA_LIST}", areaList)

  const languageDirective =
    language === "en"
      ? "Write all text fields (title, summary, zoneReason) in English. Do not use Korean in the response."
      : "title, summary, zoneReason 필드는 모두 한국어로 작성하라."

  let response: Response
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
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
              "You are a helpful assistant that analyzes user input and extracts structured task information. Only fill in information that is explicitly present in the input. " +
              languageDirective,
          },
          {
            role: "user",
            content: prompt + "\n\n" + languageDirective,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })
  } catch (err) {
    console.error("OpenAI fetch failed:", err)
    return errorResponse("upstream_error", "Could not reach OpenAI.", 502)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    console.error("OpenAI API Error:", response.status, text)
    return errorResponse(
      "upstream_error",
      `OpenAI returned ${response.status}.`,
      502,
    )
  }

  let raw: unknown
  try {
    const data = await response.json()
    raw = JSON.parse(data.choices?.[0]?.message?.content ?? "")
  } catch (err) {
    console.error("AI response not valid JSON:", err)
    return errorResponse("invalid_response", "AI response was not valid JSON.", 502)
  }

  const parsed = createBlockAIOutputSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("AI response failed schema validation:", parsed.error.format())
    return errorResponse(
      "invalid_response",
      "AI response did not match the expected shape.",
      502,
    )
  }

  // suggestedZone 가 zone label 일 수도, id 일 수도 있어 정규화 — id 형태로 통일.
  const matchedZone =
    input.zones.find((z) => z.id === parsed.data.suggestedZone) ??
    input.zones.find((z) => z.label === parsed.data.suggestedZone) ??
    input.zones[0]

  return NextResponse.json({
    ...parsed.data,
    suggestedZone: matchedZone?.id ?? parsed.data.suggestedZone,
  })
}
