import { NextResponse } from "next/server"

function analyzeBlockClusters(blocks: any[], zones: any[]) {
  const zoneClusters: Record<string, any[]> = {}
  const urgencyClusters: Record<string, any[]> = {}

  blocks.forEach((b) => {
    if (!zoneClusters[b.zone]) zoneClusters[b.zone] = []
    zoneClusters[b.zone].push(b)

    if (!urgencyClusters[b.urgency]) urgencyClusters[b.urgency] = []
    urgencyClusters[b.urgency].push(b)
  })

  // 영역별 분산도 계산 (같은 영역 블록들이 얼마나 퍼져있는지)
  const zoneDispersion: Record<string, number> = {}
  Object.entries(zoneClusters).forEach(([zoneId, zoneBlocks]) => {
    if (zoneBlocks.length < 2) {
      zoneDispersion[zoneId] = 0
      return
    }

    // 중심점 계산
    const centerX = zoneBlocks.reduce((sum, b) => sum + b.x, 0) / zoneBlocks.length
    const centerY = zoneBlocks.reduce((sum, b) => sum + b.y, 0) / zoneBlocks.length

    // 평균 거리 계산
    const avgDistance =
      zoneBlocks.reduce((sum, b) => {
        return sum + Math.sqrt(Math.pow(b.x - centerX, 2) + Math.pow(b.y - centerY, 2))
      }, 0) / zoneBlocks.length

    zoneDispersion[zoneId] = Math.round(avgDistance)
  })

  return { zoneClusters, urgencyClusters, zoneDispersion }
}

function calculateBlockSimilarity(block1: any, block2: any): number {
  let similarity = 0

  // 제목 유사도 (간단한 키워드 기반)
  const words1 = block1.title.toLowerCase().split(/\s+/)
  const words2 = block2.title.toLowerCase().split(/\s+/)
  const commonWords = words1.filter((w: string) => words2.includes(w))
  if (commonWords.length > 0) similarity += 30

  // 영역 동일
  if (block1.zone === block2.zone) similarity += 20

  // 시급도 동일
  if (block1.urgency === block2.urgency) similarity += 10

  // 거리 기반 (가까울수록 높은 점수)
  const distance = Math.sqrt(Math.pow(block1.x - block2.x, 2) + Math.pow(block1.y - block2.y, 2))
  const proximityScore = Math.max(0, 40 - distance / 20)
  similarity += proximityScore

  return similarity
}

export async function POST(req: Request) {
  try {
    const input = await req.json()
    const { blocks, zones } = input

    const regularBlocks = blocks.filter((b: any) => !b.isGuide)

    if (regularBlocks.length === 0) {
      return NextResponse.json({
        stage: { stage: "complete", message: "분석할 블럭이 없습니다", progress: 100 },
        analysis: null,
        suggestions: [],
      })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured")
    }

    const { zoneClusters, urgencyClusters, zoneDispersion } = analyzeBlockClusters(regularBlocks, zones)

    // 연결 누락 찾기
    const potentialConnections: Array<{ block1: string; block2: string; similarity: number }> = []
    for (let i = 0; i < regularBlocks.length; i++) {
      for (let j = i + 1; j < regularBlocks.length; j++) {
        const b1 = regularBlocks[i]
        const b2 = regularBlocks[j]

        // 이미 연결되어 있으면 스킵
        if (b1.relatedTo?.includes(b2.id) || b2.relatedTo?.includes(b1.id)) continue

        const similarity = calculateBlockSimilarity(b1, b2)
        if (similarity > 50) {
          potentialConnections.push({
            block1: b1.id,
            block2: b2.id,
            similarity: Math.round(similarity),
          })
        }
      }
    }

    // 우선순위순으로 정렬
    potentialConnections.sort((a, b) => b.similarity - a.similarity)

    const blockSummary = regularBlocks.map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description || "",
      zone: b.zone,
      urgency: b.urgency,
      dueDate: b.dueDate || null,
      position: { x: b.x, y: b.y },
      connections: b.relatedTo || [],
      isCompleted: b.isCompleted || false,
    }))

    const zoneMap = zones.reduce((acc: any, z: any) => {
      acc[z.id] = z.label
      return acc
    }, {})

    const prompt = `
너는 LAYOUT의 고급 작업 공간 분석 AI다.
깊이 있는 분석으로 의미 있고 실행 가능한 개선을 제안하라.

**중요**: 사용설명서와 단축키 안내 같은 가이드 블럭은 이미 제외되었습니다.
아래 블럭들은 모두 사용자의 실제 업무 블럭입니다.

## 현재 작업 공간 상태

### 블럭 정보 (총 ${regularBlocks.length}개)
${blockSummary
  .map(
    (b: any, idx: number) => `
