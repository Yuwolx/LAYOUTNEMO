---
name: blog
description: Update the LAYOUTNEMO dev blog on the gh-pages branch — add a new devlog post, update the roadmap 완료 list, and refresh the devlog index, then commit and push gh-pages. Use whenever the user asks to update the blog, write a devlog, "블로그 업뎃", "개발일지 써", or after shipping a notable feature (the user has a standing reminder to keep the blog current).
---

# 블로그(devlog) 업데이트

블로그는 **gh-pages 브랜치**의 Jekyll 사이트다 (메인 코드 브랜치와 분리). 항상 워크트리로 작업한다.

## 절차

1. **워크트리 생성**: `git worktree add -f "../ln-ghpages" gh-pages`
2. **스타일 파악**: 최신 devlog(`docs/devlog/` 아래 가장 최근 날짜 파일)를 읽어 톤·구조를 맞춘다. 문체는 한국어, "무슨 일이 있었나 → 어떻게 풀었나 → 정리(배운 것)" 흐름. 과장 없이 실제 문제/삽질/결정 위주.
3. **새 글 작성**: `../ln-ghpages/docs/devlog/YYYY-MM-DD-슬러그.md`
   - frontmatter: `layout: post`, `title: "..."`, `parent: Devlog`, `nav_order: <직전 글보다 +1>`, `tags: [...]`
   - 본문 상단에 `{: .no_toc }` 제목 + 한 줄 요약 + TOC details 블록 (기존 글 그대로 복사해 형식 유지)
4. **로드맵 갱신**: `../ln-ghpages/docs/roadmap.md` 의 `## ✅ 완료` 목록에 이번 작업을 `- [x] ... (YYYY-MM-DD)` 로 추가. 예정/진행 항목에서 끝난 게 있으면 이동.
5. **인덱스 갱신**: `../ln-ghpages/docs/devlog/index.md` 의 알맞은 카테고리 표 맨 위에 새 글 링크 행 추가.
6. **커밋 + 푸시**: 워크트리에서 `git add -A && git commit && git push origin gh-pages`.
7. **정리**: `git worktree remove "../ln-ghpages"`.

## 주의

- 날짜는 상대표현 쓰지 말고 실제 날짜로. `nav_order`는 최신이 위로 오게 숫자를 키운다.
- 코드 스니펫은 "문제 → 해결" 2단계로 짧게.
- gh-pages 푸시는 기본 브랜치가 아니라 정책상 막히지 않는다.
