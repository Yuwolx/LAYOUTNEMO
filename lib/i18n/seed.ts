/**
 * 기본 시드 데이터(결, 가이드 블럭, 예시 블럭, 캔버스 이름 등)의 한영 번역 매핑.
 *
 * 원칙
 * - 저장된 데이터는 건드리지 않는다. 렌더링 시점에만 번역을 겹쳐 보여준다.
 * - 사용자가 편집한 경우(=저장된 값이 기본 한국어와 다르면) → 그 값 그대로 표시 (유저의 것).
 *
 * 사용 예:
 *   const label = translateSeedZoneLabel(zone, language)
 */

import type { Language } from "./dictionary"

/** 시드 문자열의 한국어/영문 한 쌍 */
type LocalizedString = { ko: string; en: string }

/** 기본 결(Zone) id → 라벨 한/영 매핑 */
export const SEED_ZONE_LABELS: Record<string, LocalizedString> = {
  planning:    { ko: "기획",   en: "Planning" },
  development: { ko: "개발",   en: "Development" },
  design:      { ko: "디자인", en: "Design" },
  marketing:   { ko: "마케팅", en: "Marketing" },
  daily:       { ko: "일상",   en: "Daily" },
}

/** 기본 캔버스 이름 */
export const SEED_CANVAS_NAMES: Record<string, LocalizedString> = {
  main: { ko: "메인 캔버스", en: "Main Canvas" },
}

/** 가이드 / 예시 블럭의 title, description, detailedNotes 번역. blockId 기준. */
export const SEED_BLOCK_STRINGS: Record<
  string,
  {
    title: LocalizedString
    description: LocalizedString
    detailedNotes?: LocalizedString
  }
