# .claude/commands/bc.md--

description: Bounded Context를 식별하고 docs/bounded-contexts.md 를 갱신한다.
argument-hint: [기능명]--
docs/prd/$ARGUMENTS.md 와 docs/glossary.md 를 읽고 도메인 모델링을 수행한다.
ultrathink:
1단계 - 식별
PRD의 기능들을 응집도가 높은 묶음으로 분류한다.
각 묶음 = 하나의 Bounded Context 후보.
각 Context마다 결정:- 이름 (단수 명사, 비즈니스 어휘. 예: Publishing, Conversation)- 핵심 책임 (1-2문장)- Aggregate Root (외부에 노출되는 진입 객체)- 다른 객체 (Entity, Value Object 구분)- Domain Events (다른 Context로 알릴 일)- 다른 Context와의 의존 (어느 쪽이 어느 쪽을 알아야 하나)
2단계 - 검토
사용자에게 결과 표를 보여주고 다음을 확인 요청:- "이 분류가 비즈니스적으로 자연스러운가?"- "어떤 Context가 너무 작은가 / 너무 큰가?"
3단계 - 작성
docs/bounded-contexts.md 에 다음 구조로 저장:- 각 Context의 표 (이름, 책임, Aggregate Root, Events)- Context 간 의존 다이어그램 (ASCII)- 어떤 Context가 어떤 NestJS 모듈로 매핑될지
규칙:- glossary 의 용어만 사용- Aggregate는 외부에서 ID로만 참조 (객체 직접 참조 금지)- 한 트랜잭션 = 한 Aggregate 만 수정 (DDD 원칙)- 단순 CRUD라면 한 Context로 통합. 억지로 쪼개지 않는다
