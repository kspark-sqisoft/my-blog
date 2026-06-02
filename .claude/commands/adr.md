# .claude/commands/adr.md--

description: 새 ADR(Architecture Decision Record)을 docs/adr/ 에 추가한다. Nygard 표준 형식.
argument-hint: [짧은 제목]--
새 ADR을 작성한다: $ARGUMENTS
1단계 - 다음 번호 결정
docs/adr/ 의 기존 파일을 보고 다음 ADR 번호(0001, 0002, ...)를 정한다.
파일명: docs/adr/{번호}-{kebab-case-제목}.md
2단계 - 인터뷰- 이 결정이 답하는 질문은 무엇인가?- 어떤 대안들이 있었는가? (최소 2개)- 어느 것을 선택했는가?- 왜? (구체적인 근거)- 어떤 트레이드오프를 감수하는가? (긍정·부정 결과)- 언제 다시 검토할 것인가?
3단계 - 작성 (Nygard 형식)

# ADR-{번호}: {제목}

## 상태 (Status)

{Proposed | Accepted | Deprecated | Superseded by ADR-XXXX} - {날짜}

## 컨텍스트 (Context)

이 결정을 내려야 하는 배경, 제약, 평가 기준

## 결정 (Decision)

한 가지 결정. 모호한 "할 수도 있다"는 금지

## 결과 (Consequences)

긍정:- ...
부정/감수해야 할 것:- ...

## 검토 시점

{언제 다시 평가할지}
규칙 (Accepted ADR은 IMMUTABLE):- 본문은 오타·링크 외 변경 금지- 결정이 바뀌면 새 ADR이 기존 것을 supersede- 한 ADR = 한 결정 (여러 결정 섞지 않기
