    my-blog	-	Claude	Code	운영	매뉴얼

## 저장소 구조 (모노레포)- packages/api — NestJS 10 + Prisma + PostgreSQL (포트 3001)- packages/web — React 18 + Vite + Tailwind + TanStack Query (포트 5173)- packages/shared — API 타입과 Zod 스키마 공유

각 패키지마다 자체 CLAUDE.md 가 있다. 해당 패키지 작업 시 그것을 먼저 읽어라.

## 패키지 매니저

pnpm 만 사용 (npm·yarn 금지). 패키지 추가는 `pnpm	--filter	@blog/api	add	lodash` 형식.

## 절대 규칙 (NON-NEGOTIABLE)

1. TypeScript 만 사용. .js 파일 금지
2. 한 번에 한 태스크 단위로만 작업 (docs/tasks/ 의 작업 ID 하나)
3. 검증 통과 (lint + typecheck + test) 전에는 commit 금지
4. 시크릿 절대 commit 금지. .env 파일은 모두 .gitignore
5. API 타입은 packages/shared 에 정의하고 양쪽에서 import (중복 정의 금지)
6. 새 아키텍처 결정은 docs/adr/ 의 다음 번호로 ADR 추가
7. 새 기능 구현은 반드시 실패하는 테스트부터 (TDD)

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

## 시작 루틴

세션 시작 시 다음 순서로 점검:

1. `docs/handoff/` 의 가장 최신 파일 읽기 (이전 세션이 남긴 컨텍스트)
2. `git	log	--oneline	-10` 으로 최근 변경 확인
3. `docs/tasks/` 에서 status="todo" 중 의존성 충족된 가장 높은 우선순위 1개 선택
4. 무엇을 작업할지 사용자에게 확인 받은 후 시작

## 슬래시 명령 (각 Phase에 대응)- `/glossary	{용어}` — 유비쿼터스 언어에 용어 추가·검토 (Phase 1)- `/prd	{기능명}`

— PRD 작성 (Phase 2)- `/bc	{기능명}` - `/trd	{기능명}` - `/adr	{제목}`
— Bounded Context 영향 분석 (Phase 3)
— TRD 작성 (Phase 4)
— 새 ADR 생성 (Phase 5)- `/tasks	{기능명}` — 태스크 분해 (Phase 6)- `/implement	{ID}` — TDD로 태스크 단위 구현 (Phase 7+8)

## 참고 자료 (필요 시에만 읽기)- 유비쿼터스 언어: docs/glossary.md- Bounded Context: docs/bounded-contexts.md- API 패키지 상세: packages/api/CLAUDE.md- Web 패키지 상세: packages/web/CLAUDE.md- 직전 세션 인계: docs/handoff/ 의 최신 파일
