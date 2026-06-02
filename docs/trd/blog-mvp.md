# TRD - blog-mvp

> 기술 명세. 입력: `docs/glossary.md`, `docs/prd/blog-mvp.md`, `docs/bounded-contexts.md`.
> 용어와 Context 경계는 위 문서와 일관성을 유지한다. 구현 코드는 포함하지 않는다.

## 확정된 핵심 결정 (인터뷰)

| # | 결정 | 선택 |
|---|---|---|
| ① | 운영자 JWT 저장 | **httpOnly 쿠키** (SameSite로 CSRF 대응) |
| ② | 운영자 계정 생성 | **시드 스크립트 + 환경변수** (공개 가입 없음) |
| ③ | Post 본문 | **마크다운 저장 → 렌더 시 sanitize** |
| ④ | 공유 타입 | **`packages/shared`에 순수 TS 타입 계약** (검증은 각자) |

## 1. 아키텍처 개요

```
            ┌─────────────────────────────────────────────┐
            │  Browser                                     │
            │  ┌──────────────┐    ┌────────────────────┐  │
   독자 ───▶│  │ 독자 화면     │    │ 운영자 화면(인증)   │  │◀── 운영자
            │  │ (읽기/댓글)   │    │ (작성/관리)         │  │
            │  └──────┬───────┘    └─────────┬──────────┘  │
            └─────────┼──────────────────────┼─────────────┘
                      │  axios + TanStack Query (HTTP/JSON)
                      │  운영자 요청: httpOnly 쿠키(JWT) 동봉
                      ▼                      ▼
            ┌─────────────────────────────────────────────┐
            │  NestJS API (packages/api)                   │
            │  ┌────────────┐ ┌──────────────┐ ┌────────┐  │
            │  │ Publishing │ │ Conversation │ │  Auth  │  │
            │  │  Module    │ │   Module     │ │ Module │  │
            │  └─────┬──────┘ └──────┬───────┘ └───┬────┘  │
            │        └───────────────┴─────────────┘       │
            │              Prisma Client                   │
            └──────────────────────┬──────────────────────┘
                                   ▼
                          ┌─────────────────┐
                          │  PostgreSQL     │
                          └─────────────────┘

   packages/shared: 프론트·백엔드가 공유하는 TS 타입 계약 (DTO/응답)
```

- 단일 REST API. GraphQL 미사용(스캐폴딩 미설치).
- 모듈 경계 = Bounded Context 경계 (1:1). 모듈 간 참조는 ID 기반.

## 2. 백엔드 모듈 구조 (Bounded Context 1:1)

| 모듈 | Context | 책임 | 주요 구성 |
|---|---|---|---|
| `PublishingModule` | Publishing | Post CRUD·발행, Tag 분류·탐색, 이미지 업로드 | `PostController`, `PostService`, `TagService`(내부), `UploadController`, `StorageProvider`(Local/S3) |
| `ConversationModule` | Conversation | Comment 작성·조회, 2단계(깊이 2) 답글 | `CommentController`, `CommentService` |
| `AuthModule` | Auth | 운영자 로그인/로그아웃, JWT 발급·검증, 가드 | `AuthController`, `AuthService`, `JwtStrategy`, `JwtAuthGuard` |

- 쓰기 엔드포인트(Post 작성·수정·삭제·발행)는 `JwtAuthGuard`로 보호.
- 읽기 엔드포인트와 Comment 작성은 비인증 허용.
- `ConversationModule`은 Post 존재 확인을 위해 Publishing의 조회 인터페이스를 ID로 호출.

## 3. API 명세

기본 경로: `/api`. 응답은 JSON. 오류는 `{ statusCode, message, error }` 형태(NestExceptionFilter 표준).

### Auth

#### POST `/api/auth/login`
운영자 로그인. 성공 시 httpOnly 쿠키(`access_token`) 설정.

