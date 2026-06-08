# TRD — author-profile (공개 작성자 프로필)

> Phase 4 산출물. 입력: `docs/prd/author-profile.md`, `docs/glossary.md`, `docs/bounded-contexts.md`.
> 구현 코드는 작성하지 않는다(Phase 7). 주요 결정은 ADR-0028 로 분리한다(ADR-0025 amend/supersede 포함).

## 1. 아키텍처 개요

새 BC·새 모듈 없이 Auth(User.bio + 공개 프로필 읽기)와 Publishing(작성자별 발행글 목록)을 확장한다. **작성자 프로필 페이지 조립은 web 프레젠테이션**이 두 읽기 API 를 합쳐 수행한다 — Auth 는 Publishing 을 의존하지 않는다(최하위 불변식 유지).

```
   web /users/:id (프로필 페이지)
        │  ① 프로필 메타            │  ② 작성자 발행글 목록
        ▼                           ▼
   GET /api/users/:id          GET /api/posts?author=:id&page=
   (AuthModule, 공개)          (PublishingModule, 기존 목록에 author 필터)
        │                           │
        ▼                           ▼
   User 조회(이메일 제외)       listPublished({ authorId }) — 발행글만
   + 발행글 수 count            (초안 제외, 기존 정렬·페이지네이션 ADR-0010)
```

## 2. 백엔드 모듈 구조 (BC 1:1)

| 요소 | 모듈 | 추가 |
|---|---|---|
| `UserController` (공개, `@Controller('users')`) | AuthModule | `GET /api/users/:id` — 공개 작성자 프로필(AuthorProfileDto). 없으면 404. 기존 `admin/users` 와 별개 컨트롤러. |
| `UserService`/`AuthService` | AuthModule | `getPublicProfile(id)` — User 조회(이메일 제외) + 발행글 수 count. |
| `PostController`/`PostService` | PublishingModule | `listPublished` 에 `authorId` 필터 추가(기존 q·tag 와 동형). |
| `AuthController` (기존) | AuthModule | `PATCH /api/auth/me` 가 `bio` 도 수용(UpdateProfileDto amend). |

> 공개 프로필 메타는 AuthModule, 발행글 목록은 PublishingModule. **조립은 web** — Auth→Publishing 역결합 없음.

## 3. API 명세

### 3.1 `GET /api/users/:id` (공개 작성자 프로필)
- 요청: `GET /api/users/:id` (공개, 인증 불필요). id = `User.id`(cuid).
- 응답 200 (AuthorProfileDto):
```json
{ "id": "clx123", "name": "홍길동", "avatarUrl": "/uploads/a.jpg",
  "bio": "백엔드 개발자입니다", "createdAt": "2026-01-01T00:00:00.000Z", "postCount": 12 }
```
- **이메일 절대 비노출**. `bio` 없으면 `null`. 발행글 수(`postCount`)는 `status:PUBLISHED` count 1회.
- 없는 id → 404. (전 User 대상 — MEMBER 도 조회 가능, postCount 0 가능)

### 3.2 `GET /api/posts?author=:id` (작성자 발행글 목록 — 기존 확장)
- 기존 `GET /api/posts?page=&pageSize=&tag=&q=` 에 `author=:id`(작성자 User.id) 추가.
- 발행글만, `publishedAt` 최신순, 페이지네이션(ADR-0010). 초안·미발행 제외.
- `ListPostsQueryDto` 에 `author?: string`(작성자 User.id) 추가(tag·q 와 동형, class-validator). 없는 author id → **빈 목록 200**(tag 미존재와 동일 처리).
- 응답: `Paginated<PostSummaryDto>` (기존과 동일, 단 PostSummaryDto 에 `authorId` 추가 — §6).

### 3.3 `PATCH /api/auth/me` (bio 편집 — 기존 amend)
- 기존 `{ name?, avatarUrl? }` 에 `bio?: string|null` 추가(UpdateProfileDto amend — ADR-0025→0028).
- 본인만(인증). bio 길이 상한 200자(class-validator). 빈 문자열/`null` 허용(소개 제거).
- 응답: 갱신된 `{ user }`(AuthUserDto 에 bio 포함).

## 4. DB 스키마 (Prisma)

`User` 에 **nullable 컬럼 1개 추가**(추가 전용 마이그레이션):
```prisma
model User {
  // ... 기존 ...
  avatarUrl String?
  bio       String?  // 작성자 소개 (ADR-0028). 선택, 최대 200자(api 검증)
  // ...
}
```
- 인덱스 불필요. `Post` 조회는 기존 `authorId`(FK) — `listPublished` 의 author 필터용 인덱스 확인(없으면 ADR-0028 에서 판단, posts 는 `@@index` 검토).
- dev `blog` + test `blog_test` 적용. `check_migration_destructive` 비파괴 확인.

## 5. 프론트엔드 (web)

