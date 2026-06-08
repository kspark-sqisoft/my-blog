# .claude/commands/tasks.md--

description: TRD를 구현 가능한 태스크 단위로 분해한다.
argument-hint: [기능명]--
docs/trd/$ARGUMENTS.md	를	읽고	docs/tasks/$ARGUMENTS.md 를 작성한다.
규칙:

1. 에픽 → 스토리 → 태스크 3단계로 계층화
2. 각 태스크는 30분-2시간에 완료 가능한 단위로
3. 태스크 간 의존성을 명시 (앞 태스크가 끝나야 시작 가능한 경우)
4. 각 태스크는 Bounded Context 하나에만 영향 (여러 Context에 걸치면 더 작게 쪼개기)
5. 각 태스크에 다음을 포함:- id (예: T-AUTH-001 - Bounded Context를 코드로)- title- 변경할 파일 목록- acceptance criteria (테스트 가능한 형태로 3개 이상 - 이게 곧 TDD의 Red 단계 입력)- 예상 소요 시간- 의존성 (다른 태스크 ID)- status (todo / in_progress / done)- tdd_first: true (모든 신규 기능은 TDD)
6. 의존 순서대로 priority 매김
7. 작성 후 `plan-critic` 서브에이전트로 독립 검토(acceptance 테스트가능성·3개 이상, 한 태스크=한 Context, deps/priority 정합). Critical 은 반영해 고친 뒤 사용자에게 결과와 함께 확인 요청.