요청:
```json
{ "email": "owner@example.com", "password": "••••••••" }
```
응답 `200` (+ `Set-Cookie: access_token=...; HttpOnly; SameSite=Lax; Secure`):
```json
{ "user": { "id": "ckx...", "email": "owner@example.com" } }
```
오류 `401`:
```json
{ "statusCode": 401, "message": "이메일 또는 비밀번호가 올바르지 않습니다.", "error": "Unauthorized" }
```

#### POST `/api/auth/logout`
쿠키 만료. 응답 `200` `{ "success": true }`.

#### GET `/api/auth/me`
현재 운영자 확인(쿠키 기반). 응답 `200` `{ "user": { "id": "...", "email": "..." } }` / 비로그인 `401`.

### Publishing - Post

#### GET `/api/posts`  (공개)
발행된 Post 목록 (최신순, 페이지네이션).

쿼리: `?page=1&pageSize=10&tag=nestjs`(tag 선택)

응답 `200`:
```json
{
  "items": [
    { "id": "ckp1", "title": "첫 글", "summary": "요약...", "tags": ["nestjs"], "publishedAt": "2026-06-01T09:00:00.000Z" }
  ],
  "page": 1, "pageSize": 10, "total": 1
}
```

#### GET `/api/posts/:id`  (공개)
발행된 Post 상세. 초안은 비인증 시 `404`.

응답 `200`:
```json
{
  "id": "ckp1", "title": "첫 글", "contentMarkdown": "# 안녕\n본문...",
  "tags": ["nestjs"], "status": "PUBLISHED",
  "authorId": "cku1", "publishedAt": "2026-06-01T09:00:00.000Z",
  "createdAt": "2026-05-30T12:00:00.000Z", "updatedAt": "2026-06-01T09:00:00.000Z"
}
```

#### POST `/api/posts`  (운영자)
Post 생성(초안). 요청:
```json
{ "title": "새 글", "contentMarkdown": "# 제목\n본문", "tags": ["nestjs", "ddd"] }
```
응답 `201`: 생성된 Post(상세와 동일, `status: "DRAFT"`). 검증 실패 `400`.

#### PATCH `/api/posts/:id`  (운영자)
Post 수정. 요청(부분):
```json
{ "title": "수정된 제목", "contentMarkdown": "...", "tags": ["ddd"] }
```
응답 `200`: 수정된 Post. 없음 `404`.

#### POST `/api/posts/:id/publish`  (운영자)
발행. 응답 `200`: `status: "PUBLISHED"`, `publishedAt` 설정. → 이벤트 `PostPublished`.

#### POST `/api/posts/:id/unpublish`  (운영자)
발행 취소. 응답 `200`: `status: "DRAFT"`. → 이벤트 `PostUnpublished`.

#### DELETE `/api/posts/:id`  (운영자)
삭제. 응답 `204`. → 이벤트 `PostDeleted`.

### Publishing - Tag

#### GET `/api/tags`  (공개)
사용 중인 Tag 목록과 발행 Post 수.
응답 `200`: `[ { "name": "nestjs", "postCount": 3 } ]`

(Tag별 Post 목록은 `GET /api/posts?tag=` 로 처리)

### Publishing - Upload (이미지)

#### POST `/api/uploads`  (운영자)
이미지 업로드. `multipart/form-data`의 `file` 필드. 저장은 `StorageProvider`(로컬 → S3 확장, ADR-0012)를 통하며, 접근 URL을 반환한다.

요청: `multipart/form-data` — `file=<이미지 바이너리>`

응답 `201`:
```json
{ "url": "/uploads/2026/06/cku-abc123.png", "contentType": "image/png", "size": 20480 }
```
검증/오류:
- 이미지 MIME 화이트리스트 외 → `400`.
- 크기 상한 초과 → `413` (상한값 `[TBD]`).
- 미인증 → `401`.

