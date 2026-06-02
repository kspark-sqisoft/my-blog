# Tasks - blog-mvp

> 입력: `docs/trd/blog-mvp.md` (+ glossary / bounded-contexts / adr).
> 계층: **에픽 → 스토리 → 태스크**. 각 태스크는 30분~2시간, 단일 Bounded Context, TDD 우선.
> Context 약어: PUB=Publishing, CONV=Conversation, AUTH=Auth, INFRA=공통/인프라, WEB=프론트.
> status: todo / in_progress / done. 모든 신규 기능은 `tdd_first: true`.

## 의존성 개요 (priority 순)

```
E0 기반(INFRA) → E1 Auth → E2 Publishing(Post/Tag) → E3 Upload → E4 Conversation(Comment)
                                       └────────────→ E5 Web(읽기/운영자/댓글/이미지)
```
프론트(E5)는 해당 API 스토리가 끝난 뒤 병렬 진행 가능.

---

## E0. 프로젝트 기반 (INFRA)

### S0.1 Prisma 스키마 + DB 부트스트랩

#### T-INFRA-001 — Prisma 스키마 정의 (User/Post/Tag/PostTag/Comment + PostStatus)
- priority: 1
- 변경 파일: `packages/api/prisma/schema.prisma`
- acceptance criteria:
  1. `PostStatus` enum(DRAFT/PUBLISHED)과 5개 모델이 TRD §4와 동일하게 정의된다.
  2. `prisma validate`가 통과한다.
  3. `prisma migrate dev`로 초기 마이그레이션이 생성되고 테이블이 만들어진다.
  4. Comment는 `parentId` 자기참조와 `@@index([postId])`를 가진다.
- 예상: 1h
- 의존: 없음
- status: todo
- tdd_first: true (스키마는 마이그레이션 적용 검증으로 대체)

#### T-INFRA-002 — PrismaService + 모듈 와이어링
- priority: 2
- 변경 파일: `packages/api/src/prisma/prisma.service.ts`, `packages/api/src/prisma/prisma.module.ts`, `packages/api/src/app.module.ts`
- acceptance criteria:
  1. `PrismaService`가 `OnModuleInit`에서 connect 한다.
  2. `PrismaModule`이 글로벌로 export 되어 다른 모듈에서 주입 가능하다.
  3. 통합 테스트에서 `prisma.$queryRaw\`SELECT 1\``가 성공한다.
- 예상: 1h
- 의존: T-INFRA-001
- status: todo
- tdd_first: true

#### T-INFRA-003 — 공유 타입 패키지 스캐폴드 (packages/shared)
- priority: 3
- 변경 파일: `packages/shared/src/index.ts`, `packages/shared/src/dto/*.ts`
- acceptance criteria:
  1. TRD §6의 타입 계약(PostStatus, PostSummaryDto, PostDetailDto, Create/UpdatePostDto, CommentDto, CreateCommentDto, TagDto, AuthUserDto, UploadResultDto, Paginated<T>)이 export 된다.
  2. `pnpm --filter shared build`(또는 tsc)가 타입 오류 없이 통과한다.
  3. api/web에서 `@my-blog/shared`(workspace) import가 해석된다.
- 예상: 1h
- 의존: 없음
- status: todo
- tdd_first: false (순수 타입 선언)

#### T-INFRA-004 — 전역 ValidationPipe + 예외 응답 포맷 + cookie-parser
- priority: 4
- 변경 파일: `packages/api/src/main.ts`, `packages/api/src/common/*`
- acceptance criteria:
  1. `ValidationPipe`가 `whitelist`+`forbidNonWhitelisted`로 전역 적용된다.
  2. 검증 실패 시 `{ statusCode, message, error }` 형태 400을 반환한다(e2e 확인).
  3. `cookie-parser`가 적용되어 `req.cookies`를 읽는다.
- 예상: 1h
- 의존: T-INFRA-002
- status: todo
- tdd_first: true

---

## E1. 운영자 인증 (AUTH)

### S1.1 인증 도메인·발급

