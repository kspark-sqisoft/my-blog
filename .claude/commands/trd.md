# .claude/commands/trd.md--

description: TRD를 작성한다. PRD + Bounded Context를 입력으로 받아 기술 명세를 만든다.
argument-hint: [기능명]--
다음을 모두 읽고 docs/trd/$ARGUMENTS.md	를	작성한다:-	docs/glossary.md	(용어)-	docs/prd/$ARGUMENTS.md (요구)- docs/bounded-contexts.md (모듈 경계)
ultrathink:
1단계 - 분석
PRD의 각 기능을 Bounded Context에 매핑하고, 각 Context의 기술적 결정을 도출.
2단계 - 트레이드오프 검토
주요 결정마다 대안 2-3개를 제시. 우리 프로젝트에서 무엇이 적절한지 근거와 함께 추천.
사용자에게 확인을 받고 진행.
3단계 - 작성
docs/trd/$ARGUMENTS.md 에 다음 구조로:- 아키텍처 개요 (ASCII 다이어그램)- 백엔드 모듈 구조 (Bounded Context와 1:1)- API 명세 (엔드포인트별 요청·응답 스키마와 예시)- DB 스키마 (Prisma 형식)- 프론트엔드 라우트와 페이지- 공유 타입 (packages/shared 에 둘 것)- 외부 의존성 (라이브러리 선택과 이유)- 보안 처리- 테스트 전략
4단계 - 결정 추출
주요 결정 8-10개를 식별하고 "다음 단계에서 docs/adr/ 에 각각 ADR로 분리해야 함"이라고 표시.
5단계 - 독립 검토
작성 후 `plan-critic` 서브에이전트로 검토한다(PRD↔TRD 추적성, BC 1:1 정합, ADR 분리, shared 순수성 함정 #9, 절대규칙).
Critical 은 반영해 고친 뒤 사용자에게 결과 요약과 함께 확인 요청. 저자(메인)가 자체 승인하지 말 것.
절대 규칙:- glossary, bounded-contexts와 일관성 유지- 모든 API에 요청·응답 예시 포함- 구현 코드는 작성하지 않는다 (그건 Phase 7