운영자는 반환된 `url`을 본문 마크다운에 `![대체텍스트](url)`로 임베드한다. 로컬 저장 파일은 운영 환경에서 nginx 정적 경로(`/uploads/`)로 서빙한다.

### Conversation - Comment

#### GET `/api/posts/:postId/comments`  (공개)
해당 Post의 Comment 목록 (답글 깊이 2까지 중첩 포함, 작성순).

응답 `200` (depth 0 → 1 → 2 중첩):
```json
[
  {
    "id": "ckc1", "postId": "ckp1", "parentId": null, "depth": 0,
    "displayName": "익명", "body": "좋은 글이네요",
    "createdAt": "2026-06-01T10:00:00.000Z",
    "replies": [
      {
        "id": "ckc2", "postId": "ckp1", "parentId": "ckc1", "depth": 1,
        "displayName": "운영자", "body": "감사합니다",
        "createdAt": "2026-06-01T10:05:00.000Z",
        "replies": [
          { "id": "ckc3", "postId": "ckp1", "parentId": "ckc2", "depth": 2, "displayName": "방문자", "body": "저도요", "createdAt": "2026-06-01T10:10:00.000Z", "replies": [] }
        ]
      }
    ]
  }
]
```

#### POST `/api/posts/:postId/comments`  (공개, 익명)
Comment 작성. `parentId` 지정 시 답글(깊이 2까지). 요청:
```json
{ "body": "댓글 내용", "displayName": "방문자", "parentId": null }
```
응답 `201`: 생성된 Comment. → 이벤트 `CommentPosted`.

검증/제약:
- `body` 필수, 최대 길이 `[TBD: 예 1000자]`(S1).
- 부모의 깊이를 계산해 **결과 깊이가 2를 초과하면 `400`** (깊이 3 이상 금지 — ADR-0013).
- 대상 Post가 미발행/없음 → `404`.

## 4. DB 스키마 (Prisma)

```prisma
// datasource/generator는 기존 schema.prisma 유지 (postgresql)

enum PostStatus {
  DRAFT
  PUBLISHED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  posts        Post[]

  @@map("users")
}

model Post {
  id              String     @id @default(cuid())
  title           String
  contentMarkdown String
  status          PostStatus @default(DRAFT)
  publishedAt     DateTime?
  authorId        String
  author          User       @relation(fields: [authorId], references: [id])
  postTags        PostTag[]
  comments        Comment[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([status, publishedAt])
  @@map("posts")
}

model Tag {
  id       String    @id @default(cuid())
  name     String    @unique
  postTags PostTag[]

  @@map("tags")
}

// Post ↔ Tag 다대다 (glossary: PostTag 조인 테이블)
model PostTag {
  postId String
  tagId  String
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}

model Comment {
  id          String    @id @default(cuid())
  postId      String
  post        Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  parentId    String?   // 답글 관계 (깊이 2까지 — 애플리케이션에서 강제, ADR-0013)
  parent      Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies     Comment[] @relation("CommentReplies")
  displayName String?   // 익명 독자 표시 이름(선택)
  body        String
  createdAt   DateTime  @default(now())

  @@index([postId])
  @@map("comments")
}
```

설계 메모:
- 발행 상태는 `PostStatus` enum + `publishedAt`(정렬·표시용)으로 표현.
- Comment 깊이 2 제약은 스키마로 강제 불가 → 서비스 계층에서 부모 체인 깊이를 계산해 검증(ADR-0013).
- `authorId`는 ID 참조(Aggregate 경계 준수). Comment는 `postId`만 참조(Auth 비의존).
- 익명 Comment는 `authorId` 없음, `displayName` 선택.
- 이미지는 별도 엔티티 없이 마크다운 URL로 본문에 임베드(ADR-0012) → DB 스키마 변경 없음. 저장 메타는 파일시스템/오브젝트 스토리지에 위임.

## 5. 프론트엔드 라우트와 페이지

