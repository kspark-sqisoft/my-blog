    my-blog	-	Claude	Code	운영	매뉴얼

## 저장소 구조 (모노레포)- packages/api — NestJS 10 + Prisma + PostgreSQL (포트 3001)- packages/web — React 18 + Vite + Tailwind + TanStack Query (포트 5173)- packages/shared — API 타입과 Zod 스키마 공유

각 패키지마다 자체 CLAUDE.md 가 있다. 해당 패키지 작업 시 그것을 먼저 읽어라.

## 패키지 매니저

pnpm 만 사용 (npm·yarn 금지). 패키지 추가는 `pnpm --filter api add lodash` 형식.

> Docker dev 중 의존성을 추가했다면 컨테이너 익명 node_modules 갱신 필요:
> `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes`
> (자세한 함정·해결은 `docs/harness.md` "운영 함정 & 해결" 참고)

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
`docs/handoff/{날짜}-{ID}.md` 작성 → `feat(...): ... (refs {ID})` commit.
검증이 하나라도 실패하면 status 는 todo 그대로 두고 멈춘다. **검증 없이 done 으로 바꾸지 않는다(Stop 훅이 차단).**

## 슬래시 명령 (각 Phase에 대응)- `/glossary	{용어}` — 유비쿼터스 언어에 용어 추가·검토 (Phase 1)- `/prd	{기능명}`

— PRD 작성 (Phase 2)- `/bc	{기능명}` - `/trd	{기능명}` - `/adr	{제목}`
— Bounded Context 영향 분석 (Phase 3)
— TRD 작성 (Phase 4)
— 새 ADR 생성 (Phase 5)- `/tasks	{기능명}` — 태스크 분해 (Phase 6)- `/implement	{ID}` — TDD로 태스크 단위 구현 (Phase 7+8)

## 참고 자료 (필요 시에만 읽기)- 유비쿼터스 언어: docs/glossary.md- Bounded Context: docs/bounded-contexts.md- API 패키지 상세: packages/api/CLAUDE.md- Web 패키지 상세: packages/web/CLAUDE.md- 직전 세션 인계: docs/handoff/ 의 최신 파일
