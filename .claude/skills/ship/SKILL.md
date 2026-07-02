---
name: ship
description: Ship a finished feature branch to master safely — snapshot current master to a release/backup branch first, then merge the feature branch into master and push (triggers Vercel production deploy). Use when the user says "배포", "머지하자", "master에 올려", "ship it", or wants to release finished work to production.
---

# 배포 (feature → master)

master 푸시는 layoutnemo.com 프로덕션 배포를 트리거한다. 되돌리기 어려운 작업이므로 **항상 백업부터** 만든다.

## 절차

1. **QA 먼저** — 아직 검증 안 했으면 `qa` 스킬 순서(tsc/lint/build)를 돌려 통과 확인. 실패하면 배포 중단.
2. **동기화 확인**: `git fetch origin --prune`, 로컬 master == origin/master 인지 확인. 어긋나면 멈추고 알린다.
3. **릴리즈 백업 브랜치**: 현재 master를 그대로 복사해 백업 후 푸시.
   `git branch release/pre-<feature요약> master` → `git push -u origin release/pre-<...>`
   (롤백 지점. 이름은 무엇 직전인지 알 수 있게.)
4. **머지**: `git checkout master` → `git merge --no-ff <feature-branch> -m "..."` (충돌 나면 멈추고 사용자에게 보고).
5. **푸시**: `git push origin master`.
6. **정리 제안**: 머지 끝난 feature 브랜치 삭제 여부를 물어본다 (자동 삭제하지 않음 — 원격 브랜치 삭제는 사용자 확인 필요).

## 주의

- master 직접 푸시는 사용자가 **명시적으로 배포/머지를 지시했을 때만**. 애매하면 확인.
- 원격 브랜치 대량 삭제는 절대 임의로 하지 말고, 지울 목록을 명시해 승인받는다.
- 배포 후: Vercel 반영 + (터치 등) 실기기 테스트가 필요한 작업이면 그 점과 롤백 방법(release 브랜치)을 안내한다.
