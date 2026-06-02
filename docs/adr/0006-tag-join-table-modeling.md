# ADR-0006: Tag를 별도 테이블 + PostTag 조인으로 모델링

## 상태 (Status)

Accepted - 2026-06-02

## 컨텍스트 (Context)

Post는 Tag로 분류되며(PRD M5, Post당 0~5개), 독자는 Tag로 Post를 탐색한다(M6). glossary는 Tag를 Publishing 내부의 Value Object로 정의하고 "Tag 모델 + PostTag 조인 테이블"로 코드 표현을 지정한다. DB 모델링 방식을 확정해야 한다.

평가 기준: Tag별 조회 효율, glossary와의 일관성, 중복 제거.

## 결정 (Decision)

Tag를 고유 `name`을 가진 별도 `Tag` 테이블로 두고, Post와의 다대다 관계를 `PostTag` 조인 테이블로 표현한다. (glossary 정의를 그대로 따른다.)

## 결과 (Consequences)

긍정:
- Tag명이 정규화되어 중복이 없고, Tag별 Post 조회·집계가 효율적이다.
- glossary의 코드 표현과 일치한다.

부정/감수해야 할 것:
- 단순 문자열 배열보다 조인 테이블 관리·쿼리 복잡도가 높다.
- Tag는 독립 Aggregate가 아니므로 생명주기를 Post를 통해서만 다뤄야 한다(경계 유지 책임).

## 검토 시점

Tag에 별도 속성(설명·색상 등)이나 독립 관리 요구가 생기면 Tag의 Aggregate 승격을 재평가한다.
