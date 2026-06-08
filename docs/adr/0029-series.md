# ADR-0029: 시리즈(연재) — Publishing 신규 Aggregate + Post 측 소속/순서

## 상태 (Status)

Accepted - 2026-06-08

## 컨텍스트 (Context)

블로그에 연재물이 늘면서, 작성자가 글을 **순서 있게 묶고** 독자가 **시리즈 단위로 정주행**할 동선이 필요하다(`docs/prd/series.md`). 제약·기준:
- 한 글은 **최대 한 시리즈**에만 속한다(제품 결정). 순서는 **작성자 수동 지정**(발행일과 무관).
- 공개 노출은 **발행글만**(초안 격리), 시리즈 쓰기는 **소유 작성자/ADMIN**(ADR-0018 Actor 패턴).
- 기존 도메인 원칙: Aggregate 는 ID 로만 참조, 한 트랜잭션 = 한 Aggregate, 슬러그 식별(ADR-0022), 검증은 각 패키지(ADR-0004)·shared 순수성(함정 #9), 페이지네이션(ADR-0010).

## 결정 (Decision)

`Series` 를 **Publishing 의 신규 Aggregate Root** 로 추가한다(읽기 파생이 아닌 실제 엔티티 — Publishing 에 Post 외 첫 Aggregate). 구체:

1. **모델**: `Series{id, slug, title, description?, authorId, createdAt, updatedAt}`. 소속·순서는 **Post 측**이 보유한다 — `Post.seriesId`(nullable FK, `onDelete: SetNull`) + `Post.seriesOrder Int @default(0)`. 한 글 최대 1 시리즈. Series 는 Post 객체를 직접 보유하지 않고 ID 참조만(역참조 `posts` 는 읽기 편의).
2. **멤버십·순서 재지정**은 `PUT /api/series/:id/posts { postIds: string[] }` **원자 재지정**으로 한다(부분 패치가 아니라 전체 순서 목록). 목록 index 가 곧 `seriesOrder` → "중복 order 없음" 불변식이 자명. 목록에서 빠진 글은 `seriesId=null`.
3. **공개 노출은 발행글만**(`status=PUBLISHED`): 시리즈 상세 posts·`postCount`·글 상세 시리즈 네비(이전/다음·N/M)가 전부 발행 필터. 시리즈 자체는 항상 공개(비공개 시리즈 없음).
4. **slug**: 생성 시 title 에서 파생(ADR-0022 동형, 중복 suffix), **수정 시 불변**(링크 안정성).
5. **삭제**: Series 만 제거, 소속 글은 `SetNull` 로 보존(글 안 지움).
6. **권한**: 생성·수정·삭제·멤버십 변경은 소유 작성자 또는 ADMIN(ADR-0018 Actor 소유권 재사용). 타인 글을 임의 편입 불가(글·시리즈 소유 일치 또는 ADMIN).
7. **검증**은 각 패키지(ADR-0004): 서버 class-validator, 웹 폼 인라인 zod. shared 는 순수 타입만(함정 #9).

## 결과 (Consequences)

긍정:
- 한 글 1 시리즈 + Post 측 FK 라 모델·쿼리가 단순하고 `(seriesId, seriesOrder)` 인덱스로 상세·네비가 N+1 없이 정렬된다.
- `PUT posts` 원자 재지정으로 추가/제거/재정렬을 한 번에, 부분 적용·order 충돌 없이 멱등 처리.
- 발행 격리·Actor 권한을 기존 패턴으로 재사용 → 초안/타인 글 노출 회귀 위험 최소.
- 슬러그 불변으로 외부 링크 안정.

부정/감수:
- **순서 재정렬은 여러 Post 행을 한 트랜잭션에서 갱신**한다 — "한 트랜잭션 = 한 Aggregate" 원칙의 **실용적 예외**(같은 타입 Post 다건, 불변식 보존 목적). 받아들인다.
- 한 글 다중 시리즈 불가(다대다 미지원) — 필요 시 별도 ADR 로 조인 테이블 도입.
- slug 불변이라 제목 대폭 변경 시 URL 과 어긋날 수 있다(수용; 재생성은 후속).
- `seriesOrder` 가 Post 컬럼이라 시리즈 미소속 글에도 존재(기본 0, 의미 없음) — 약간의 의미 누수 감수.

## 검토 시점
- 다중 시리즈 소속(다대다) 요구가 생기거나, 시리즈 구독/알림(notifications, ADR-0031)·시리즈 RSS/사이트맵(seo-feed 확장) 요구가 구체화될 때 재평가.
- 시리즈/글 수가 커져 `PUT posts` 전체 재지정의 페이로드·트랜잭션 비용이 문제되면 증분 API 로 보강.
