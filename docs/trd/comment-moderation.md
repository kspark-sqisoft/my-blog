# TRD — comment-moderation (댓글 수정·삭제·모더레이션)

> Phase 4 산출물. 입력: `docs/prd/comment-moderation.md`, `docs/glossary.md`, `docs/bounded-contexts.md`(Conversation).
> 구현 코드는 작성하지 않는다(Phase 7). 주요 결정은 ADR-0027 로 분리한다.

## 1. 아키텍처 개요

새 BC·새 모듈 없이 **Conversation(ConversationModule)** 에 수정·삭제 유스케이스를 더한다. 글쓴이 권한 판정만 Publishing 의 `Post.authorId` 를 **read-only ID 참조 조회**한다.

```
   작성자/운영자/글쓴이 ──▶ CommentController (posts/:postId/comments/:id)
        │  PATCH(수정)                         │  DELETE(삭제)
        ▼                                      ▼
   JwtAuthGuard(401) → requireComment(404) → assertCanEdit/Delete(403)
        │                                      │
        ▼                                      ▼
   CommentService.update                  CommentService.remove
   - 본인(userId==actor.id)만             - 본인 ‖ ADMIN ‖ 글쓴이(Post.authorId)
   - body 변경 + editedAt=now             - 직계 답글 있으면 soft(deletedAt), 없으면 hard delete
        │                                      │  (글쓴이 판정: post.findUnique select authorId — read-only)
        ▼                                      ▼
   Prisma comment.update                  Prisma comment.update(deletedAt) | comment.delete
```

사람 작성·조회 흐름(기존 GET/POST)은 변경 없다.

## 2. 백엔드 모듈 구조 (BC 1:1 — Conversation)

`ConversationModule` 에 메서드·엔드포인트를 추가한다(새 모듈 없음).

| 요소 | 추가 |
|---|---|
| `CommentController` | `PATCH :id`(수정), `DELETE :id`(삭제) — 둘 다 `JwtAuthGuard`+`ThrottlerGuard` |
| `CommentService.update(id, body, actor)` | 본인만, `editedAt` 갱신 |
| `CommentService.remove(id, actor)` | 권한 판정 + 조건부 soft/hard |
| `Actor{id, role}` | Post 와 동일 형태 재사용(ADR-0018) |
| (read-only) `prisma.post.findUnique({select:{authorId}})` | 글쓴이 권한 판정용 — Post 객체 보유 안 함 |

> 모든 권한·소유권은 **서버 판정**. 익명 Comment(`userId` null)는 본인 권한이 성립하지 않는다.

## 3. API 명세

### 3.1 `PATCH /api/posts/:postId/comments/:id` (수정 — 본인만)
- 가드: `JwtAuthGuard`(미인증 401), `ThrottlerGuard`
- 요청: `{ "body": "고친 내용" }` (UpdateCommentDto, body 1~maxLen)
- 권한: 로그인 작성자 **본인**(`comment.userId === actor.id`)만. 익명 댓글·타인 → 403.
- 응답 200: 수정된 `CommentDto`(`isEdited: true`)
```json
{ "id":"c1","postId":"p1","parentId":null,"depth":0,"userId":"u1",
  "authorName":"홍길동","authorAvatarUrl":null,"displayName":null,
  "body":"고친 내용","createdAt":"...","editedAt":"...","isEdited":true,
  "isDeleted":false,"replies":[] }
```
- 오류: 401(미인증) → 404(없는 댓글) → 403(본인 아님). **익명 댓글 수정 시도는 `userId` 가 actor 와 영원히 불일치해 항상 403**. `body` 빈값 400.

### 3.2 `DELETE /api/posts/:postId/comments/:id` (삭제 — 본인+ADMIN+글쓴이)
- 가드: `JwtAuthGuard`(미인증 401), `ThrottlerGuard`
- 권한: `comment.userId === actor.id` ‖ `actor.role === 'ADMIN'` ‖ `actor.id === post.authorId`. 그 외 403.
- 동작(조건부): **직계 답글(자식 Comment) 존재 시 soft**(`deletedAt = now`), **없으면 hard**(`comment.delete`).
- 응답: **204 No Content**(soft·hard 동일). 클라이언트는 목록을 refetch 한다. soft 노드는 이후 목록에서 `isDeleted: true` 로 표현된다.
- 오류: 401 → 404 → 403.