#### T-AUTH-001 — User 시드 스크립트 (환경변수 부트스트랩, bcrypt)
- priority: 5
- 변경 파일: `packages/api/prisma/seed.ts`, `packages/api/package.json`(seed script)
- acceptance criteria:
  1. `OPERATOR_EMAIL`/`OPERATOR_PASSWORD`로 User 1건을 생성하고 `passwordHash`는 bcrypt 해시다(평문 미저장).
  2. 재실행 시 동일 email은 upsert로 중복 생성하지 않는다.
  3. 시드 후 DB에 User가 정확히 1건 존재한다(테스트).
- 예상: 1h
- 의존: T-INFRA-002
- status: todo
- tdd_first: true

#### T-AUTH-002 — AuthService: 자격 검증 + JWT 발급
- priority: 6
- 변경 파일: `packages/api/src/auth/auth.service.ts`, `auth.service.spec.ts`
- acceptance criteria:
  1. 올바른 email/password → JWT(서명) 문자열을 반환한다.
  2. 비밀번호 불일치 → `UnauthorizedException`.
  3. 존재하지 않는 email → `UnauthorizedException`(동일 메시지로 사용자 열거 방지).
- 예상: 1.5h
- 의존: T-AUTH-001
- status: todo
- tdd_first: true

#### T-AUTH-003 — JwtStrategy + JwtAuthGuard (쿠키에서 토큰 추출)
- priority: 7
- 변경 파일: `packages/api/src/auth/jwt.strategy.ts`, `packages/api/src/auth/jwt-auth.guard.ts`, `*.spec.ts`
- acceptance criteria:
  1. `access_token` 쿠키에서 JWT를 추출해 검증한다.
  2. 유효 토큰 → `req.user`에 `{ id, email }` 주입.
  3. 토큰 없음/위조/만료 → 401.
- 예상: 1.5h
- 의존: T-AUTH-002, T-INFRA-004
- status: todo
- tdd_first: true

### S1.2 인증 API

#### T-AUTH-004 — AuthController: login/logout/me (httpOnly 쿠키)
- priority: 8
- 변경 파일: `packages/api/src/auth/auth.controller.ts`, `auth.module.ts`, `test/auth.e2e-spec.ts`
- acceptance criteria:
  1. `POST /api/auth/login` 성공 시 `Set-Cookie: access_token=...; HttpOnly; SameSite=Lax`와 `{ user }`를 반환한다.
  2. `POST /api/auth/logout`이 쿠키를 만료시킨다.
  3. `GET /api/auth/me`는 유효 쿠키 시 `{ user }`, 비로그인 시 401.
- 예상: 1.5h
- 의존: T-AUTH-003
- status: todo
- tdd_first: true

---

## E2. 발행 (PUBLISHING — Post / Tag)

### S2.1 Post 도메인·쓰기

#### T-PUB-001 — PostService: 생성/수정/삭제 (초안 상태)
- priority: 9
- 변경 파일: `packages/api/src/publishing/post.service.ts`, `post.service.spec.ts`
- acceptance criteria:
  1. create 시 `status=DRAFT`, `authorId`가 설정된 Post를 반환한다.
  2. update는 title/contentMarkdown/tags 부분 수정을 반영한다.
  3. 존재하지 않는 id update/delete → `NotFoundException`.
- 예상: 1.5h
- 의존: T-INFRA-002, T-INFRA-003
- status: todo
- tdd_first: true

#### T-PUB-002 — PostService: 발행/발행취소 (상태 전이 + publishedAt)
- priority: 10
- 변경 파일: `packages/api/src/publishing/post.service.ts`, `post.service.spec.ts`
- acceptance criteria:
  1. publish → `status=PUBLISHED`, `publishedAt`이 설정된다.
  2. unpublish → `status=DRAFT`(publishedAt 처리 일관).
  3. 이미 발행/이미 초안 등 무의미한 전이는 안전하게 처리된다(idempotent or 명확한 동작).
- 예상: 1h
- 의존: T-PUB-001
- status: todo
- tdd_first: true

#### T-PUB-003 — TagService: Tag 부착(0~5) + PostTag 연결
- priority: 11
- 변경 파일: `packages/api/src/publishing/tag.service.ts`, `tag.service.spec.ts`
- acceptance criteria:
  1. Post에 Tag 0~5개를 연결하고, 동일 name Tag는 재사용(upsert)한다.
  2. Tag 6개 이상 → `BadRequestException`.
  3. Post 수정 시 Tag 집합이 교체된다(추가/제거 반영).
