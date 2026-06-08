# ADR-0027: comment-moderation — 조건부 소프트 삭제 + 모더레이션 권한

## 상태 (Status)

Accepted - 2026-06-08

## 컨텍스트 (Context)

현재 Comment 는 작성·조회만 되고 **수정·삭제가 없다**(`comment.service.ts`). 작성자는 오타를 못 고치고, 운영자는 스팸·부적절 댓글을 제거할 수단이 없어 운영이 사실상 불가능하다. 또한 답글(깊이 2, ADR-0013)이 달린 댓글을 그냥 지우면 트리가 깨진다.

제약·평가 기준:
- 기존 **Actor 소유권 패턴(ADR-0018)** — Post 가 본인/ADMIN/AUTHOR 를 actor 로 판정하는 방식을 Comment 에도 동형 적용.
- Comment 는 `userId`(로그인) 또는 `displayName`(익명) 병행. **익명 댓글은 작성자 식별 수단이 없다**(쿠키·세션 기반 익명 식별을 도입하지 않기로 함).
- 현 `Comment` 모델에는 `createdAt` 만 있고 `updatedAt`/`editedAt`/`deletedAt` 이 **없다**.
- `parent` 관계는 `onDelete: Cascade`.
- BC 규칙: Conversation 은 Publishing 을 `postId` 로만 참조(객체 직접 보유·역방향 의존 금지).
- 사용자 결정(인터뷰): 조건부 삭제 / 삭제 권한 = 본인+운영자+글쓴이 / 수정 = 본인만+"수정됨" / 익명은 운영자·글쓴이만 삭제.

핵심 질문: **답글 트리를 보존하면서 댓글을 수정·삭제·모더레이션하는 데이터 모델과 권한 체계를 어떻게 둘 것인가.**

## 결정 (Decision)

Comment 의 수정·삭제·모더레이션을 **새 BC·새 모듈 없이 Conversation 확장**으로 구현하고, 다음을 채택한다.

1. **수정 추적 = 별도 컬럼 `editedAt DateTime?`**. body 수정 시에만 `editedAt = now` 로 set 하고, "수정됨"은 `editedAt != null`(응답 `isEdited`)로 판정한다. Prisma `@updatedAt` 은 쓰지 않는다 — 그것은 소프트 삭제 update 시에도 갱신되어 "수정됨"을 오염시키기 때문이다.

2. **소프트 삭제 = `deletedAt DateTime?`**(null=정상, 값=소프트 삭제). status enum 대신 타임스탬프로 단순화하고 정보를 보존한다. 두 컬럼 모두 **nullable 추가 전용 마이그레이션**(데이터 손실 없음, dev `blog`+test `blog_test` 적용).

3. **조건부 삭제**: 삭제 시 **직계 답글(자식 Comment)이 있으면 소프트 삭제**(`deletedAt` set, 본문·작성자 표시를 응답에서 가리되 노드·`replies`·`depth` 보존), **직계 답글이 없으면 완전 삭제(하드, `comment.delete`)**. hard delete 는 자식이 없을 때만 일어나므로 `onDelete: Cascade` 가 답글을 지우는 상황은 발생하지 않는다.

4. **소프트 삭제 표현 = 응답 가림 + DB 보존**. 소프트 삭제 노드는 GET 응답에서 `body: ""`·`authorName: null`·`authorAvatarUrl: null`·`displayName: null`·`isDeleted: true` 로 내려가고 `replies` 는 그대로 노출한다. DB 원문은 보존한다(감사·복구 여지). 완전 파기는 후속 옵션으로 둔다.

5. **삭제 권한 = 본인 + 운영자(ADMIN) + 글쓴이**. `comment.userId === actor.id` ‖ `actor.role === 'ADMIN'` ‖ `actor.id === post.authorId`. 글쓴이 판정은 `Comment.postId` 로 `Post.authorId` 만 **read-only ID 참조 조회**(Post 객체 보유 안 함, 같은 트랜잭션에서 Post 수정 없음). 익명 댓글은 본인 권한이 성립하지 않아 운영자·글쓴이만 삭제한다.

6. **수정 권한 = 로그인 본인만**. PATCH/DELETE 는 `JwtAuthGuard`(미인증 401)+`ThrottlerGuard`(ADR-0009 확장). 권한 평가는 **401 → 404(없음) → 403(권한)** 순. `actor{id,role}` 는 `JwtStrategy.validate` 가 매 요청 DB 재조회로 구성한 `req.user` 를 쓴다(ADR-0018 §3 — payload 에 role 없음).

7. **소프트 삭제된 댓글에는 새 답글을 달 수 없다**. 작성(POST) 시 `parentId` 부모의 `deletedAt != null` 이면 **400 Bad Request**("삭제된 댓글에는 답글을 달 수 없습니다")로 거부한다. 깊이 초과(ADR-0013)와 같은 비즈니스 규칙 위반이므로 404 가 아니라 400 으로 통일한다.

8. **Domain Events(`CommentEdited`/`CommentDeleted`)는 선언만 하고 발행하지 않는다**(현재 명시적 이벤트 버스 없음). 삭제 종류(hard/soft)·주체는 서비스 내부 판정으로 충분하며, 실제 이벤트 발행은 notifications 기능에서 도입을 검토한다. shared 는 순수 타입만 추가한다(`isEdited`/`isDeleted`/`editedAt`, `UpdateCommentDto` — 함정 #9, 폼 zod 는 web 인라인).

## 결과 (Consequences)

긍정:
- 답글 트리(깊이 2, ADR-0013)가 어떤 삭제에도 깨지지 않는다(조건부 soft).
- 기존 actor 소유권(ADR-0018)·throttler(ADR-0009)·Conversation 모듈을 재사용해 새 추상화·새 의존성이 없다.
- `editedAt`/`deletedAt` 분리로 "수정됨"과 "삭제됨"이 서로 오염되지 않는다.
- 익명 식별 수단을 도입하지 않아 공격면·복잡도가 늘지 않으면서도 운영자·글쓴이 모더레이션은 가능하다.
- 추가 전용 마이그레이션이라 기존 데이터·코드 회귀 위험이 낮다.

부정/감수해야 할 것:
- 소프트 삭제 노드의 원문이 DB 에 남는다(완전 파기 아님) — 강한 프라이버시/삭제권 요구 시 별도 파기 정책이 필요하다.
- 익명 작성자는 본인 댓글을 스스로 수정·삭제할 수 없다(식별 불가의 의도된 결과).
- "직계 답글 존재" 판정에 삭제마다 자식 카운트 조회가 1회 더 든다(단일 쿼리, N+1 아님).
- 소프트 삭제 노드가 목록에 placeholder 로 남아 빈 자리가 누적될 수 있다(조건부라 잎은 완전 삭제되어 완화).

## 검토 시점

- 강한 프라이버시(삭제권/GDPR) 요구가 생기면 소프트 삭제의 "DB 보존"을 "원문 파기"로 바꾸는 새 ADR 로 supersede 한다.
- 알림(notifications) 기능 도입 시 `CommentEdited`/`CommentDeleted` 의 실제 이벤트 발행 여부를 재평가한다.
- 수정 이력·삭제 복구(undelete)·신고 모더레이션 큐는 별도 기능에서 결정한다.
