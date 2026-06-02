# .claude/commands/implement.md--

description: 태스크 ID 하나를 TDD로 구현한다. Red-Green-Refactor + 검증 + commit까지 자동.
argument-hint: [태스크ID]--
태스크 $ARGUMENTS 를 TDD로 구현하라.
순서:

1. 컨텍스트 적재 - docs/tasks/{기능명}.md 에서 $ARGUMENTS 항목 읽기 - 의존(deps)이 모두 done 인지 확인. 아니면 멈춤 - docs/glossary.md 의 관련 용어 확인 - docs/bounded-contexts.md 에서 해당 Context의 책임 확인 - 관련 ADR (있다면) 읽기
2. 계획 (Plan Mode 진입) - acceptance 를 어떻게 실패 테스트로 변환할지 - 통과시킬 최소 구현이 무엇일지 - 사용자에게 검토 요청
3. RED - 실패 테스트 작성 - acceptance 각 항목을 테스트 케이스로 - 백엔드: test/{domain}.e2e-spec.ts (e2e) 또는 _.spec.ts (단위) - 프론트: e2e/{기능}.spec.ts (BDD 시나리오) 또는 _.test.tsx (Vitest) - 즉시 실행해서 모두 빨갛게 실패하는 출력 보이기
4. GREEN - 최소 구현 - shared 패키지에 영향이 있으면 거기부터 시작 - 백엔드면 service → controller → module 순 - 프론트면 api 훅 → 컴포넌트 → 페이지 순 - 다시 테스트 실행해서 모두 통과 확인
5. REFACTOR - 정리 - 중복 제거, 매직 넘버 추출, 함수 분리 - 매 리팩토링 후 테스트 재실행
6. 자체 검증 (최종)
   순서대로 실행, 하나라도 실패하면 멈춤:
   a. pnpm --filter @blog/{영향패키지} lint
   b. pnpm --filter @blog/{영향패키지} typecheck
   c. pnpm --filter @blog/{영향패키지} test
   d. pnpm --filter @blog/{영향패키지} test:e2e (있는 경우)
7. acceptance 검증 - 각 acceptance 항목이 실제로 동작하는지 확인 - 가능하면 curl이나 Playwright MCP로 실제 호출
8. 완료 처리 - docs/tasks/ 의 $ARGUMENTS status를 "done"으로 - docs/handoff/{날짜}-{태스크ID}.md 작성 - 메시지 `feat({domain}):	{요약}	(refs	$ARGUMENTS)` 로 commit
   절대 금지:- 검증 통과 전 status="done"- acceptance 일부 누락 후 "거의 다 됐다" 보고- 의존하지 않는 다른 태스크의 파일 건드리기- 테스트 없이 구현 코드 작성