- 예상: 1.5h
- 의존: T-PUB-001
- status: todo
- tdd_first: true

### S2.2 Post 읽기

#### T-PUB-004 — PostService: 발행 목록(페이지네이션 + tag 필터)
- priority: 12
- 변경 파일: `packages/api/src/publishing/post.service.ts`, `post.service.spec.ts`
- acceptance criteria:
  1. `status=PUBLISHED`만 `publishedAt` 최신순으로 반환한다(초안 제외).
  2. `page`/`pageSize`로 페이지네이션되고 `total`을 포함한다.
  3. `tag` 지정 시 해당 Tag가 붙은 발행 Post만 반환한다.
- 예상: 1.5h
- 의존: T-PUB-002, T-PUB-003
- status: todo
- tdd_first: true

#### T-PUB-005 — PostService: 상세 조회(초안 비노출)
- priority: 13
- 변경 파일: `packages/api/src/publishing/post.service.ts`, `post.service.spec.ts`
- acceptance criteria:
  1. 발행 Post 상세를 `tags` 포함해 반환한다.
  2. 초안 Post를 비인증 컨텍스트로 조회하면 `NotFound`(404)로 취급한다.
  3. 없는 id → `NotFound`.
- 예상: 1h
- 의존: T-PUB-002
- status: todo
- tdd_first: true

### S2.3 Post/Tag API

#### T-PUB-006 — PostController: 쓰기 엔드포인트(가드) + 읽기 엔드포인트(공개)
- priority: 14
- 변경 파일: `packages/api/src/publishing/post.controller.ts`, `publishing.module.ts`, `test/post.e2e-spec.ts`
- acceptance criteria:
  1. `POST/PATCH/DELETE /api/posts`, `publish`/`unpublish`는 `JwtAuthGuard`로 보호(미인증 401).
  2. `GET /api/posts`, `GET /api/posts/:id`는 공개로 동작하며 응답이 TRD §3 예시와 일치한다.
  3. DELETE는 204, 생성은 201을 반환한다.
- 예상: 2h
- 의존: T-PUB-004, T-PUB-005, T-AUTH-003
- status: todo
- tdd_first: true

#### T-PUB-007 — TagController: GET /api/tags (사용 태그 + postCount)
- priority: 15
- 변경 파일: `packages/api/src/publishing/tag.controller.ts`, `test/tag.e2e-spec.ts`
- acceptance criteria:
  1. 발행 Post에 쓰인 Tag 목록과 `postCount`를 반환한다.
  2. 미사용 Tag는 제외(또는 count 0 정책 명시)된다.
  3. 공개 접근 가능(인증 불필요).
- 예상: 1h
- 의존: T-PUB-003, T-PUB-006
- status: todo
- tdd_first: true

---

## E3. 이미지 업로드 (PUBLISHING — Upload, ADR-0012)

### S3.1 저장소 추상화

#### T-PUB-101 — StorageProvider 인터페이스 + LocalStorageProvider
- priority: 16
- 변경 파일: `packages/api/src/publishing/storage/storage.provider.ts`, `local-storage.provider.ts`, `*.spec.ts`
- acceptance criteria:
  1. `StorageProvider.save(file)`가 추측 불가능한 파일명으로 저장하고 접근 URL을 반환한다.
  2. 저장 경로/URL 베이스는 환경변수로 주입된다.
  3. 경로 traversal 입력이 차단된다(상위 경로 탈출 불가).
- 예상: 1.5h
- 의존: T-INFRA-002
- status: todo
- tdd_first: true

#### T-PUB-102 — UploadController: POST /api/uploads (운영자, multer, 검증)
- priority: 17
- 변경 파일: `packages/api/src/publishing/upload.controller.ts`, `publishing.module.ts`, `test/upload.e2e-spec.ts`
- acceptance criteria:
  1. `JwtAuthGuard` 적용 — 미인증 401.
  2. 이미지 MIME 화이트리스트 외 → 400, 크기 상한 초과 → 413.
  3. 성공 시 201과 `{ url, contentType, size }` 반환.
- 예상: 1.5h
- 의존: T-PUB-101, T-AUTH-003
- status: todo
- tdd_first: true

---

## E4. 소통 (CONVERSATION — Comment, ADR-0013)

