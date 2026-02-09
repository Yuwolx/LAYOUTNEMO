---
layout: default
title: Examples
parent: User Guide
---

# Examples

## 1. 개요 (Overview)
LAYOUTNEMO는 시각적 캔버스를 기반으로 한 업무 사고 도구로, 기존의 리스트 및 보드 중심의 도구가 담아내지 못했던 사고의 흐름과 업무 간 관계를 시각적으로 표현할 수 있는 개인 업무 사고 공간을 제공합니다. 이 도구는 업무를 관리하는 것이 아니라, 어떻게 인식하고 있는지를 외부에 드러내는 데 중점을 두고 있습니다. {: .label .label-blue }

## 2. 아키텍처 및 로직 (Architecture & Logic)
LAYOUTNEMO의 아키텍처는 사용자가 사고의 흐름을 자유롭게 표현할 수 있도록 설계되어 있습니다. 주요 컴포넌트는 캔버스, 블럭, 영역으로 구성되며, 사용자는 블럭을 생성하고, 영역을 통해 사고의 맥락을 분리할 수 있습니다. 블럭 간의 관계는 시각적으로 연결되며, 사용자는 이를 통해 사고의 흐름을 명확히 할 수 있습니다.

## 3. 핵심 컴포넌트 분석 (Key Components)

### 3.1 주요 함수/클래스
- **설명**: Canvas 컴포넌트는 블럭과 영역을 관리하며, 사용자가 블럭을 드래그하거나 복사할 수 있는 기능을 제공합니다.
- **상세 명세 (테이블)**:

| 파라미터          | 타입                  | 설명                                   |
|:------------------|:----------------------|:---------------------------------------|
| blocks            | WorkBlock[]           | 현재 캔버스에 표시되는 블럭 목록        |
| zones             | Zone[]                | 현재 캔버스에 정의된 영역 목록          |
| selectedZone      | string \| null        | 선택된 영역의 ID                        |
| showRelationships | boolean               | 블럭 간의 관계선 표시 여부              |
| showCompletedBlocks | boolean             | 완료된 블럭 표시 여부                   |
| onUpdateBlock     | function              | 블럭 업데이트 시 호출되는 함수         |
| onBatchUpdateBlocks | function            | 여러 블럭을 한 번에 업데이트하는 함수  |
| onCopyBlock       | function              | 블럭 복사 시 호출되는 함수             |
| onArchiveBlock    | function              | 블럭 아카이브 시 호출되는 함수         |
| isDarkMode        | boolean               | 다크 모드 활성화 여부                  |
| previewBlock      | Partial<WorkBlock> \| null | 미리보기 블럭 정보                  |

## 4. 사용 예시 (Usage)
LAYOUTNEMO의 사용 예시는 다음과 같습니다. 사용자는 블럭을 생성하고, 영역을 통해 사고의 맥락을 분리하며, 블럭 간의 관계를 시각적으로 연결할 수 있습니다. 예를 들어, "사용자 인터뷰 진행" 블럭을 생성하고, "프로토타입 개발" 블럭과 연결하여 업무의 흐름을 시각적으로 표현할 수 있습니다.

## 5. 설정 (Configuration)
- **환경 변수**:

| 변수명             | 설명                                 |
|:------------------|:-------------------------------------|
| STORAGE_KEY       | 로컬 스토리지에 저장되는 캔버스 키    |
| CURRENT_CANVAS_KEY| 현재 선택된 캔버스의 키               |

LAYOUTNEMO는 사용자가 사고의 흐름을 자유롭게 표현할 수 있도록 다양한 기능을 제공하며, 이는 UX, 데이터 구조, AI 개입 방식 전반에 동일하게 적용되어 있습니다.