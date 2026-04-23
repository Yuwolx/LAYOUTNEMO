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
      ko: "사용 설명서 (먼저 읽어주세요)",
      en: "User Guide (Read me first)",
    },
    description: {
      ko: "이 블럭을 클릭해서 자세히 보세요.\n\n블럭을 만들고, 결로 맥락을 나누고, 공간으로 연결을 표현합니다.",
      en: "Click this block to read the full guide.\n\nCreate blocks, separate contexts with facets, and express connections through space.",
    },
    detailedNotes: {
      ko: `1) 블럭 만들기
오른쪽 위 '새 블럭 만들기'에서 업무를 추가합니다. AI가 켜져 있으면 입력한 내용을 분석해서 제목과 요약을 정리하고, 적합한 결을 추천합니다. AI가 꺼져 있으면 직접 입력해야 합니다.

블럭 생성 시 긴급도(urgent, thinking, lingering, stable)와 마감일 정보를 작성하면, AI가 이를 분석하여 자동으로 블럭의 옵션을 선택합니다. 예: "내일까지 완료해야 할 긴급한 업무"라고 작성하면 긴급도를 'urgent'로, 마감일을 내일로 설정합니다.

2) 결
결은 블럭이 가진 속성 태그입니다. "기획의 결", "개발의 결" 처럼 업무의 맥락을 나누는 기준이에요.

상단바 아래 결 버튼을 누르면 그 결에 속한 블럭만 또렷하게 강조됩니다. 나머지 블럭은 사라지지 않고 흐리게만 표시되어, 전체 맥락은 그대로 둔 채 지금 집중하고 싶은 결만 도드라지게 볼 수 있어요. 칸에 넣어 분류하는 게 아니라, 같은 블럭들을 다른 시선으로 다시 보는 개념입니다.

3) 연결(연관 관계)
블럭을 서로 가까이 두거나 살짝 겹치면 자동으로 연결됩니다. 연결선은 부드러운 곡선으로 나타나며, 연결을 끊으려면 선을 클릭하세요.

4) AI 보조
헤더의 'AI 보조' 버튼을 클릭해서 AI를 켜거나 끌 수 있습니다. AI가 꺼져 있으면 '정리하기' 기능은 사용할 수 없습니다.

5) 정리하기(체크포인트)
정리하기는 자동 정리가 아니라 상태 점검용 체크포인트입니다. AI는 한 번에 하나씩 제안을 보여주고, 수락한 변경만 적용됩니다.

6) 캔버스 전환
로고 옆의 캔버스 이름 버튼을 클릭하면 여러 작업 공간을 만들고 전환할 수 있습니다. 각 캔버스는 독립적인 블럭과 결을 가집니다. (단축키: Cmd/Ctrl + K)

7) 시급도 표시
블럭의 그림자 색상으로 머릿속에서 차지하는 무게를 표현합니다. (블럭 크기는 모두 동일)
• 안정 (회색): 천천히 진행해도 되는 일
• 생각 중 (파란색): 아직 구체화되지 않은 아이디어
• 머물러 있음 (노란색): 미루고 있지만 언젠가 해야 할 일
• 시급 (주황색): 즉시 처리가 필요한 일

8) 완료 표시
블럭 상세 정보에서 '완료' 체크박스를 클릭하면 블럭을 완료 상태로 표시할 수 있습니다. 또한 블럭을 우측으로 드래그해 화면 오른쪽 하단의 '완료된 업무' 영역으로 이동시키면 자동으로 완료 처리됩니다. 완료된 블럭은 흐리게 표시됩니다.

9) 휴지통
삭제한 블럭은 최대 10개까지 휴지통에 보관됩니다. 헤더의 휴지통 아이콘을 클릭해 삭제된 블럭을 확인하고 복구할 수 있습니다.

10) 마감일 설정
블럭 상세 정보에서 마감일을 추가할 수 있습니다. 마감일이 설정된 블럭은 우측 상단에 날짜가 표시됩니다.

11) 결 커스터마이징
'결 관리' 버튼을 클릭해 새로운 결을 추가하거나 기존 결을 수정, 삭제할 수 있습니다. 각 결은 고유의 색상을 가집니다.`,
      en: `1) Creating Blocks
Use "Create Block" at the top right to add tasks. When AI Assist is on, it analyzes your input, drafts a title and summary, and suggests a fitting facet. When AI is off, you fill in everything manually.

When creating a block, writing urgency (urgent, thinking, lingering, stable) or a due date in natural language lets AI auto-pick the block's options. Example: "an urgent task due tomorrow" → urgency = urgent, due date = tomorrow.

2) Facets
A facet is a tag a block carries. Like "the Planning facet" or "the Development facet", it is a way of separating the context of your work.

Click a facet button below the top bar and only blocks of that facet are brought into sharp focus. The others do not disappear — they stay in the background, dimmed. The whole context stays, while the facet you want to concentrate on pops forward. It is not a folder; it is a different way of looking at the same blocks.

3) Connections
Place two blocks close together (or slightly overlapping) and they connect automatically. The line is drawn as a smooth curve. To break a connection, click the line.

4) AI Assist
Click the "AI Assist" button in the header to toggle AI on or off. With AI off, the "Reflect" feature is disabled.

5) Reflect (Checkpoint)
Reflect is a checkpoint for self-examination, not automatic reorganization. AI shows one suggestion at a time, and only changes you accept are applied.

6) Switching Canvases
Click the canvas name next to the logo to create or switch between multiple workspaces. Each canvas has its own independent blocks and facets. (Shortcut: Cmd/Ctrl + K)

7) Urgency Display
A block's shadow color shows how much it weighs on your mind. (All blocks share the same size.)
• Stable (gray): Something you can take your time with.
• Thinking (blue): An idea still being shaped.
• Lingering (yellow): Something you keep pushing back but eventually need to do.
• Urgent (orange): Needs immediate action.

8) Completing Blocks
In the block details, tick "Complete" to mark a block as done. You can also drag a block to the "Completed Tasks" zone at the bottom-right of the canvas to auto-complete it. Completed blocks are dimmed.

9) Trash
Deleted blocks are kept in the trash (up to 10). Click the trash icon in the header to review and restore them.

10) Due Dates
You can add a due date in the block details. Blocks with a due date show the date in the top right.

11) Customizing Facets
Click "Manage Facets" to add, rename, or remove facets. Each facet has its own color.`,
    },
  },
  "shortcuts-guide": {
    title: { ko: "단축키 안내", en: "Keyboard Shortcuts" },
    description: {
      ko: "자주 사용하는 단축키를 확인하세요",
      en: "Frequently used keyboard shortcuts",
    },
    detailedNotes: {
      ko: `단축키 목록:

• Cmd/Ctrl + N: 새 블럭 만들기
• Cmd/Ctrl + Z: 되돌리기
• Cmd/Ctrl + Shift + Z: 재실행
• Cmd/Ctrl + Y: 재실행 (대체)
• Cmd/Ctrl + K: 캔버스 선택
• Alt/Option + 클릭: 블럭 복사
• Esc: 다이얼로그 닫기

되돌리기 & 재실행:
헤더의 화살표 아이콘(↶↷)으로도 조작할 수 있습니다. 좌측 화살표는 되돌리기, 우측 화살표는 재실행입니다.

블럭 복사:
Alt 또는 Option 키를 누른 상태에서 블럭을 클릭하면 해당 블럭이 복사됩니다. 복사된 블럭은 원본 옆에 생성되며, 모든 정보(긴급도, 마감일, 메모 등)가 함께 복사됩니다.`,
      en: `Shortcut list:

• Cmd/Ctrl + N: Create a new block
• Cmd/Ctrl + Z: Undo
• Cmd/Ctrl + Shift + Z: Redo
• Cmd/Ctrl + Y: Redo (alternative)
• Cmd/Ctrl + K: Select canvas
• Alt/Option + Click: Duplicate a block
• Esc: Close a dialog

Undo & Redo:
You can also use the arrow icons (↶↷) in the header. The left arrow is Undo, the right is Redo.

Duplicating Blocks:
Hold Alt (or Option on Mac) and click a block to duplicate it. The copy appears next to the original with all its info (urgency, due date, notes, etc.).`,
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
