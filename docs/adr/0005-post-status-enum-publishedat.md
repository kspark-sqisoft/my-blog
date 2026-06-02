# ADR-0005: 발행 상태를 enum + publishedAt으로 표현

## 상태 (Status)

Accepted - 2026-06-02

## 컨텍스트 (Context)

Post는 초안(DRAFT)과 발행(PUBLISHED) 상태를 구분한다(PRD M2). 이 상태를 DB에서 어떻게 표현할지 결정해야 한다. 독자에게는 발행된 Post만 노출하고, 목록은 발행 시각 최신순으로 정렬한다.

평가 기준: 상태 확장성, 정렬·표시 요구 충족, 명확성.

## 결정 (Decision)

발행 상태를 `PostStatus` enum(`DRAFT` | `PUBLISHED`)으로 표현하고, 발행 시각은 별도 `publishedAt`(nullable) 컬럼으로 저장한다.

## 결과 (Consequences)

긍정:
- 상태가 명시적 enum이라 의미가 분명하고, 추후 상태(예: ARCHIVED) 추가가 쉽다.
- `publishedAt`으로 발행일 표시와 최신순 정렬을 직접 지원한다.

부정/감수해야 할 것:
- 상태와 시각 두 필드의 정합성(예: PUBLISHED인데 publishedAt null)을 서비스 계층에서 관리해야 한다.

## 검토 시점

예약 발행·보관 등 상태 종류가 늘어나면 상태 머신 모델링을 재평가한다.