- **신규 페이지 `/users/:id`** (`pages/AuthorProfile.tsx`): 프로필 헤더(Avatar·이름·bio·가입일·글수) + 작성자 발행글 목록(기존 PostListView/카드 재사용, `?author=:id`). 빈 목록 시 "아직 발행한 글이 없습니다"(S1). 라우트 등록.
- **훅**: `useAuthorProfile(id)`(GET /api/users/:id), 목록은 기존 `usePosts({ author })` 확장.
- **작성자 링크(M3)**: 글 목록 카드·상세 헤더의 작성자 이름을 `<Link to={'/users/' + authorId}>` 로. `authorId` 는 PostSummaryDto/PostDetailDto 에서(상세는 이미 authorId, 목록은 §6 추가).
- **bio 편집**: `/profile`(Profile.tsx)에 소개(bio) textarea 추가 → PATCH /api/auth/me. 폼 검증은 web 로컬 zod 인라인(Register.tsx 선례 — 함정 #9, shared 에 zod 값 금지).

## 6. 공유 타입 (packages/shared)

- 신규 `AuthorProfileDto { id, name, avatarUrl: string|null, bio: string|null, createdAt: string, postCount: number }` (이메일 없음 — 공개).
- `PostSummaryDto` 에 `authorId: string` 추가(작성자 링크용 — M3). 신규 필드라 `toSummary` 직렬화에 `authorId` 매핑 + 기존 응답 필드 무변경 회귀를 별도 검증한다.
- `AuthUserDto` 에 `bio: string|null` 추가(me 응답, 본인 편집 반영).
- `UpdateProfileDto` 에 `bio?: string|null` 추가(amend). 폼 zod 는 web 인라인(함정 #9 — shared 순수 타입만).
- 서버 검증은 api class-validator(UpdateProfileDto 클래스 bio @MaxLength(200)).

## 7. 외부 의존성

**추가 없음.** 기존 Prisma·class-validator·TanStack Query·React Router 재사용.

## 8. 보안 처리

- **이메일 비노출**: AuthorProfileDto·작성자 목록 모두 email 제외(name·avatarUrl·bio 만). User 조회 시 `select` 로 email 배제.
- **발행 격리**: 작성자 목록·postCount 모두 `status:PUBLISHED` 강제(초안·미발행 비노출).
- **bio XSS**: bio 는 평문 저장·표시(렌더 시 React 기본 escape, dangerouslySetInnerHTML 금지). 길이 상한 200.
- **Auth 최하위 유지**: 공개 프로필(AuthModule)이 Publishing 을 호출하지 않음(목록은 별도 API, web 조합).
- **id 열거**: cuid 노출(내부 식별자)이나 열거 난도 높음. 공개 프로필은 공개 정보만이라 위험 낮음.

## 9. 주요 결정 → ADR-0028 분리 (Phase 5)

ADR-0028 **(author-profile: 공개 작성자 프로필)** 하나로 묶는다:
1. 새 BC·모듈 없이 Auth(User.bio + 공개 프로필) + Publishing(authorId 필터) 확장.
2. URL 식별자 = `User.id`(cuid). 핸들(username)은 범위 외.
3. `User.bio` nullable 추가(추가 전용), 상한 200자.
4. 프로필 메타(`/api/users/:id`, Auth)와 작성자 목록(`/api/posts?author=`, Publishing) **분리** + web 조합 → Auth 최하위 불변식 유지.
5. `PostSummaryDto` 에 `authorId` 노출(작성자 링크 M3).
6. **ADR-0025 amend**: `UpdateProfileDto` 에 bio 추가. **supersede**: ADR-0025 "범위 외: 공개 프로필 페이지" 항목(이번에 구현).
7. 이메일 비노출·발행 격리.

## 10. 테스트 전략

- **api 단위**: `getPublicProfile`(이메일 제외·postCount·없으면 404), `listPublished({author})`(작성자 발행글만·초안 제외·N+1 없음), UpdateProfileDto bio 검증.
- **api e2e**: `GET /api/users/:id` 200 + 이메일 0 + postCount 정확, 없는 id 404. `GET /api/posts?author=:id` 발행글만·타 작성자 글 제외. `PATCH /api/auth/me` bio 왕복(편집→me 반영). bio 201자 400.
- **web 단위**: AuthorProfile 렌더(프로필 헤더·빈상태), 작성자 이름 링크(`/users/:authorId`), Profile bio 편집.
- **회귀**: 기존 목록(q·tag)·프로필(name·avatar)·상세 무회귀. PostSummaryDto 에 authorId 추가 시 기존 필드 무변경 확인.
- **아바타 정합(#9)**: AuthorProfileDto.avatarUrl 이 가리키는 `/uploads` 경로가 실제 200 으로 서빙되는지 — 기존 아바타 검증(ADR-0025) 재사용.

## 11. 오픈 이슈 (Phase 5/6 확정)

1. (확정) 메타·목록 분리 + web 조합(BC W2).
2. `posts.authorId` 인덱스: author 필터 조회 성능 — 현재 인덱스 유무 확인 후 ADR-0028/마이그레이션에서 판단(check_index).
3. bio 상한 200자 확정(ADR-0028).
4. `usePosts` 훅에 author 파라미터 추가 방식(기존 시그니처 확장).

---
*작성: Phase 4 (/trd). 다음: Phase 5 `/adr`(ADR-0028) → Phase 6 `/tasks`. 검토: plan-critic 독립 검토 후 사용자 확인.*
