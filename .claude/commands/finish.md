# .claude/commands/finish.md--

description: 방금 끝낸 태스크를 정식으로 완료 처리한다. 검증·feature_list 갱신·handoff 작성·commit 까지 자동.
argument-hint: [태스크ID]--
방금 끝낸 태스크 $ARGUMENTS 를 정식 완료 처리하라.
순서 (어디서든 실패하면 즉시 멈춤):

1. 검증 재실행 (사용자에게 보이게)- pnpm --filter @blog/{영향패키지} lint- pnpm --filter @blog/{영향패키지} typecheck- pnpm --filter @blog/{영향패키지} test- pnpm --filter @blog/{영향패키지} test:e2e (있는 경우)
   하나라도 실패하면 status는 todo 그대로 두고 멈춤
2. acceptance 점검
   docs/tasks/ 에서 $ARGUMENTS 의 acceptance 배열을 가져와,
   각 항목이 위 검증 출력 또는 직접 호출(curl, Playwright)로 확인되었는지 표시
   누락이 있으면 멈추고 사용자에게 알림
3. feature_list.json 갱신- $ARGUMENTS 의 status → "done"- completed_at → 오늘 날짜
4. 자동 관리 구간 갱신 (코드 기준)
   - **엔드포인트가 추가/변경/삭제되었으면** `CLAUDE.md` 의 `<!-- AUTO-MANAGED:endpoints:start ~ end -->`
     구간을 `packages/api/src/**/*.controller.ts` 기준으로 다시 생성한다(직접 손으로 적지 말고 코드에서 파생).
   - **하네스 자체(.claude/**, init.sh, CLAUDE.md 규칙, feature_list 스키마)를 바꿨으면**
     `docs/harness-changelog.md` 에 한 줄(추가/변경/삭제 + 이유)을 남긴다.
5. handoff 노트 작성
   docs/handoff/{YYYY-MM-DD}-{$ARGUMENTS}.md 에 다음 6개 섹션:- 한 일- TDD 사이클 확인 (RED 출력, GREEN 출력, REFACTOR 결과)- 결정한 것 (새 ADR이 필요한 결정 표시)- 알려진 이슈- 다음 세션이 알아야 할 것- 명령 출력 증거
6. commit
   메시지: `feat({domain}):	{요약}	(refs	$ARGUMENTS)`
   파일: 변경된 코드 + feature_list.json + docs/handoff/{...}.md (+ 갱신된 CLAUDE.md/harness-changelog)
7. 다음 태스크 후보 알림
   feature_list.json 에서 다음 후보 1개의 ID와 이유를 보여주고
   "/clear 후 새 세션에서 진행하시겠습니까?" 라고 물음