${idx + 1}. [${b.id}] "${b.title}"
   - 영역: ${zoneMap[b.zone] || b.zone}
   - 시급도: ${b.urgency}
   - 위치: (${Math.round(b.position.x)}, ${Math.round(b.position.y)})
   - 설명: ${b.description || "없음"}
   - 기한: ${b.dueDate || "없음"}
   - 연결: ${b.connections.length > 0 ? b.connections.join(", ") : "없음"}
   - 완료: ${b.isCompleted ? "예" : "아니오"}
`,
  )
  .join("\n")}

### 사전 분석 결과
**영역별 분산도** (높을수록 블럭들이 흩어져 있음):
${Object.entries(zoneDispersion)
  .map(([zone, dist]) => `- ${zoneMap[zone]}: ${dist}px`)
  .join("\n")}

**발견된 잠재적 연결** (상위 ${Math.min(5, potentialConnections.length)}개):
${potentialConnections
  .slice(0, 5)
  .map((c, idx) => {
    const b1 = regularBlocks.find((b: any) => b.id === c.block1)
    const b2 = regularBlocks.find((b: any) => b.id === c.block2)
    return `${idx + 1}. "${b1?.title}" ↔ "${b2?.title}" (유사도: ${c.similarity}%)`
  })
  .join("\n")}

### 사용 가능한 영역
${zones.map((z: any) => `- ${z.id}: ${z.label}`).join("\n")}

## 분석 프레임워크

### 1단계: 공간 이해
- 캔버스 크기: 약 1920x940px (가로x세로)
- 왼쪽 상단: 가이드 블럭들이 있음 (120~540, 120~680 영역은 완전히 피할 것)
- 사용자 블럭은 x: 650 이상부터 배치 권장
- 완료된 블럭은 오른쪽 하단에 자동 배치됨

### 2단계: 위치 최적화 원칙 (수정됨 - 넓은 간격)
- **같은 영역 블럭 클러스터링**: 같은 영역의 블럭들은 250~500px 거리 내에 배치
  - 너무 가깝지 않게! 최소 200px은 떨어뜨릴 것
  - 같은 영역이라도 여유있게 배치
- **연결된 블럭 근접 배치**: 연결된 블럭들은 300~600px 이내로
  - 붙여놓지 말고 적당한 거리 유지
- **시급도 우선순위**: urgent/lingering 블럭은 화면 중앙 상단(y: 150~450)에 배치
- **공간 효율**: 블럭 간 최소 150px 간격 유지 (중요!), 겹침 절대 방지
- **가시성**: 중요한 블럭이 화면 밖으로 나가지 않도록
- **여유 공간**: 답답하지 않게 블럭들 사이에 충분한 공간 확보

### 3단계: 구체적 위치 계산
위치 제안 시 다음을 고려:
1. 같은 영역의 다른 블럭 위치 (중심점에서 200~400px 반경)
2. 연결된 블럭과의 거리 (300~600px)
3. 시급도에 따른 y축 우선순위
4. 기존 블럭과의 겹침 여부 (최소 150px 간격)
5. 화면 경계 (x: 650~1800, y: 120~850)
6. **절대 가이드 영역(x < 600 또는 y < 700)에 배치하지 말 것**

### 4단계: 패턴 발견
- **분산 문제**: 같은 영역 블럭들이 700px 이상 떨어짐
- **고립 블럭**: 연결이 없거나 관련 블럭과 멀리 떨어짐
- **영역 불일치**: 내용이 다른 영역에 더 적합
- **시급도 역전**: urgent인데 화면 하단에 있거나, 기한 임박인데 stable
- **가이드 침범**: 블럭이 가이드 영역에 있음

### 5단계: 우선순위 결정
- **High**: 위치가 크게 잘못되어 작업 흐름 방해, 가이드와 겹침
- **Medium**: 개선 여지가 있으나 즉각적 문제는 아님
- **Low**: 선택적 개선, 미세 조정

## 제안 타입 및 예시

### position (위치 최적화) ← 가장 중요!
이런 경우에 제안:
- 같은 영역 블럭들이 700px 이상 떨어져 있음
- 연결된 블럭들이 600px 이상 떨어져 있음
- urgent/lingering 블럭이 화면 하단(y > 650)에 있음
- 블럭이 가이드 영역(x < 600 또는 y < 700)에 있음
- 블럭들이 너무 밀집되어 있음 (150px 이내)

변경 예시 (x, y를 모두 제안, 넉넉한 간격):
{
  "blockId": "block-2",
  "field": "x",
  "currentValue": 1200,
  "suggestedValue": 750,
  "reason": "같은 기획 영역의 다른 블럭들이 x: 700~900 사이에 있어요. 근처로 이동하되 적당한 간격을 두면 관련 업무를 한눈에 볼 수 있습니다"
},
{
  "blockId": "block-2",
  "field": "y",
  "currentValue": 600,
  "suggestedValue": 200,
  "reason": "시급한 블럭이라서 화면 상단으로 올리면 더 잘 보여요"
}

### connection (연결 제안)
이런 경우에 제안:
- 제목/내용에서 명확한 관련성 (같은 프로젝트, 순차 업무 등)
- 유사도 60% 이상
- 같은 영역에 있고 적당한 거리

### zone (영역 재배치)
이런 경우에 제안:
- 제목/설명이 현재 영역과 명확히 불일치
- 다른 영역이 훨씬 더 적합

### urgency (시급도 조정)
이런 경우에 제안:
- 기한이 3일 이내인데 stable/normal
- "급", "빨리" 키워드가 있는데 낮은 시급도

## 출력 형식 (JSON)
{
  "analysis": {
    "totalBlocks": ${regularBlocks.length},
    "completedBlocks": ${regularBlocks.filter((b: any) => b.isCompleted).length},
    "zoneDistribution": {"planning": 3, "development": 2, ...},
    "connectionRate": 0.4,
    "dispersedZones": ["planning", "development"],
    "isolatedBlocks": ["block-3"],
    "overallHealth": "good" | "needs_attention" | "critical",
    "insight": "전체적인 공간 구성과 개선 방향을 2-3문장으로"
  },
  "suggestions": [
    {
      "id": "suggestion-1",
      "type": "position" | "connection" | "urgency" | "zone",
      "priority": "high" | "medium" | "low",
      "blockIds": ["관련 블럭 ID들"],
      "question": "사용자에게 던질 질문 (친근한 반말, 구체적으로)",
      "changes": [
        {
          "blockId": "block-id",
          "field": "x" | "y" | "relatedTo" | "zone" | "urgency",
          "currentValue": 현재값,
          "suggestedValue": 제안값,
          "reason": "이 변경이 왜 도움이 되는지 구체적 설명"
        }
      ]
    }
  ]
}

## 중요 원칙
1. **위치 최적화 우선**: 이번 분석의 핵심은 공간 재배치
2. **구체적 좌표**: x, y 값을 정확히 계산해서 제안
3. **가이드 영역 완전 회피**: x < 600 또는 y < 700 영역은 절대 사용 금지
4. **넓은 클러스터링**: 같은 영역 블럭들을 250~500px 거리로 묶되, 최소 150px은 띄우기
5. **우선순위 명확**: 가이드 침범 > 위치 문제 > 연결 > 기타
6. **최대 8개 제안**: 너무 많으면 피로도 증가
7. **답답하지 않게**: 블럭들을 너무 가깝게 붙이지 말 것!

제안은 우선순위 높은 순서로 정렬하라.
위치 제안이 가장 많아야 한다.
`.trim()

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
              "You are an expert workspace analyst specializing in spatial organization and cognitive ergonomics. You excel at optimizing block positions to create intuitive, efficient layouts that minimize cognitive load and maximize workflow clarity.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("OpenAI API Error:", error)
      throw new Error(`OpenAI API failed: ${response.status}`)
    }

    const data = await response.json()
    const aiOutput = JSON.parse(data.choices[0].message.content)

    return NextResponse.json({
      stage: { stage: "suggestions", message: "분석 완료", progress: 100 },
      analysis: aiOutput.analysis,
      suggestions: aiOutput.suggestions || [],
      currentSuggestionIndex: 0,
    })
  } catch (error) {
    console.error("Comprehensive tidy error:", error)
    return NextResponse.json({ error: "분석 중 오류가 발생했습니다." }, { status: 500 })
  }
}
