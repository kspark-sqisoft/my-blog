# Tasks — comment-moderation (댓글 수정·삭제·모더레이션)

> Phase 6 산출물. 입력: `docs/trd/comment-moderation.md`, ADR-0027. 정규 진행 상태는 `feature_list.json`(이 파일은 미러 — 절대규칙 #10).
> epic **E18**, context **CONV**(Conversation 확장) + **WEB** 1건. 모두 `tdd_first: true`.

## 에픽 E18 — 댓글 모더레이션(comment-moderation)

새 BC·모듈 없음(ADR-0027). Actor 소유권(ADR-0018)·깊이 2 트리(ADR-0013) 재사용.

### 스토리 S18.1 — 스키마·공유 타입 토대

#### T-CONV-005 — Comment editedAt/deletedAt 컬럼 + shared 타입 확장 — ✅ done (2026-06-08)
- **context**: CONV / **priority**: 93 / **deps**: 없음 / **tdd_first**: true / **예상**: 1h / **status**: done
- **변경 파일**: `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/**`, `packages/shared/src/dto/comment.ts`
- **acceptance**:
  1. `Comment` 에 `editedAt DateTime?`·`deletedAt DateTime?` 추가 + **추가 전용 마이그레이션**(SQL 에 `DROP`·`NOT NULL` 추가 0건 — `check_migration_destructive` 비파괴), dev `blog` + test `blog_test` 양쪽 적용.
  2. `CommentDto` 에 `editedAt: string | null`·`isEdited: boolean`·`isDeleted: boolean` 추가(순수 타입 — 함정 #9).
  3. `UpdateCommentDto { body: string }` export(shared 순수 타입, zod 값 없음).
  4. shared 빌드 통과 + 기존 사용처(api/web) 타입 통과(회귀 0).

### 스토리 S18.2 — 수정(본인만)

#### T-CONV-006 — CommentService.update + toDto(수정됨·소프트 가림) — ✅ done (2026-06-08)
- **context**: CONV / **priority**: 94 / **deps**: T-CONV-005 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/api/src/conversation/comment.service.ts`(+`.spec`)
- **acceptance**:
  1. `update(id, body, actor)`: `comment.userId === actor.id` 면 body 변경 + `editedAt = now`, `CommentDto`(`isEdited: true`) 반환.
  2. 익명 댓글(`userId` null) 또는 타인 → `ForbiddenException`(403), 없는 댓글 → `NotFoundException`(404).
  3. `toDto`: `editedAt != null` → `isEdited: true`. `deletedAt != null` → `isDeleted: true` + `body:""`·`authorName:null`·`authorAvatarUrl:null`·`displayName:null` 가림(M6). 정상 노드는 기존과 동일.
  4. 수정은 body 만 변경, `parentId`·깊이·작성자 불변(S1). (빈/공백 body 거부는 `UpdateCommentDto` class-validator 책임 — T-CONV-008)

### 스토리 S18.3 — 삭제(조건부 soft/hard) + 답글 차단

#### T-CONV-007 — CommentService.remove(조건부) + soft 부모 답글 차단 — ✅ done (2026-06-08)
- **context**: CONV / **priority**: 95 / **deps**: T-CONV-006 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `packages/api/src/conversation/comment.service.ts`(+`.spec`)
- **acceptance**:
  1. `remove(id, actor)`: 본인(`userId===actor.id`) ‖ `actor.role==='ADMIN'` ‖ 글쓴이(`actor.id===post.authorId`) 아니면 403, 없으면 404(401→404→403 순서는 컨트롤러 가드).
  2. **직계 답글이 있으면 soft**(`deletedAt=now`, 노드·replies 보존), **없으면 hard**(`comment.delete`).
  3. 글쓴이 판정은 `post.findUnique({select:{authorId}})` **read-only**(Post 객체 보유 안 함, 단위테스트에서 `post.findUnique` 호출 1회 단언 — N+1 없음).
  4. `create`: `parentId` 부모의 `deletedAt != null` 이면 **`BadRequestException`(400)** ("삭제된 댓글에는 답글을 달 수 없습니다" — S2/ADR-0027).
  5. 익명 댓글도 ADMIN/글쓴이 `remove` 는 동일 동작(조건부).

### 스토리 S18.4 — 엔드포인트·권한 매트릭스

#### T-CONV-008 — CommentController PATCH/DELETE + 가드 + e2e — ✅ done (2026-06-08)
- **context**: CONV / **priority**: 96 / **deps**: T-CONV-007 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `packages/api/src/conversation/comment.controller.ts`, `packages/api/src/conversation/dto/update-comment.dto.ts`, `packages/api/src/conversation/dto/create-comment.dto.ts`(COMMENT_BODY_MAX export), `packages/api/test/comment-moderation.e2e-spec.ts`(throttler 분리 위해 신규 spec)
- **acceptance**:
  1. `PATCH :id`·`DELETE :id` 에 `JwtAuthGuard`+`ThrottlerGuard`, actor 는 `req.user{id,role}`(JwtStrategy DB 재조회 — ADR-0018 §3). `UpdateCommentDto` class-validator(body 1~maxLen, 기존 CreateCommentDto 와 동일 상수 재사용). 신규/변경 e2e spec 은 `DATABASE_URL` 자체 기본값 미설정(jest-e2e.setup 강제 — 절대규칙 #8).
  2. e2e 수정 매트릭스: 본인 PATCH 200(+`isEdited`), 타인 403, 미인증 401, 없는 댓글 404, 익명 댓글 수정 시도 403.
  3. e2e 삭제 매트릭스: 본인/ADMIN/글쓴이 DELETE 204, 타인 403, 미인증 401. **soft(답글有) 후 GET 목록에 `isDeleted:true`+가림 4종(body/authorName/authorAvatarUrl/displayName)+답글 보존, hard(답글無) 후 노드 소멸 — 절대규칙 #9 쓰기-읽기 왕복 정규 증거.**
  4. e2e: 익명 댓글 운영자 DELETE 204, soft 삭제 부모에 답글 POST → 400.

### 스토리 S18.5 — 웹 UI

#### T-WEB-401 — 댓글 수정·삭제 UI + 훅
- **context**: WEB / **priority**: 97 / **deps**: T-CONV-008, T-CONV-005 / **tdd_first**: true / **예상**: 2h
- **변경 파일**: `packages/web/src/api/comments.ts`, `packages/web/src/components/comment/*`(CommentTree/CommentItem), `packages/web/src/pages/PostDetail.tsx`, `packages/web/e2e/*.spec.ts`
- **acceptance**:
  1. `useUpdateComment`·`useDeleteComment` 훅(`src/api/comments.ts`) — 성공 시 댓글 목록 쿼리 무효화(컴포넌트 직접 fetch 금지).
  2. 권한별 버튼 노출: `canEdit = user && comment.userId===user.id`, `canDelete = user && (comment.userId===user.id || user.role==='ADMIN' || user.id===postAuthorId)`. `postAuthorId` 는 PostDetail `authorId` 를 트리에 prop 전달.
  3. 수정: 인라인 폼 → PATCH → 목록 갱신, **"수정됨"**(`isEdited`) 표시. 삭제: 확인 → DELETE → 목록 갱신, soft 노드는 **"삭제된 댓글입니다"**(`isDeleted`) placeholder + 답글 유지.
  4. 회귀 없음: web unit + e2e GWT(작성→수정"수정됨"→답글有 삭제 시 트리 보존).

## 진행 순서 요약

```
T-CONV-005 (스키마·shared 타입)
   └─▶ T-CONV-006 (update + toDto 가림)
          └─▶ T-CONV-007 (remove 조건부 + 답글 차단)
                 └─▶ T-CONV-008 (PATCH/DELETE 컨트롤러 + e2e)
                        └─▶ T-WEB-401 (웹 수정·삭제 UI)
```

> 완료는 태스크별 `/finish T-CONV-00X`(검증→verifier→feature_list done→이 파일 동기화→handoff→commit). code-reviewer 가 commit 직전 자동 검토.
