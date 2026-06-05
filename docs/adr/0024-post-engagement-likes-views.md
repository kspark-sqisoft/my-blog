# ADR-0024: 글 참여 — 좋아요(로그인 토글) + 조회수(dedup)

## 상태 (Status)

Accepted - 2026-06-05

## 컨텍스트 (Context)

글에 대한 독자 참여 신호가 없다. "고급 블로그"의 참여(engagement) 축으로 **좋아요**와
**조회수**를 도입한다. 두 지표는 목록 정렬·인기글·작성자 피드백의 기반이 된다. 발견(SEO,
ADR-0022)·읽기경험과 독립적이며, 댓글(Conversation, ADR-0013/0018)과 같은 "글에 대한 독자 행동"
범주다.

요구사항:
- 좋아요는 **정확**해야 한다(한 사람이 한 글에 1개, 취소 가능, "내가 눌렀는지" 표시).
- 조회수는 **새로고침·봇·프리페치로 과다 집계되지 않아야** 한다(완벽한 봇 차단은 범위 외).
- 목록/상세에서 빠르게 표시·정렬할 수 있어야 한다.

## 결정 (Decision)

### 1. 좋아요 = 로그인 토글 + 조인 테이블
- 좋아요는 **로그인(MEMBER 이상)** 만 가능하다. 익명 좋아요는 식별 불가로 취소·중복 방지가
  불가능하므로 채택하지 않는다(댓글의 익명 허용과 다른 선택 — 좋아요는 "1인 1표"가 핵심).
- `Like(postId, userId)` 조인 테이블, 복합 PK `@@id([postId, userId])` 로 1인 1글 1좋아요를 DB가 강제.
- 엔드포인트는 멱등 토글: `POST /api/posts/:id/like`(좋아요), `DELETE /api/posts/:id/like`(취소).
  둘 다 현재 상태를 `{ likeCount, likedByMe }` 로 반환한다(멱등 — 이미 같은 상태면 그대로).

### 2. 조회수 = 별도 엔드포인트 + 방문자키 dedup(30분)
- 조회는 읽기(GET)의 부수효과로 올리지 않는다(GET 멱등성 위반·SSR/프리페치/봇 과다집계). 대신
  프론트가 **글을 실제로 연 시점**에 `POST /api/posts/:id/view` 를 1회 호출한다.
- dedup: `PostView(postId, visitorKey)` 복합 PK + `lastViewedAt`. 같은 방문자키는 **30분 창** 안에서
  1회만 카운트한다. 방문자당 1행만 유지(시간 버킷 누적 없음 → 무한 증가 방지).
- `visitorKey` = 로그인이면 `user:{userId}`, 비로그인이면 `ip|user-agent` 의 **sha256 해시**.
  원문 IP·UA 는 저장하지 않는다(PII 최소화 — 해시만 저장). 봇/프록시 공유 IP의 한계는 수용한다.

### 3. 비정규화 카운터
- `Post.viewCount`, `Post.likeCount`(둘 다 `Int @default(0)`)를 둔다. 좋아요/조회 토글과 **같은
  트랜잭션**에서 증감하여 목록·상세에서 `COUNT(*)` 없이 즉시 표시·정렬한다. 진실의 원천은
  `Like`/`PostView` 행이며, 카운터는 파생값이다(드리프트 시 재집계 가능).

### 4. 응답 노출
- `GET /api/posts/:idOrSlug` 상세에 `OptionalJwtAuthGuard` 를 적용해 `viewCount, likeCount,
  likedByMe` 를 포함한다(비로그인은 `likedByMe=false`).
- 목록(`PostSummaryDto`)에는 `viewCount, likeCount` 만 포함한다(likedByMe 는 상세 전용 — 목록
  N건마다 사용자별 조회 비용 회피).

### 5. 모듈 경계
- 새 **Engagement Context** = `engagement` 모듈(EngagementService/Controller). 댓글이 Conversation
  으로 분리된 것과 동일하게, 좋아요/조회는 Publishing(글 본문/발행)과 분리한다.

## 범위 외 (Out of Scope)
- 좋아요 누른 사용자 목록 UI, 인기글 랭킹 페이지, 북마크/공유 카운트.
- 봇 정밀 차단(User-Agent 필터링·캡차), 조회수 시계열 분석.
- 조회수 throttle 가드: dedup 이 과다집계를 막으므로 별도 레이트리밋은 두지 않는다(좋아요는 인증으로 제한).

## 결과 (Consequences)

긍정:
- 좋아요는 DB 제약으로 정확(1인 1표·취소·likedByMe). 조회수는 dedup 으로 새로고침·프리페치에 견고.
- 비정규화 카운터로 목록/상세 표시·정렬이 추가 쿼리 없이 빠르다.
- PII(원문 IP) 미저장 — 해시만.

부정/비용:
- 조회수는 로그인/IP 기반이라 공유 IP·시크릿창에서 부정확할 수 있다(블로그 지표로 수용 가능한 근사).
- 카운터-행 드리프트 가능성(동시성/장애) → 파생값이므로 필요 시 재집계로 교정.
- 좋아요가 로그인 전용이라 비로그인 독자는 참여 불가(의도된 트레이드오프 — 정확성 우선).
