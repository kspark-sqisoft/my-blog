    my-blog	-	Claude	Code	운영	매뉴얼

## 저장소 구조 (모노레포)- packages/api — NestJS 10 + Prisma + PostgreSQL (포트 3001)- packages/web — React 18 + Vite + Tailwind + TanStack Query (포트 5173)- packages/shared — API 타입과 Zod 스키마 공유

각 패키지마다 자체 CLAUDE.md 가 있다. 해당 패키지 작업 시 그것을 먼저 읽어라.

## API 엔드포인트 (자동 관리)

<!-- AUTO-MANAGED:endpoints:start — 직접 수정 금지. 코드(packages/api/src/**/*.controller.ts) 기준이며 엔드포인트 변경 시 /finish 가 이 구간을 갱신한다. (가이드 12.7) -->
> NestJS 전역 prefix `api` (`packages/api/src/common/app-setup.ts`). 업로드 정적 파일만 prefix 제외(`/uploads/*`).

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| GET | `/api/` | 헬스/루트 | 공개 |
| POST | `/api/auth/register` | 회원가입(MEMBER 생성+로그인) | 공개 |
| POST | `/api/auth/login` | 로그인 | 공개 |
| POST | `/api/auth/logout` | 로그아웃 | 공개 |
| GET | `/api/auth/me` | 세션 확인 | 쿠키 |
| PATCH | `/api/auth/me` | 프로필(이름·아바타) 수정 | 로그인 |
| POST | `/api/profile/avatar` | 아바타 이미지 업로드 | 로그인 |
| GET | `/api/posts` | 발행 글 목록(coverImageUrl 포함) | 공개 |
| GET | `/api/posts/:id/related` | 관련 글(태그 겹침 우선) | 공개 |
| GET | `/api/posts/:id` | 발행 글 상세 | 공개 |
| POST | `/api/posts` | 글 생성(초안) | 운영자 |
| PATCH | `/api/posts/:id` | 글 수정 | 운영자 |
| POST | `/api/posts/:id/publish` | 발행 | 운영자 |
| POST | `/api/posts/:id/unpublish` | 발행취소 | 운영자 |
| DELETE | `/api/posts/:id` | 삭제 | 운영자 |
| GET | `/api/admin/posts` | 대시보드 목록(초안 포함) | 운영자 |
| GET | `/api/admin/posts/:id` | 단건(편집 로드) | 운영자 |
| GET | `/api/admin/users` | 사용자 목록 | 운영자(ADMIN) |
| PATCH | `/api/admin/users/:id/role` | 역할 변경 | 운영자(ADMIN) |
| GET | `/api/posts/:postId/comments` | 댓글 목록 | 공개 |
| POST | `/api/posts/:postId/comments` | 댓글/답글 작성 | 공개 |
| POST | `/api/posts/:postId/like` | 좋아요(멱등) | 로그인 |
| DELETE | `/api/posts/:postId/like` | 좋아요 취소(멱등) | 로그인 |
| POST | `/api/posts/:postId/view` | 조회 기록(30분 dedup) | 공개 |
| GET | `/api/tags` | 태그 목록 | 공개 |
| POST | `/api/uploads` | 이미지 업로드 | 운영자 |
| GET | `/feed.xml` | RSS 2.0 피드(발행글, /api prefix 제외) | 공개 |
| GET | `/sitemap.xml` | 사이트맵(발행글·태그·홈, /api prefix 제외) | 공개 |
| GET | `/robots.txt` | robots(사이트맵 위치, /api prefix 제외) | 공개 |
<!-- AUTO-MANAGED:endpoints:end -->

## 패키지 매니저

pnpm 만 사용 (npm·yarn 금지). 패키지 추가는 `pnpm --filter api add lodash` 형식.

> Docker dev 중 의존성을 추가했다면 컨테이너 익명 node_modules 갱신 필요:
> `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes`
> (자세한 함정·해결은 `docs/harness.md` "운영 함정 & 해결" 참고)

## 도커 재빌드 — 언제 필요한가 (하네스가 감지)

dev 스택은 한 번만 `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` 로 띄우면,
**소스(.ts/.tsx)·Prisma 엔티티(→migrate)·DB 데이터 변경은 핫리로드/마이그레이션으로 자동 반영**된다(재시작 불필요).