### S4.1 Comment 도메인

#### T-CONV-001 — CommentService: 작성 + 깊이 2 제약
- priority: 18
- 변경 파일: `packages/api/src/conversation/comment.service.ts`, `comment.service.spec.ts`
- acceptance criteria:
  1. 최상위 Comment(parentId 없음)와 답글(parentId 있음)을 작성할 수 있다.
  2. 부모 체인 깊이를 계산해 결과 깊이가 2를 초과하면 `BadRequestException`(깊이 3 거부).
  3. 대상 Post가 미발행/없음이면 `NotFound`(postId만 참조, Auth 비의존).
- 예상: 2h
- 의존: T-INFRA-002, T-PUB-005
- status: todo
- tdd_first: true

#### T-CONV-002 — CommentService: 목록 조회(깊이 2 중첩 직렬화)
- priority: 19
- 변경 파일: `packages/api/src/conversation/comment.service.ts`, `comment.service.spec.ts`
- acceptance criteria:
  1. 특정 Post의 Comment를 작성순으로, depth 0→1→2 중첩(`replies`)으로 반환한다.
  2. 각 노드에 `depth` 필드가 포함된다.
  3. 답글이 없는 노드의 `replies`는 빈 배열이다.
- 예상: 1.5h
- 의존: T-CONV-001
- status: todo
- tdd_first: true

### S4.2 Comment API + 스팸 방지

#### T-CONV-003 — CommentController + Throttler (작성 레이트 리밋, 길이 제한)
- priority: 20
- 변경 파일: `packages/api/src/conversation/comment.controller.ts`, `conversation.module.ts`, `test/comment.e2e-spec.ts`
- acceptance criteria:
  1. `GET/POST /api/posts/:postId/comments`가 공개로 동작하고 201/200 응답이 TRD 예시와 일치한다.
  2. `@nestjs/throttler`로 POST 레이트 리밋이 적용된다(초과 429).
  3. `body` 누락/길이 상한 초과 → 400.
- 예상: 1.5h
- 의존: T-CONV-002
- status: todo
- tdd_first: true

---

## E5. 프론트엔드 (WEB)

### S5.1 기반·인증 UI