| 라우트 | 페이지 | 접근 | 주요 동작 |
|---|---|---|---|
| `/` | Post 목록 | 공개 | `GET /api/posts` (페이지네이션) |
| `/posts/:id` | Post 상세 + Comment | 공개 | Post 상세 + 댓글 깊이 2 중첩 조회/작성, 마크다운 렌더(이미지 포함, sanitize) |
| `/tags/:name` | Tag별 Post 목록 | 공개 | `GET /api/posts?tag=` |
| `/login` | 운영자 로그인 | 공개 | `POST /api/auth/login` |
| `/admin` | 운영자 대시보드(Post 목록·초안 포함) | 운영자 | 보호 라우트 |
| `/admin/posts/new` | Post 작성 | 운영자 | `POST /api/posts`, 이미지 업로드(`POST /api/uploads`) 후 마크다운 임베드 |
| `/admin/posts/:id/edit` | Post 수정·발행 | 운영자 | `PATCH`, `publish`/`unpublish`, 이미지 업로드 |

- 상태: 서버 상태는 TanStack Query, 인증 UI 상태(로그인 여부)는 zustand.
- 폼: react-hook-form + zod(프론트 검증).
- 보호 라우트: `GET /api/auth/me` 로 세션 확인 후 게이트.
- 스타일: Tailwind 4 (반응형 NF5, a11y NF4 고려한 시맨틱 마크업).

## 6. 공유 타입 (`packages/shared`)

검증 도구가 아닌 **타입 계약**만 둔다(결정 ④). 예시 export(구현 아님):

```
- PostStatus           // 'DRAFT' | 'PUBLISHED'
- PostSummaryDto        // 목록 항목
- PostDetailDto         // 상세
- CreatePostDto / UpdatePostDto
- CommentDto            // depth + replies(깊이 2까지 중첩) 포함
- CreateCommentDto      // body, displayName?, parentId?
- TagDto                // { name, postCount }
- AuthUserDto           // { id, email }
- UploadResultDto       // { url, contentType, size }
- Paginated<T>          // { items, page, pageSize, total }
```

- api는 이 타입을 참조해 class-validator DTO를 구현, web은 zod 스키마를 구현(각자 검증).
- 빌드 순서: shared → api/web (pnpm workspace 의존).

## 7. 외부 의존성 (선택과 이유)

이미 설치된 것(스캐폴딩) 외, 추가로 필요한 라이브러리:

| 라이브러리 | 위치 | 이유 |
|---|---|---|
| `cookie-parser` | api | httpOnly 쿠키 파싱(결정 ①) |
| `@nestjs/throttler` | api | Comment 익명 스팸 방지(레이트 리밋, NF1) |
| `react-markdown` + `rehype-sanitize` | web | 마크다운 렌더(이미지 포함) + XSS 새니타이즈(결정 ③, NF1) |
| `multer`(`@nestjs/platform-express` 내장) | api | 이미지 multipart 업로드 처리(ADR-0012) |

이미지 저장은 MVP에서 로컬 파일시스템(추가 의존성 없음). S3 확장 시 `@aws-sdk/client-s3`를 `S3StorageProvider`에 추가(ADR-0012).

이미 활용:
- 인증: `@nestjs/jwt`, `passport-jwt`, `bcrypt` (스캐폴딩).
- 검증: `class-validator`/`class-transformer`(api), `zod`(web).
- 데이터: `@prisma/client` + PostgreSQL.

## 8. 보안 처리