**재빌드가 필요한 경우는 정해져 있다:**

| 바뀐 것 | 필요한 명령 |
|---|---|
| `package.json` / `pnpm-lock.yaml` (의존성) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes` |
| `Dockerfile` / `docker-compose.yml` / `docker-compose.dev.yml` / `.env` | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` |

이 트리거 파일을 Edit/Write 로 고치면 **PostToolUse 훅 `docker-rebuild-sensor`** 가 감지해 정확한 명령을
알려주고 `.claude/.docker-dirty.json` 에 펜딩을 기록한다(비차단 알림).

**실행은 옵트인이다:**
- 기본: 알림만 한다 → 사용자에게 위 명령을 안내하거나 확인 후 실행.
- `AUTO_DOCKER_REBUILD=1` 로 세션을 시작하면, 턴 종료 시 **Stop 훅 `docker-rebuild-stop`** 이 재빌드를
  자동 수행하도록 유도하고(빌드 로그가 세션에 보임), 성공 후 sentinel 을 지워 다음 종료는 통과시킨다.
- 끄려면 환경변수를 빼거나 `OMC_SKIP_HOOKS` 사용. (배경/설계는 `docs/harness.md` 운영 함정 #6)

## 동시 작업 — 격리 worktree 권장 (하네스가 안내)

여러 세션/작업이 **같은 워킹트리**에서 같은 파일을 동시에 고치면 서로 덮어쓰거나 머지 충돌이 난다.
독립적인 기능을 병렬로 진행할 때는 **격리 worktree**에서 작업한다: `EnterWorktree`(권장) 또는
`bash scripts/worktree-new.sh <name>`. 작업·검증·커밋 후 default 브랜치(`main`)로 머지한다.

- default 브랜치(`main`)의 메인 체크아웃에서 **기능 소스**(`packages/*/src/**`, `prisma/schema.prisma`)를
  편집하면 **PostToolUse 훅 `worktree-guard`** 가 worktree 사용을 **세션당 1회** 권유한다(비차단 — 단발
  핫픽스·문서 수정이면 무시 가능). 별도 브랜치이거나 이미 worktree 안이면 안내하지 않는다.
- worktree 함정: dev Docker 스택은 **메인 디렉터리** 소스를 바인드 마운트하므로 worktree 편집은 핫리로드로
  안 보인다 → worktree 에서는 TDD(jest/vitest)로 검증하고, 브라우저 도그푸딩은 메인에서. db 는 메인 컨테이너
  (5433)를 재사용한다(별도 스택 기동 시 포트 충돌). (배경은 `docs/harness.md` 운영 함정 #7)

## @blog/shared 는 항상 빌드된 상태로 (api 는 dist 를 본다)

api(NestJS·CJS)와 api 의 jest 는 `@blog/shared` 를 **빌드 산출물 `packages/shared/dist`** 로 해석한다
(package.json `require`/`types` → dist). web(Vite·ESM)은 `src` 를 직접 본다. 따라서 shared **소스만**
바뀌고(merge·pull·편집) **dist 를 안 빌드하면 api 컴파일이 깨진다**(`no exported member …` → nest watch
서버 미기동 → vite 프록시 **502**). `dist` 는 gitignore 라 커밋으로 갱신되지 않는다.

하네스가 3중으로 자동 빌드하므로 보통 직접 신경 쓸 필요 없다:
- **dev 컨테이너**: api 기동 명령이 `pnpm --filter @blog/shared run build` 를 먼저 실행(docker-compose.dev.yml).
- **부트스트랩**: `init.sh` 가 매번 shared 를 빌드.
- **세션 중**: `packages/shared/src/**` 편집 시 PostToolUse 훅 `shared-build` 가 자동 재빌드.

수동이 필요하면: `pnpm --filter @blog/shared run build`. (배경은 `docs/harness.md` 운영 함정 #8)

**@blog/shared 런타임 순수성 (절대 규칙 — 함정 #9):** shared 는 **순수 타입 + 손수 작성 상수**만 둔다.
`zod` 같은 **라이브러리 값/스키마를 shared 에 두고 export 하지 말 것**. shared 가 그 값을 export 하면
그것을 import 하는 모든 소비자(특히 **prod api**)가 부팅 시 해당 라이브러리를 강제 `require` 하는데,
shared 는 그 의존을 선언하지 않아 prod 이미지에 없어서 **부팅 크래시(MODULE_NOT_FOUND)** 한다.
dev·CI 단위테스트는 모노레포 호이스팅으로 우연히 통과해 **prod/격리 e2e 에서야 터진다**(2026-06-08 사고).
→ 폼 zod 스키마는 **web 에**(예: `pages/Register.tsx` 처럼 인라인/로컬), 서버 검증은 **api class-validator**.
검증은 각 패키지(ADR-0004). 가드: `pnpm check:shared-purity`(CI quality 잡 게이트 — shared dist 가
선언 안 된 외부 의존을 require 하면 실패).

> **CI/prod 실패 디버깅 — 추측 패치 금지:** 로컬(특히 호이스팅 있는 monorepo)에서 통과해도 prod·CI 는
> 다를 수 있다. CI 실패는 **step 결론·로그(또는 격리 prod 스택 로컬 재현)로 근본원인을 먼저 확정**한 뒤
> 한 번에 하나씩 고친다. (`superpowers:systematic-debugging` 의 "근본원인 없이 수정 금지"와 동일.)

## 데이터 입력 주의 (한글 깨짐)

Windows Git Bash 의 `curl -d '{"title":"한글..."}'` 는 비ASCII 를 깨뜨려 ��� 로 저장된다.
샘플/시드 데이터는 셸 curl 대신 **Node `fetch` 스크립트(UTF-8)** 나 `curl -d @file.json`, 또는 UI 로 입력한다.

## 절대 규칙 (NON-NEGOTIABLE)

1. TypeScript 만 사용. .js 파일 금지
2. 한 번에 한 태스크 단위로만 작업 (docs/tasks/ 의 작업 ID 하나)
3. 검증 통과 (lint + typecheck + test) 전에는 commit 금지
4. 시크릿 절대 commit 금지. .env 파일은 모두 .gitignore
5. API 타입은 packages/shared 에 정의하고 양쪽에서 import (중복 정의 금지)
6. 새 아키텍처 결정은 docs/adr/ 의 다음 번호로 ADR 추가
7. 새 기능 구현은 반드시 실패하는 테스트부터 (TDD)
8. 통합 테스트는 **테스트 DB(blog_test)** 만 사용. 개발 DB(blog)를 건드리지 않는다.
   `DATABASE_URL` 은 jest setup(`src/test-db.setup.ts`, `test/jest-e2e.setup.ts`)이 강제하므로,
   새 spec 에 `DATABASE_URL ??= ...` 같은 자체 기본값을 넣지 말 것. (자세한 배경은 `docs/harness.md`)
9. 파일·정적 리소스(업로드 이미지 등)를 반환하는 기능은 **반환 URL 이 실제 200 + 올바른
   Content-Type 으로 서빙되는지**까지 테스트로 검증한다(쓰기-읽기 왕복). "URL 형식"만 보는 테스트는
   서빙 경로 누락을 못 잡는다. 서빙은 API 정적 서빙 + dev proxy + prod nginx 세 곳이 정합해야 한다.
   (배경/체크리스트는 `docs/harness.md` 운영 함정 #4)
10. **`feature_list.json` 과 `docs/tasks/{feature}.md` 는 항상 동기화한다.** 태스크를
   추가/완료/수정할 때 JSON 의 항목(id·status·completed_at·acceptance)을 바꿨으면, **같은 커밋 안에서**
   사람이 읽는 `docs/tasks/{feature}.md` 의 대응 태스크도 함께 갱신한다. JSON 이 정규 소스이고 .md 는
   미러다 — 한쪽만 바꾸고 커밋하지 않는다(`/finish` 가 이 동기화를 강제한다).

## 10-Phase 워크플로우

새 기능 작업은 항상 이 순서를 따른다: 0. 환경 점검 (init.sh 또는 pnpm install + 헬스체크)

1.      docs/glossary.md	에	새	용어가	있는지	확인·추가	(유비쿼터스	언어)
2.      docs/prd/{기능명}.md	작성	(PRD)
3.      docs/bounded-contexts.md	에	영향	확인·갱신	(도메인	모델링)
4.      docs/trd/{기능명}.md	작성	(TRD)
5.      주요	결정을	docs/adr/	에	분리	(ADR)
6.      docs/tasks/{기능명}.md	작성	(태스크	분해)
7.      태스크	하나씩	TDD로	구현	(Red→Green→Refactor)
8.      E2E를	BDD	시나리오로	(Given-When-Then)
9.      Hooks가	검증	누락을	자동	차단
10. handoff 노트 작성 후 commit + /clear

## 매 세션 첫 5가지 (사용자가 "준비" 라고 말하면 자동 실행 = `/ready`)

사용자가 "준비"(또는 `/ready`)라고 하면, Claude는 묻지 말고 아래를 순서대로 실행한다:

1. `bash init.sh` 실행 → 환경 정상 확인. **실패하면 즉시 멈추고 보고** (다음 단계로 진행 금지)
2. `docs/handoff/` 의 가장 최신 파일 1개 읽기 (직전 세션 컨텍스트)
3. `git log --oneline -10` 으로 최근 변경 확인
4. **`feature_list.json`** 에서 다음 작업 후보 결정 (docs/tasks 의 .md 가 아니라 JSON 기준):
   - `status="todo"` 중에서
   - `deps` 가 모두 `status="done"` 인 것만
   - `priority` 가 가장 높은(숫자가 작은) 것 1개
5. 결정한 태스크의 **ID + acceptance 만** 사용자에게 보여주고 **멈춘다**. 사용자 확인 후에만 구현 시작.

> 진행 상태의 정규 소스는 `feature_list.json` 이다. 사람이 읽는 `docs/tasks/blog-mvp.md` 와 동기화하되,
> "다음 태스크 선택"과 "완료 판정"은 JSON 을 기준으로 한다. 상태 변경은 `/finish` 가 수행한다.

## 태스크 완료 = `/finish {ID}` (직접 status 를 고치지 말 것)

태스크 하나를 끝내면 `/finish {ID}` 한 명령으로 마감한다. 이 명령이 강제하는 순서:
검증 재실행(lint/typecheck/test/e2e) → acceptance 점검 → `feature_list.json` status=done 갱신 →
**`docs/tasks/{feature}.md` 동기화(절대 규칙 #10)** → `docs/handoff/{날짜}-{ID}.md` 작성 →
`feat(...): ... (refs {ID})` commit.
검증이 하나라도 실패하면 status 는 todo 그대로 두고 멈춘다. **검증 없이 done 으로 바꾸지 않는다(Stop 훅이 차단).**
`feature_list.json` 만 바꾸고 `docs/tasks/{feature}.md` 를 빠뜨린 커밋은 만들지 않는다.

## 태스크 1건 작업 루프 (4-Phase) — 가이드 12.7

`/implement {ID}` 로 시작한 태스크 1건은 항상 이 4단계를 돈다(10-Phase 가 "기능" 단위라면, 이건 "태스크" 단위):

1. **이해 + 계획** — acceptance 를 읽고, 영향 파일/Bounded Context 를 먼저 파악(필요하면 plan 모드).
2. **구현 (TDD)** — `tdd-feature` 스킬대로 Red(실패 테스트) → Green(최소 구현) → Refactor.
3. **검증** — lint + typecheck + test (+ e2e). 통과 못 하면 2번으로 되돌아간다(스스로 한 번 리뷰).
4. **문서화/마감** — `/finish {ID}` 로 acceptance 점검 → feature_list done → AUTO-MANAGED/handoff 갱신 → commit.

> 하네스가 이 루프를 강제한다: TDD 가드 훅(UserPromptSubmit) → 자동 포맷/린트 훅(PostToolUse) → 검증-없는-done 차단 훅(Stop) → code-reviewer 미경유 코드 커밋 차단 훅(`review-gate`, Stop). 우회하지 말 것.
>
> 보조 도구(선택): `pnpm gc` — 미사용 코드(knip) + 중복(jscpd) 센서(비차단, CI `gc` job 과 동일).
>
> **서브에이전트(`.claude/agents/`) — 별도 컨텍스트의 독립 패스(저자 편향 차단):**
> - `code-reviewer`(읽기 전용 리뷰) — `/finish`·`/implement` 가 **commit 직전 자동 호출**한다. Critical 이면 commit 차단. 수동으로도 "리뷰해줘"로 호출 가능.
> - `verifier`(읽기 전용 acceptance 검증) — `/finish` 2단계가 자동 위임한다. acceptance 를 증거(테스트·curl)로 PASS/FAIL/UNVERIFIED 판정, 미통과면 done 차단.
> - `plan-critic`(읽기 전용 기획 검토) — `/prd`·`/bc`·`/trd`·`/tasks` 작성 직후 자동 호출한다. 용어·추적성·BC 정합·acceptance 테스트가능성을 검토(작성↔검토 분리). 수동으로 "기획 검토해줘"도 가능.
> - `debugger`(근본원인 디버깅) — 에러·테스트 실패 시 "디버그/왜 안 돼"로 호출. 추측 패치 금지.

## 설계·디자인 보조 — 글로벌 자산을 호출한다 (프로젝트 전용 신규 제작 금지)

기획 인터뷰·검증·리뷰·디버깅을 넘어서는 **범용 설계와 디자인**은 이미 글로벌(OMC·superpowers·gstack)에
잘 갖춰져 있다. **프로젝트 전용 에이전트를 새로 만들지 말고 아래를 호출**한다(중복·관리부담 회피).
Claude 는 해당 단계에서 이들을 자동 인지·제안하고, 사용자도 이 목록으로 무엇이 가능한지 안다.

| 단계 | 호출 대상(이미 설치됨) |
|---|---|
| 아이디어/요구 발산 (코드 전) | `superpowers:brainstorming`, `oh-my-claudecode:deep-interview` |
| 범용 설계/계획·아키텍처 | `oh-my-claudecode:planner` · `architect` · `analyst`, `Plan` 에이전트 |
| 비판적 계획 검토(범용) | `oh-my-claudecode:critic` (※ 기획 산출물 검토는 프로젝트 `plan-critic` 이 담당) |
| UI 시안 탐색/디자인 시스템 | `gstack-design-shotgun`, `gstack-design-consultation`, `gstack-plan-design-review` |
| UI 구현 | `oh-my-claudecode:designer`, `react-best-practices`(스킬) |
| UI 시각 QA/검토 | `gstack-design-review`, `oh-my-claudecode:visual-verdict`, **Playwright MCP**(실제 스크린샷) |

> 디자인 글로벌 도구는 우리 web 규칙(Tailwind·인라인 style 금지·폼은 shared Zod·API 는 `src/api` 훅 경유)을
> 모르므로, 산출물은 그 규칙으로 다시 본다 — 코드 측 규칙 검토는 이미 `code-reviewer` 가 수행한다.
> 프로젝트 전용 에이전트는 "우리 규칙·맥락이 꼭 필요하고 글로벌로 대체 불가"할 때만 추가한다(예: `plan-critic`).

## 슬래시 명령 (각 Phase에 대응)- `/glossary	{용어}` — 유비쿼터스 언어에 용어 추가·검토 (Phase 1)- `/prd	{기능명}`

— PRD 작성 (Phase 2)- `/bc	{기능명}` - `/trd	{기능명}` - `/adr	{제목}`
— Bounded Context 영향 분석 (Phase 3)
— TRD 작성 (Phase 4)
— 새 ADR 생성 (Phase 5)- `/tasks	{기능명}` — 태스크 분해 (Phase 6)- `/implement	{ID}` — TDD로 태스크 단위 구현 (Phase 7+8)

## 참고 자료 (필요 시에만 읽기)- 유비쿼터스 언어: docs/glossary.md- Bounded Context: docs/bounded-contexts.md- API 패키지 상세: packages/api/CLAUDE.md- Web 패키지 상세: packages/web/CLAUDE.md- 직전 세션 인계: docs/handoff/ 의 최신 파일- 하네스 설계/운영 함정: docs/harness.md- 하네스 보강 분석(가이드 대비 갭): docs/harness-gap-analysis.md- 하네스 변경 이력: docs/harness-changelog.md
