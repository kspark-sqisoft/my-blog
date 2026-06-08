# 하네스 템플릿 비교 — walkinglabs 가이드 대비 my-blog

> 출처: <https://walkinglabs.github.io/learn-harness-engineering/ko/resources/templates/>
> 작성일: 2026-06-08 · 비교 시점 진행: 95/99 done, 4 todo(comment-moderation)
> 목적: "Harness Engineering" 템플릿 8종이 우리 프로젝트에 얼마나 반영돼 있는지 1회 스냅샷.
> 갱신 주기: 템플릿이 바뀌거나 하네스를 크게 손볼 때만.

## 요약

핵심 4종(루트 지침·init·feature 추적·진행 로그)은 **템플릿을 초과 반영**한다(훅·슬래시명령으로 강제).
품질 추적용 2종(평가자 루브릭·품질 문서)은 **이 비교를 계기로 신규 추가**했다.
나머지(클린상태 체크리스트)는 별도 파일 대신 **Stop 훅 + `/finish` 절차**로 대체돼 있다.

## 템플릿 8종 매핑

| 템플릿 파일 | 반영 | my-blog 에서의 형태 | 비고 |
|---|---|---|---|
| **AGENTS.md / CLAUDE.md** | ✅ 초과 | 루트 `CLAUDE.md` + `packages/api`·`packages/web` 3중. 10-Phase·절대규칙 10개·훅 연동 | 템플릿의 "운영 규칙 + 완료 정의" 를 크게 확장 |
| **init.sh** | ✅ 초과 | 도구확인→의존성→`@blog/shared` 빌드→DB healthy 대기→Prisma migrate→test DB 준비 | 템플릿 3변수(INSTALL/VERIFY/START)보다 견고. 실패 시 비0 종료(기준선 우선 수정) |
| **feature_list.json** | ✅ 충족 | `id·priority·deps·status·acceptance` 보유, `/finish` 가 status 갱신 | status 값은 한글화 정책상 `todo/in_progress/done`(템플릿은 `not_started/.../passing`) — **의도된 차이** |
| **claude-progress.md** | ✅ 변형 | 단일 파일 대신 **`docs/handoff/{YYYY-MM-DD}-{ID}.md`** 세션별 누적(80여 개) | "현재 검증된 상태" 단일 뷰는 없음 → SessionStart 훅이 최신 handoff + 진행 카운트를 주입해 보완 |
| **session-handoff.md** | ✅ 변형 | 위 handoff 가 그 역할. `/finish` 6단계가 6개 섹션을 자동 작성 | "한 일/TDD/결정/이슈/다음/증거" 구조 |
| **clean-state-checklist.md** | ⚠️ 훅 대체 | 파일 없음. Stop 훅(검증없는-done 차단·`review-gate`) + `/finish` 절차가 동일 보장 | 체크리스트 의도(시작경로·검증경로·진행로그·허위 passing 없음)는 자동 강제됨 |
| **evaluator-rubric.md** | ✅ 신규 | `docs/evaluator-rubric.md` 추가. 6차원 0–2점 채점 | `/finish` verifier 패스에 연동(아래) |
| **quality-document.md** | ✅ 신규 | `docs/quality-document.md` 추가. 도메인 4 + 레이어 3 등급 스냅샷 | 하네스 단순화·기술부채 가시화용 |

## 우리가 템플릿보다 더 가진 것 (참고)

템플릿은 "최소 출발 세트"다. my-blog 는 그 위에 다음을 얹어 운영 중이다:

- **10-Phase 기능 워크플로우** + 슬래시 명령(`/prd`·`/bc`·`/trd`·`/adr`·`/tasks`·`/implement`·`/finish`)
- **훅 강제**: TDD 가드(UserPromptSubmit) → 자동 포맷·docker/shared 센서(PostToolUse) → 검증없는-done 차단·review-gate(Stop)
- **독립 서브에이전트 패스**(저자 편향 차단): `verifier`·`code-reviewer`·`plan-critic`·`debugger`
- **DDD 산출물**: `docs/glossary.md`·`docs/bounded-contexts.md`·`docs/adr/`(21개)·PRD/TRD
- **절대 규칙 10개**(TDD·테스트DB 격리·shared 순수성·쓰기-읽기 왕복 검증 등)

## 갭과 조치

| 갭 | 상태 | 조치 |
|---|---|---|
| 세션 산출물 6차원 채점 부재 | 해소 | `evaluator-rubric.md` 신설 + `/finish` 7.5단계로 연동 |
| 코드베이스 건전성 시계열 추적 부재 | 해소(초판) | `quality-document.md` 신설(2026-06-08 스냅샷) |
| "현재 검증된 상태" 단일 뷰 부재 | 보완됨 | handoff 누적 + SessionStart 주입으로 대체(단일 파일 도입은 보류 — 중복) |
| status 값 명칭 불일치 | 유지 | 한글화 정책상 의도된 차이. 변경하지 않음 |