#### T-WEB-001 — API 클라이언트(axios, withCredentials) + 라우터 + Query/Tailwind 설정
- priority: 21
- 변경 파일: `packages/web/src/lib/api.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- acceptance criteria:
  1. axios 인스턴스가 `baseURL=/api`, `withCredentials=true`로 설정된다.
  2. react-router로 TRD §5 라우트가 등록된다.
  3. TanStack Query Provider와 Tailwind가 동작한다(스모크 렌더 테스트).
- 예상: 1.5h
- 의존: T-INFRA-003
- status: todo
- tdd_first: true

#### T-WEB-002 — 로그인 페이지 + 보호 라우트 게이트(useAuth, zustand)
- priority: 22
- 변경 파일: `packages/web/src/pages/Login.tsx`, `src/auth/useAuth.ts`, `src/auth/ProtectedRoute.tsx`, `*.test.tsx`
- acceptance criteria:
  1. 로그인 폼(react-hook-form+zod) 제출 시 `POST /api/auth/login` 호출, 성공 시 `/admin` 이동.
  2. `GET /api/auth/me`로 세션 확인 후 미인증 시 `/admin/*`에서 `/login`으로 리다이렉트.
  3. 인증 실패 메시지가 표시된다.
- 예상: 2h
- 의존: T-WEB-001, T-AUTH-004
- status: todo
- tdd_first: true

### S5.2 독자 화면

#### T-WEB-003 — Post 목록 + Tag 필터 페이지
- priority: 23
- 변경 파일: `packages/web/src/pages/PostList.tsx`, `src/pages/TagPosts.tsx`, `*.test.tsx`
- acceptance criteria:
  1. `/`에서 `GET /api/posts`를 페이지네이션 UI와 함께 표시한다.
  2. `/tags/:name`에서 tag 필터 목록을 표시한다.
  3. 빈 목록/로딩/에러 상태가 처리된다.
- 예상: 1.5h
- 의존: T-WEB-001, T-PUB-006
- status: todo
- tdd_first: true

#### T-WEB-004 — Post 상세 + 마크다운 렌더(이미지 포함, sanitize)
- priority: 24
- 변경 파일: `packages/web/src/pages/PostDetail.tsx`, `src/components/Markdown.tsx`, `*.test.tsx`
- acceptance criteria:
  1. `react-markdown`+`rehype-sanitize`로 본문을 렌더하고 안전한 `img`만 허용한다.
  2. `<script>` 등 XSS 페이로드가 무력화된다(테스트).
  3. 발행일·Tag가 표시된다.
- 예상: 1.5h
- 의존: T-WEB-001, T-PUB-006
- status: todo
- tdd_first: true

#### T-WEB-005 — 댓글 UI(깊이 2 중첩 표시 + 작성 폼)
- priority: 25
- 변경 파일: `packages/web/src/components/CommentTree.tsx`, `src/components/CommentForm.tsx`, `*.test.tsx`
- acceptance criteria:
  1. depth 0→1→2 중첩 렌더, 깊이 2 답글에는 "답글 달기"가 비활성/숨김된다.
  2. 작성 폼 제출 시 `POST /api/posts/:postId/comments` 호출 후 목록 갱신.
  3. body 비었을 때 제출이 막힌다.
- 예상: 2h
- 의존: T-WEB-004, T-CONV-003
- status: todo
- tdd_first: true

### S5.3 운영자 화면

#### T-WEB-006 — 운영자 대시보드(초안 포함 목록) + 삭제/발행 토글
- priority: 26
- 변경 파일: `packages/web/src/pages/admin/Dashboard.tsx`, `*.test.tsx`
- acceptance criteria:
  1. 초안+발행 Post를 함께 보여준다(보호 라우트).
  2. 발행/발행취소/삭제 액션이 API를 호출하고 목록이 갱신된다.
  3. 비인증 접근 시 로그인으로 보낸다.
- 예상: 1.5h
- 의존: T-WEB-002, T-PUB-006
- status: todo
- tdd_first: true

#### T-WEB-007 — Post 작성·수정 에디터 + 이미지 업로드 임베드
- priority: 27
- 변경 파일: `packages/web/src/pages/admin/PostEditor.tsx`, `src/components/ImageUploadButton.tsx`, `*.test.tsx`
- acceptance criteria:
  1. 제목/본문(마크다운)/Tag 입력 폼이 create/update API와 연동된다.
  2. 이미지 선택 시 `POST /api/uploads` 호출 후 반환 URL을 본문에 `![](url)`로 삽입한다.
  3. Tag 6개 이상 입력 시 클라이언트 검증으로 막힌다(서버 400과 일치).
- 예상: 2h
- 의존: T-WEB-006, T-PUB-102
- status: todo
- tdd_first: true

### S5.4 E2E

#### T-WEB-008 — Playwright E2E: 운영자/독자 핵심 플로우
- priority: 28
- 변경 파일: `packages/web/e2e/operator-flow.spec.ts`, `packages/web/e2e/reader-flow.spec.ts`
- acceptance criteria:
  1. 운영자: 로그인→작성→이미지 업로드→발행 흐름이 통과한다.
  2. 독자: 목록→상세 읽기→깊이 2 댓글 작성 흐름이 통과한다.
  3. 미발행 Post가 독자 화면에 노출되지 않음을 검증한다.
- 예상: 2h
- 의존: T-WEB-005, T-WEB-007
- status: todo
- tdd_first: true (E2E 시나리오 우선 작성)

---

## 요약

| 에픽 | Context | 스토리 | 태스크 수 |
|---|---|---|---|
| E0 기반 | INFRA | 1 | 4 |
| E1 인증 | AUTH | 2 | 4 |
| E2 발행 | PUB | 3 | 7 |
| E3 업로드 | PUB | 1 | 2 |
| E4 소통 | CONV | 2 | 3 |
| E5 프론트 | WEB | 4 | 8 |
| **합계** | | **13** | **28** |

- 크리티컬 패스: T-INFRA-001 → 002 → AUTH-001~004 → PUB-001~006 → CONV-001~003.
- 병렬 가능: shared(T-INFRA-003)는 초기 병렬, WEB은 대응 API 완료 후 병렬.
- 모든 신규 기능 태스크는 `tdd_first: true` — acceptance criteria가 곧 Red 단계 입력.