- **NF1 XSS**: Comment `body`는 텍스트로 저장, 렌더 시 이스케이프. Post 마크다운은 `rehype-sanitize`로 위험 태그/속성 제거(안전한 `img` `src`만 허용).
- **NF6 업로드 안전성**: `POST /api/uploads`는 `JwtAuthGuard` 보호(운영자 전용). 이미지 MIME 화이트리스트 + 크기 상한 검증. 저장 파일명은 추측 불가능하게 생성(경로 traversal 차단).
- **NF1 인증 보호**: JWT는 httpOnly + Secure + SameSite=Lax 쿠키. 토큰은 JS 비노출.
- **NF2 권한 분리**: 모든 쓰기(Post 작성·수정·삭제·발행)에 `JwtAuthGuard`. 미인증 요청 `401`.
- **비밀번호**: bcrypt 해시(`passwordHash`), 평문 미저장. 운영자 계정은 시드+환경변수(결정 ②).
- **스팸**: `@nestjs/throttler`로 Comment POST 레이트 리밋 + `body` 길이 상한(S1).
- **CSRF**: SameSite=Lax로 1차 방어. 필요 시 CSRF 토큰 [TBD — 오픈 이슈].
- **입력 검증**: 모든 요청 DTO에 class-validator. 화이트리스트(`forbidNonWhitelisted`).

## 9. 테스트 전략

| 레벨 | 도구 | 대상 |
|---|---|---|
| 단위 | Jest(api) | Service 로직: 발행 상태 전이, Comment 깊이 2 제약, Tag 부착 0~5, StorageProvider(Local) |
| 통합/E2E(API) | Jest + supertest(api) | 엔드포인트 인증 가드, 404/401, 페이지네이션, 업로드 타입·크기 거부 |
| 컴포넌트 | Vitest + Testing Library(web) | 폼 검증, 마크다운 렌더(이미지 포함) sanitize, 댓글 중첩 렌더 |
| E2E(브라우저) | Playwright(web) | 운영자 로그인→작성→이미지 업로드→발행, 독자 읽기→깊이 2 댓글 흐름 |

핵심 케이스: 미발행 Post 비노출, 답글 깊이 3 거부, XSS 페이로드 무력화(img 포함), 비인증 쓰기/업로드 차단, 비이미지 업로드 거부.

## 10. 주요 결정 → ADR (작성 완료, `docs/adr/`)

| ADR | 결정 | 상태 |
|---|---|---|
| 0001 | 운영자 JWT를 httpOnly 쿠키로 저장 | Accepted |
| 0002 | 운영자 계정 시드+환경변수 부트스트랩 | Accepted |
| 0003 | Post 본문 마크다운 저장 + 렌더 시 sanitize | Accepted |
| 0004 | 공유 타입은 순수 TS 계약, 검증은 각 패키지 | Accepted |
| 0005 | 발행 상태를 enum + publishedAt으로 표현 | Accepted |
| 0006 | Tag를 별도 테이블 + PostTag 조인으로 모델링 | Accepted |
| 0007 | Comment 1단계 답글 강제 | Superseded by 0013 |
| 0008 | REST API 채택 | Accepted |
| 0009 | 익명 Comment 스팸 방지(throttler + 길이 제한) | Accepted |
| 0010 | 페이지네이션 offset/page 기반 | Accepted |
| 0011 | Docker Compose 베이스+dev/prod, 멀티스테이지 | Accepted |
| 0012 | 이미지 업로드 저장소 추상화(로컬 → S3) | Accepted |
| 0013 | Comment 답글 깊이 2까지 허용 | Accepted |

## 오픈 이슈 (TRD 범위)

- [TBD] Comment `body` 최대 길이 확정값(S1, PRD에서 이월).
- [TBD] CSRF 토큰 추가 도입 여부(SameSite만으로 충분한지).
- [TBD] NF3 읽기 성능 목표 수치와 캐싱 전략 필요 여부(PRD에서 이월).
- [TBD] 지표 측정 수단(분석 도구) 도입 여부(PRD에서 이월).
- [TBD] 이미지 업로드 허용 MIME 화이트리스트와 크기 상한값(PRD M10에서 이월).
- [TBD] 업로드 이미지 미사용 파일 정리(가비지 컬렉션) 시점·방식(ADR-0012).
