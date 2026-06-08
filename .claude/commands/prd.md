# .claude/commands/prd.md--

description: PRD를 작성한다. 인터뷰 형식으로 진행하며 docs/prd/{기능명}.md 에 저장한다.
argument-hint: [기능명]--
다음 기능에 대한 PRD를 작성하라: $ARGUMENTS
ultrathink	단계로	진행:
0단계	-	사전	점검
docs/glossary.md	를	먼저	읽는다.	인터뷰와	작성에서	거기	정의된	용어만	사용한다.
새	용어가	필요하면	인터뷰	중간에	/glossary	로	먼저	추가한	후	진행.
1단계	-	인터뷰
다음을	한	번에	하나씩	사용자에게	물어라:-	핵심	사용자	(페르소나)-	사용자가	풀고	싶은	문제-	성공의	척도	(지표)-	최소	기능	(MVP에	반드시)-	범위	외	(이번에	안	할	것)-	비기능	요구	(성능·접근성·보안)
2단계	-	작성
인터뷰	결과로	docs/prd/$ARGUMENTS.md 를 다음 구조로 작성:- 개요 (Problem Statement, Goal)- 사용자 스토리 (As a... I want... So that...)- 기능 요구사항 (MUST / SHOULD / MAY 분류)- 비기능 요구사항- 범위 외- 성공 지표- 오픈 이슈
3단계 - 검토
작성 후 `plan-critic` 서브에이전트로 독립 검토한다(저자 편향 차단 — 인터뷰로 쓴 메인이 자체 승인하지 말 것).
plan-critic 의 Critical 은 반영해 고친 뒤, 결과 요약과 함께 사용자에게 최종 검토를 요청한다.
절대 규칙:- 기술 결정 (라이브러리, DB 스키마)은 PRD에 넣지 않는다. 그건 TRD의 일이다.- glossary 에 없는 새 용어를 도입하지 않는다 (필요하면 먼저 glossary 갱신)- 모호한 항목은 [TBD] 로 표시하고 오픈 이슈에 적는다