> = {
  guide: {
    title: {
      ko: "사용 설명서",
      en: "User Guide",
    },
    description: {
      ko: "블럭을 만들고, 결로 맥락을 나누고, 가까이 두면 자동으로 이어집니다. 클릭하면 전체 사용법을 볼 수 있어요.",
      en: "Create blocks, separate contexts with facets, place them close to auto-connect. Click for the full guide.",
    },
    detailedNotes: {
      ko: `LAYOUTNEMO 는 할 일을 리스트나 보드에 넣지 않고, 캔버스 위에 펼쳐놓는 도구입니다.

1) 블럭 만들기
오른쪽 위 '새 블럭 만들기' 또는 Cmd/Ctrl + N. AI 보조가 켜져 있으면 한 줄만 적어도 제목·요약·결·시급도·태그·링크까지 자동으로 정리해줍니다. 입력에 [태그] 나 https:// 가 있으면 알아서 추출해요. 꺼져 있으면 직접 입력하세요. 내용은 비워둬도 됩니다.

2) AI 자동 반영 (8초)
AI 가 응답한 뒤 8초 동안 손대지 않으면 자동으로 블럭이 생성됩니다. 카운트다운이 보이고, 어디든 클릭하거나 입력하면 즉시 멈춥니다. "취소" 글자도 누를 수 있어요.

3) 결(Facet)
블럭이 속한 큰 맥락입니다. "기획", "개발" 같은 식으로 업무의 결을 나눠요. 상단의 결 버튼을 누르면 그 결의 블럭만 또렷해지고 나머지는 흐려집니다. 칸막이가 아니라 시선의 필터에 가깝습니다. 결 버튼은 드래그해서 순서를 바꿀 수 있어요.

4) 태그 (선택)
같은 결 안에서도 더 세밀한 그룹이 필요할 때 — 예: "기획" 결 안에 LAYOUT / SideProject 가 섞여 있을 때. 블럭 상세 또는 생성 시 태그를 입력하면 카드 위에 [태그] 로 표시됩니다. 정리하기에서 같은 태그 블럭을 가장 강하게 묶어요.

5) 링크 (선택)
블럭에 외부 URL 을 달아두면 카드 본문 아래 우측에 작은 링크 버튼이 보입니다. 클릭하면 새 탭으로 이동.

6) 연결
블럭을 서로 겹쳐놓으면 자동으로 곡선이 이어집니다. 연결을 끊으려면 선을 클릭. Shift 누른 채 다른 블럭에 떨어뜨리면 연결만 만들고 원위치로 돌아옵니다 (연결 토스).

7) 시급도
블럭의 그림자 색으로 머릿속 무게를 표현합니다. 크기는 바뀌지 않습니다.
• 안정 (회색): 천천히 진행
• 생각 중 (파랑): 아직 구체화되지 않음
• 머물러 있음 (노랑): 미루고 있는 일
• 시급 (주황): 즉시 처리 필요

8) 캔버스 이동
스페이스바를 누른 채 마우스로 드래그하면 캔버스 전체가 따라옵니다 (피그마 방식).

9) 갈무리
지금 안 보고 싶은 블럭은 우하단 박스 아이콘으로 드래그해 치워두세요. 다시 꺼내면 원래 자리로 돌아옵니다.

10) AI 보조 / 정리하기
헤더의 'AI 보조' 토글로 켜고 끕니다. AI 가 켜져 있을 때 '정리하기' 버튼으로 캔버스 상태에 대한 제안을 받을 수 있습니다. 우선순위는 같은 태그 → 같은 결 → 내용 유사도 → 위치 순서. 한 번에 하나씩 보여주고, 수락한 변경만 적용됩니다.

11) 캔버스 전환
로고 옆 캔버스 이름을 누르거나 Cmd/Ctrl + K 로 여러 작업 공간을 오갈 수 있습니다. 각 캔버스는 독립적인 블럭과 결을 가집니다.

12) 결 커스터마이징
'결 관리' 버튼에서 결을 추가/수정/삭제할 수 있습니다. 각 결은 고유의 색을 가져요.

13) 휴지통
삭제한 블럭은 최대 10개까지 휴지통에 보관됩니다. 헤더의 휴지통 아이콘에서 복구할 수 있어요.

14) 마감일
블럭 상세에서 마감일을 추가하면 카드 제목 아래에 표시됩니다.`,
      en: `LAYOUTNEMO is a tool for spreading tasks across a canvas instead of stuffing them into lists or boards.

1) Creating Blocks
"Create Block" at the top right, or Cmd/Ctrl + N. With AI Assist on, one line is enough — title, summary, facet, urgency, tag and link are filled in automatically. If your input contains [TAG] or https://, they get extracted. With AI off, fill them in yourself. The description is optional.

2) Auto-apply (8s)
After AI replies, an 8-second countdown starts. If you don't touch anything, the block is created automatically. Click or type anywhere to cancel — there's also a "Cancel" link.

3) Facets
A facet is the broad context a block belongs to — "Planning", "Development" etc. Click a facet button at the top and only blocks of that facet come into focus; the rest dim. Not a partition, more like a lens. Drag the facet buttons to reorder them.

4) Tags (optional)
For finer grouping inside a facet — e.g. "Planning" facet containing both LAYOUT and SideProject blocks. Set a tag in the create dialog or block detail; it appears as [TAG] above the title. Reflect groups same-tag blocks most strongly.

5) Links (optional)
Attach an external URL — a small link button appears below the body, opens in a new tab.

6) Connections
Overlap two blocks to auto-connect. Click a line to disconnect. Shift + drop onto another block makes only the connection and bounces back to the original spot ("connection toss").

7) Urgency
The shadow color reflects mental weight. Size doesn't change.
• Stable (gray): take your time
• Thinking (blue): still taking shape
• Lingering (yellow): keep pushing it back
• Urgent (orange): needs immediate action

8) Canvas Pan
Hold Spacebar and drag to pan the entire canvas (Figma-style).

9) Archive
Drag a block to the bottom-right box icon to set it aside. When restored, it returns to its original spot.

10) AI Assist / Reflect
Toggle "AI Assist" in the header. With AI on, "Reflect" gives suggestions. Priority: same tag → same facet → content similarity → position. One suggestion at a time; only what you accept is applied.

11) Switching Canvases
Click the canvas name next to the logo, or use Cmd/Ctrl + K. Each canvas has its own blocks and facets.

12) Customizing Facets
Use "Manage Facets" to add, rename, or remove facets. Each has its own color.

13) Trash
Deleted blocks are kept (up to 10). Restore from the trash icon in the header.

14) Due Dates
Add a due date from the block details — it shows up under the title.`,
    },
  },
  "shortcuts-guide": {
    title: { ko: "단축키", en: "Shortcuts" },
    description: {
      ko: "캔버스 이동은 스페이스바 + 드래그, 새 블럭은 Cmd/Ctrl + N. 클릭하면 전체 단축키 목록을 볼 수 있어요.",
      en: "Pan with Spacebar + drag, new block with Cmd/Ctrl + N. Click for the full list.",
    },
    detailedNotes: {
      ko: `[캔버스 조작]
• 스페이스바 + 드래그: 캔버스 이동 (피그마 방식)
• Alt/Option + 블럭 클릭: 블럭 복사
• Shift + 블럭 드롭: 연결만 만들고 원위치로 (연결 토스)

[작업]
• Cmd/Ctrl + N: 새 블럭 만들기
• Cmd/Ctrl + Z: 되돌리기
• Cmd/Ctrl + Shift + Z: 다시 실행
• Cmd/Ctrl + Y: 다시 실행 (대체)
• Cmd/Ctrl + K: 캔버스 선택

[다이얼로그]
• Esc: 열려 있는 다이얼로그 닫기
• Enter: 다음 단계 / 확정

[마우스]
• 블럭 드래그: 위치 이동
• 블럭 → 우하단 박스: 갈무리
• 두 블럭을 가까이: 자동 연결
• 연결선 클릭: 연결 끊기

[참고]
헤더의 화살표 ↶↷ 로도 되돌리기/다시 실행이 가능합니다.
텍스트 입력 중에는 Cmd/Ctrl + Z 가 캔버스 되돌리기 대신 일반 텍스트 되돌리기로 동작합니다.`,
      en: `[Canvas]
• Spacebar + drag: pan the canvas (Figma-style)
• Alt/Option + click on a block: duplicate
• Shift + drop a block onto another: connect only and bounce back ("connection toss")

[Actions]
• Cmd/Ctrl + N: new block
• Cmd/Ctrl + Z: undo
• Cmd/Ctrl + Shift + Z: redo
• Cmd/Ctrl + Y: redo (alt)
• Cmd/Ctrl + K: canvas selector

[Dialogs]
• Esc: close any open dialog
• Enter: next step / confirm

[Mouse]
• Drag a block: move it
• Drag a block to the bottom-right box: archive
• Place two blocks close: auto-connect
• Click a connection line: disconnect

[Notes]
The arrow icons ↶↷ in the header also undo/redo.
While typing in a text field, Cmd/Ctrl + Z falls back to regular text undo instead of canvas undo.`,
    },
  },
  "developer-info": {
    title: { ko: "개발자 정보", en: "About the Developer" },
    description: {
      ko: "LAYOUT 서비스 개발자 정보",
      en: "About the developer of LAYOUTNEMO",
    },
    detailedNotes: {
      ko: `개발자 정보

📧 이메일: yuwolxx@gmail.com

👨‍💻 개발자: 권혁준

📅 개발 연도: 2025

이 서비스는 개인의 작업 사고를 공간 객체로 표현하고 외부화하기 위한 AI 보조 사고 공간입니다.`,
      en: `Developer info

📧 Email: yuwolxx@gmail.com

👨‍💻 Developer: Hyukjun Kwon

📅 Year: 2025

LAYOUTNEMO is an AI-assisted thinking space that lets you externalize the structure of your personal work thinking as spatial objects.`,
    },
  },

  // 예시 블럭 5개
  "example-1": {
    title: { ko: "사용자 인터뷰 진행", en: "Conduct user interviews" },
    description: {
      ko: "5명의 잠재 고객과 인터뷰를 진행하고 니즈 파악 및 피드백 수집",
      en: "Interview 5 potential customers to capture their needs and gather feedback",
    },
  },
  "example-2": {
    title: { ko: "프로토타입 개발", en: "Build a prototype" },
    description: {
      ko: "핵심 기능에 대한 MVP 프로토타입 제작 및 테스트 준비",
      en: "Build an MVP prototype for the core feature and prepare for testing",
    },
  },
  "example-3": {
    title: { ko: "마케팅 채널 분석", en: "Marketing channel research" },
    description: {
      ko: "효과적인 마케팅 채널 조사 및 예산 배분 우선순위 선정",
      en: "Research effective marketing channels and decide budget allocation priorities",
    },
  },
  "example-4": {
    title: { ko: "디자인 시스템 구축", en: "Set up a design system" },
    description: {
      ko: "일관된 UI/UX를 위한 컴포넌트 라이브러리와 디자인 가이드라인 작성",
      en: "Build a component library and design guidelines for consistent UI/UX",
    },
  },
  "example-5": {
    title: { ko: "경쟁사 분석 보고서", en: "Competitor analysis report" },
    description: {
      ko: "주요 경쟁사 3곳의 전략, 가격, 포지셔닝 비교 분석",
      en: "Compare strategy, pricing, and positioning across the 3 main competitors",
    },
  },
}

