# .claude/commands/finish.md--

description: 방금 끝낸 태스크를 정식으로 완료 처리한다. 검증·acceptance(verifier)·독립리뷰(code-reviewer)·feature_list 갱신·handoff 작성·commit 까지 자동.
argument-hint: [태스크ID]--
방금 끝낸 태스크 $ARGUMENTS 를 정식 완료 처리하라.
순서 (어디서든 실패하면 즉시 멈춤):

1. 검증 재실행 (사용자에게 보이게)- pnpm --filter @blog/{영향패키지} lint- pnpm --filter @blog/{영향패키지} typecheck- pnpm --filter @blog/{영향패키지} test- pnpm --filter @blog/{영향패키지} test:e2e (있는 경우)
   하나라도 실패하면 status는 todo 그대로 두고 멈춤
2. acceptance 검증 (`verifier` 서브에이전트 — 독립 패스)
   `verifier` 서브에이전트에 $ARGUMENTS 의 acceptance 검증을 위임한다(직접 점검하지 말 것 — 저자 편향 차단).
   verifier 가 각 항목을 증거(테스트 출력·curl·실행 결과)로 PASS/FAIL/UNVERIFIED 판정한다.
   FAIL 또는 UNVERIFIED 가 하나라도 있으면 status는 todo 그대로 두고 멈추고 사용자에게 알림.
3. 독립 코드 리뷰 (`code-reviewer` 서브에이전트 — commit 전 게이트)
   변경 diff 를 `code-reviewer` 서브에이전트에 위임해 절대규칙·ADR·보안 기준으로 검토한다.
   **Critical 이 하나라도 있으면 commit 하지 말고 멈춘다**(저자가 고친 뒤 /finish 재실행).
   Warning/Suggestion 은 사용자에게 요약 보고하되 진행은 막지 않는다.
3.5. 산출물 채점 (`docs/evaluator-rubric.md` 6차원)
   2단계 verifier 가 모은 증거 + 3단계 리뷰 지적으로 6차원(정확성·검증·범위·신뢰성·유지보수성·핸드오프)을
   각 0/1/2점 채점한다(저자 자가채점 금지 — 증거 기반). 결론을 매긴다:
   - **Block**(≤5, 또는 정확성/검증 차원이 0점) → commit 하지 말고 멈춘다(status todo 유지).
   - **Revise**(6–9) → 사용자에게 무엇을 고치면 2점인지 보고. 경미하면 진행은 가능.
   - **Accept**(≥10, 0점 없음) → 진행.
   결과 한 줄을 6단계 handoff 하단에 `평가: {Accept/Revise/Block} (n/12)` 로 남긴다.
4. feature_list.json 갱신 + docs/tasks 동기화 (절대 규칙 #10)
   - `feature_list.json`: $ARGUMENTS 의 status → "done", completed_at → 오늘 날짜
   - **같은 작업으로** `docs/tasks/{feature}.md` 의 대응 태스크도 갱신한다
     (없으면 해당 에픽 섹션에 추가, 있으면 status/내용 일치). JSON 만 바꾸고 .md 를 빠뜨리지 않는다.
5. 자동 관리 구간 갱신 (코드 기준)
   - **엔드포인트가 추가/변경/삭제되었으면** `CLAUDE.md` 의 `<!-- AUTO-MANAGED:endpoints:start ~ end -->`
     구간을 `packages/api/src/**/*.controller.ts` 기준으로 다시 생성한다(직접 손으로 적지 말고 코드에서 파생).
   - **하네스 자체(.claude/**, init.sh, CLAUDE.md 규칙, feature_list 스키마)를 바꿨으면**
     `docs/harness-changelog.md` 에 한 줄(추가/변경/삭제 + 이유)을 남긴다.
6. handoff 노트 작성
   docs/handoff/{YYYY-MM-DD}-{$ARGUMENTS}.md 에 다음 6개 섹션:- 한 일- TDD 사이클 확인 (RED 출력, GREEN 출력, REFACTOR 결과)- 결정한 것 (새 ADR이 필요한 결정 표시)- 알려진 이슈- 다음 세션이 알아야 할 것- 명령 출력 증거
   하단에 3.5단계 채점 결과를 `평가: {Accept/Revise/Block} (n/12)` 한 줄로 남긴다.
7. commit
   메시지: `feat({domain}):	{요약}	(refs	$ARGUMENTS)`
   파일: 변경된 코드 + feature_list.json + docs/handoff/{...}.md (+ 갱신된 CLAUDE.md/harness-changelog)
8. 다음 태스크 후보 알림
   feature_list.json 에서 다음 후보 1개의 ID와 이유를 보여주고
   "/clear 후 새 세션에서 진행하시겠습니까?" 라고 물음