### 3.3 (기존) `GET /api/posts/:postId/comments` — 응답 확장
- 각 노드에 `isEdited`·`isDeleted` 추가. **soft 삭제 노드는 본문·작성자 표시를 가린다**: `body: ""`, `authorName: null`, `authorAvatarUrl: null`, `displayName: null`, `isDeleted: true`. `replies`·`depth`·`createdAt` 은 유지(트리 보존, M6).

### 3.4 (기존) `POST` — soft 삭제 부모에 답글 차단(S2)
- `parentId` 부모가 `deletedAt != null` 이면 **400 Bad Request 거부**("삭제된 댓글에는 답글을 달 수 없습니다" — 깊이 초과와 같은 비즈니스 규칙 위반, ADR-0027 확정).

## 4. DB 스키마 (Prisma)

`Comment` 에 **2개 nullable 컬럼 추가**(추가 전용 마이그레이션 — 데이터 손실 없음).
```prisma
model Comment {
  // ... 기존 필드 ...
  body        String
  editedAt    DateTime?  // body 수정 시각 (null=미수정). "수정됨" 판정 (M1)
  deletedAt   DateTime?  // 소프트 삭제 시각 (null=정상). 직계 답글 있는 삭제 시 set (M3)
  createdAt   DateTime   @default(now())
  // ...
}
```
- 인덱스 추가 불필요(조회는 기존 `@@index([postId])`).
- 마이그레이션은 dev `blog` + test `blog_test` 양쪽 적용. `prisma-helper` check_migration_destructive 로 비파괴 확인.
- `parent` 의 `onDelete: Cascade` 는 유지: hard delete 는 **직계 답글이 없을 때만** 일어나므로 cascade 가 답글을 지우는 상황은 발생하지 않는다.

## 5. 프론트엔드 (web)

- `CommentTree`/`CommentItem`: 권한에 따라 **수정·삭제 버튼** 노출.
  - `canEdit = user && comment.userId === user.id`(본인, 익명 불가)
  - `canDelete = user && (comment.userId === user.id || user.role === 'ADMIN' || user.id === postAuthorId)`
  - `postAuthorId` 는 `PostDetail` 의 `authorId` 를 트리에 prop 전달(글쓴이 판정).
- 수정: 인라인 편집 폼 → `PATCH` → 목록 무효화. **"수정됨"**(`isEdited`) 표시.
- 삭제: 확인 후 `DELETE` → 목록 무효화. soft 노드는 **"삭제된 댓글입니다"**(`isDeleted`) placeholder, 답글은 그대로.
- 훅: `useUpdateComment`, `useDeleteComment`(`src/api/comments.ts`). 컴포넌트 직접 fetch 금지(web 규칙).

## 6. 공유 타입 (packages/shared)