/**
 * 결 라벨을 언어에 맞게 해석.
 * - 시드 결이 아니면 원본 label 그대로.
 * - 시드 결인데 label 이 이미 편집되었으면(= ko 원본과 다르면) 사용자 편집으로 간주하고 원본 그대로.
 */
export function translateSeedZoneLabel(
  zone: { id: string; label: string },
  language: Language,
): string {
  const seed = SEED_ZONE_LABELS[zone.id]
  if (!seed) return zone.label
  if (zone.label !== seed.ko) return zone.label // 사용자 편집 — 건드리지 않음
  return seed[language]
}

/** 시드 블럭의 특정 필드를 언어에 맞게 해석. 사용자가 편집했으면 원본 유지. */
export function translateSeedBlockField(
  block: {
    id: string
    title?: string
    description?: string
    detailedNotes?: string
  },
  field: "title" | "description" | "detailedNotes",
  language: Language,
): string | undefined {
  const seed = SEED_BLOCK_STRINGS[block.id]
  const currentValue = block[field]
  if (!seed) return currentValue
  const pair = seed[field]
  if (!pair) return currentValue
  if (currentValue !== pair.ko) return currentValue // 편집됨
  return pair[language]
}

/** 기본 캔버스 이름 번역 (편집 시 그대로). */
export function translateSeedCanvasName(
  canvas: { id: string; name: string },
  language: Language,
): string {
  const seed = SEED_CANVAS_NAMES[canvas.id]
  if (!seed) return canvas.name
  if (canvas.name !== seed.ko) return canvas.name
  return seed[language]
}
