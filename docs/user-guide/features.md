---
layout: default
title: Features
parent: User Guide
---

# Features

## 1. 개요 (Overview)
LAYOUTNEMO는 시각적 캔버스를 기반으로 한 업무 사고 도구로, 기존의 리스트나 보드 중심의 업무 관리 도구가 담아내지 못했던 사고의 흐름과 업무 간 관계를 시각적으로 펼쳐놓기 위한 개인 업무 사고 공간을 제공합니다. {: .label .label-blue }

## 2. 아키텍처 및 로직 (Architecture & Logic)
LAYOUTNEMO는 사용자가 업무를 인식하고 연결하는 방식을 시각적으로 표현할 수 있도록 설계되었습니다. 주요 컴포넌트는 캔버스, 블럭, 영역 관리로 구성되어 있으며, 사용자는 자유롭게 블럭을 배치하고 관계를 설정할 수 있습니다. AI는 사용자의 사고 흐름을 방해하지 않도록 제안만 수행하며, 모든 구조적 변화는 사용자의 승인을 필요로 합니다.

## 3. 핵심 컴포넌트 분석 (Key Components)

### 3.1 주요 함수/클래스
- **설명**: LAYOUTNEMO의 주요 컴포넌트는 캔버스, 블럭, 영역 관리로 구성되어 있습니다. 각 컴포넌트는 사용자가 업무를 시각적으로 관리할 수 있도록 다양한 기능을 제공합니다.
- **상세 명세 (테이블)**:

| 파라미터           | 타입               | 설명                                |
|:-------------------|:-------------------|:------------------------------------|
| blocks             | WorkBlock[]        | 사용자 업무 블럭 배열               |
| zones              | Zone[]             | 사용자 정의 영역 배열               |
| selectedZone       | string \| null     | 선택된 영역의 ID                    |
| showRelationships  | boolean            | 블럭 간 관계 표시 여부              |
| onUpdateBlock      | function           | 블럭 업데이트 함수                  |
| onBatchUpdateBlocks| function           | 블럭 일괄 업데이트 함수             |
| onCopyBlock        | function           | 블럭 복사 함수                      |
| onArchiveBlock     | function           | 블럭 아카이브 함수                  |
| isDarkMode         | boolean            | 다크 모드 여부                      |

## 4. 사용 예시 (Usage)
```tsx
<Canvas
  blocks={initialBlocks}
  zones={initialZones}
  selectedZone="planning"
  showRelationships={true}
  onUpdateBlock={handleUpdateBlock}
  onBatchUpdateBlocks={handleBatchUpdateBlocks}
  onCopyBlock={handleCopyBlock}
  onArchiveBlock={handleArchiveBlock}
  isDarkMode={false}
/>
```

## 5. 설정 (Configuration)
- **환경 변수**:

| 변수명                | 설명                            |
|:----------------------|:--------------------------------|
| STORAGE_KEY           | 로컬 스토리지에 캔버스 저장 키  |
| CURRENT_CANVAS_KEY    | 현재 선택된 캔버스의 저장 키    |

LAYOUTNEMO는 사용자가 업무를 시각적으로 관리하고, 사고의 흐름을 자유롭게 표현할 수 있는 환경을 제공합니다. 이를 통해 사용자는 업무를 보다 직관적으로 인식하고, 연결할 수 있습니다.