- `CommentDto` 에 추가: `editedAt: string | null`, `isEdited: boolean`, `isDeleted: boolean`.
- 신규 `UpdateCommentDto { body: string }`(타입). 폼 zod 스키마는 **web 인라인**(함정 #9 — shared 에 zod 값 금지).
- 서버 검증은 api class-validator(`UpdateCommentDto` 클래스). shared 는 순수 타입만.

## 7. 외부 의존성

**추가 없음.** 기존 Prisma·class-validator·Throttler 재사용. 새 라이브러리 0.

## 8. 보안 처리

- **권한 서버 판정**: 본인/ADMIN/글쓴이 모두 서버에서. 클라 버튼 노출은 UX 일 뿐 강제는 서버.
- **평가 순서**: `JwtAuthGuard`(401) → `requireComment`(404) → `assertCanEdit/Delete`(403). (M5, ADR-0018)
- **actor 출처(중요)**: 권한 판정의 `actor{id,role}` 는 `JwtStrategy.validate` 가 **매 요청 DB 재조회**로 구성한 `req.user`(ADR-0018 §3)를 그대로 쓴다. JWT payload 에는 `role` 이 없으므로 payload 에서 role 을 읽지 않는다(승격·강등 즉시 반영 보장, 운영자 판정 실패 방지). Post 컨트롤러의 `actorOf(req)` 패턴과 동형.
- **익명 격리**: 익명 Comment 는 본인 수정/삭제 불가(`userId` null 이라 소유권 성립 안 함). 삭제는 ADMIN/글쓴이만.
- **PII/소프트 삭제**: soft 삭제는 응답에서 본문·작성자를 가린다. DB 원문은 보존(트레이드오프 — §9 결정). 감사·복구 여지 vs 완전 파기.
- **글쓴이 조회 read-only**: `Post.authorId` 만 select, 같은 트랜잭션에서 Post 수정 없음(한 트랜잭션=한 Aggregate 유지).
- **레이트리밋**: PATCH/DELETE 에 ThrottlerGuard(ADR-0009 확장).

## 9. 주요 결정 → ADR-0027 분리 (Phase 5)

ADR-0027 **(comment-moderation: 조건부 소프트 삭제 + 모더레이션 권한)** 하나로 묶는다:
1. 새 BC·모듈 없이 Conversation 확장(행위 추가).
2. 수정 추적 = `editedAt DateTime?`(별도 컬럼) — `@updatedAt` 이 soft-delete 에 오염되는 문제 회피.
3. 소프트 삭제 = `deletedAt DateTime?`(타임스탬프) — status enum 대신 단순·정보보존.
4. 조건부 삭제 = **직계 답글 존재 → soft, 없음 → hard**(깊이 2 트리 보존, ADR-0013).
5. 삭제 권한 = 본인 + ADMIN + 글쓴이(actor 패턴, ADR-0018), 익명은 ADMIN/글쓴이만.
6. 수정 권한 = 로그인 본인만(`JwtAuthGuard`).
7. soft 삭제 노드 = 응답 가림 + DB 보존(복구 여지). 답글 차단(S2).
8. PATCH/DELETE throttler.
> Domain Events(`CommentEdited`/`CommentDeleted`)는 **개념적**이다(현재 명시적 이벤트 버스 없음). 실제 발행은 범위 외 — notifications 기능에서 도입 가능. 삭제 종류(hard/soft)·주체는 서비스 내부 판정으로 충분.

## 10. 트레이드오프 기록

| 결정 | 대안 | 채택·근거 |
|---|---|---|
| 수정 추적 | `editedAt` 컬럼 / `@updatedAt` / `isEdited` bool | **editedAt** — `@updatedAt` 은 soft-delete update 도 갱신해 "수정됨" 오염. editedAt 은 body 수정 시에만 set. |
| 소프트 삭제 표현 | `deletedAt` / status enum / body 치환 | **deletedAt** — 타임스탬프로 단순, 정보 보존, 마이그레이션 가벼움. |
| soft 데이터 | 응답만 가림(DB 보존) / DB body 파기 | **응답 가림+보존** — 복구·감사 여지, 단순. PII 완전파기는 향후 옵션(트레이드오프 명시). |
| DELETE 응답 | 204(refetch) / 200+노드 | **204** — soft/hard 일관, 클라 refetch 로 상태 동기(기존 댓글 UX 와 동일). |

## 11. 테스트 전략

- **api 단위(comment.service.spec)**: 권한 매트릭스(본인/ADMIN/글쓴이/타인/익명 × 수정/삭제), 조건부 soft(직계 답글有)/hard(無), editedAt 설정, soft 노드 답글 차단, 글쓴이 authorId 조회.
- **api e2e(comment.e2e)**: PATCH/DELETE 401/404/403/200/204 매트릭스. soft 삭제 후 목록에 isDeleted+답글 보존, hard 삭제 후 노드 소멸. 익명 댓글 운영자 삭제. soft 부모 답글 거부.
- **web 단위**: 버튼 권한 노출(canEdit/canDelete), useUpdateComment/useDeleteComment, "수정됨"·"삭제된 댓글" 렌더.
- **회귀**: 기존 comment 단위·e2e(작성·조회·깊이2) 무회귀.

## 12. 오픈 이슈 (Phase 5/6 확정)

1. (확정) soft 삭제 부모 답글 차단 = **400 Bad Request**(ADR-0027).
2. `body` 최대 길이(기존 CreateCommentDto 와 동일 상수 재사용) 확인.
3. soft 삭제 노드를 향후 카운트/정렬에 포함하는 방식(현재 별도 카운트 없음).

---
*작성: Phase 4 (/trd). 다음: Phase 5 `/adr`(ADR-0027) → Phase 6 `/tasks`. 검토: plan-critic 독립 검토 후 사용자 확인.*
