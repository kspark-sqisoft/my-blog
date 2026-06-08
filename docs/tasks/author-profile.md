# Tasks — author-profile (공개 작성자 프로필)

> Phase 6 산출물. 입력: `docs/trd/author-profile.md`, ADR-0028(ADR-0025 amend/supersede). 정규 상태는 `feature_list.json`(이 파일은 미러 — 절대규칙 #10).
> epic **E19**. context AUTH(프로필 메타·bio) + PUB(작성자 목록 필터) + WEB(페이지·링크). 모두 `tdd_first: true`.

## 에픽 E19 — 공개 작성자 프로필(author-profile)

새 BC·모듈 없음. Auth(User.bio + 공개 프로필) + Publishing(authorId 필터) 확장, 조립은 web(Auth 최하위 유지).

### 스토리 S19.1 — 스키마·공유 타입 토대

#### T-AUTH-012 — User.bio + posts 인덱스 마이그레이션 + shared 타입 — ✅ done (2026-06-08)
- **context**: AUTH / **priority**: 98 / **deps**: 없음 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/**`, `packages/shared/src/dto/auth.ts`·`profile.ts`·`post.ts`, 신규 `packages/shared/src/dto/author-profile.ts`(또는 user.ts), `packages/shared/src/index.ts`
- **acceptance**:
  1. `User.bio String?` 추가 + `posts @@index([authorId, status, publishedAt])` 추가. 추가 전용 마이그레이션(`check_migration_destructive` 비파괴, `check_index` 로 인덱스 반영 확인), dev `blog` + test `blog_test` 적용.
  2. shared 신규 `AuthorProfileDto { id; name; avatarUrl: string|null; bio: string|null; createdAt: string; postCount: number }`(이메일 없음) + index export.
  3. `PostSummaryDto.authorId: string`·`AuthUserDto.bio: string|null`·`UpdateProfileDto.bio?: string|null` 추가(순수 타입, zod 값 없음 — 함정 #9).
  4. shared 빌드 + 기존 사용처(api/web) 타입 통과(회귀 0).

### 스토리 S19.2 — 작성자별 발행글 목록 (Publishing)

#### T-PUB-107 — listPublished author 필터 + PostSummaryDto authorId 매핑
- **context**: PUB / **priority**: 99 / **deps**: T-AUTH-012 / **tdd_first**: true / **예상**: 1.5h
- **변경 파일**: `packages/api/src/publishing/post.service.ts`(+`.spec`), `packages/api/src/publishing/dto/list-posts.query.ts`, `packages/api/src/publishing/post.controller.ts`, `packages/api/test/post.e2e-spec.ts`
- **acceptance**:
  1. `listPublished({ authorId })`: 그 작성자의 발행글만, `publishedAt` 최신순·페이지네이션(ADR-0010), 초안 제외. 단일 쿼리(N+1 없음).
  2. `ListPostsQueryDto` 에 `author?: string` 추가 + 컨트롤러 전달. 없는 author → **빈 목록 200**(tag 미존재와 동일).
  3. `toSummary` 가 `authorId` 매핑, 기존 PostSummaryDto 필드 무변경(회귀).
  4. `GET /api/posts?author=:id` e2e: 그 작성자 발행글만 노출, 타 작성자 글·초안 제외(왕복).

### 스토리 S19.3 — 공개 프로필 조회 (Auth)

#### T-AUTH-013 — UserController GET /api/users/:id (공개 프로필)
- **context**: AUTH / **priority**: 100 / **deps**: T-AUTH-012 / **tdd_first**: true / **예상**: 1.5h
- **변경 파일**: `packages/api/src/auth/user.controller.ts`(신규, `@Controller('users')`), `packages/api/src/auth/user.service.ts`(또는 auth.service `getPublicProfile`)(+`.spec`), `packages/api/src/auth/auth.module.ts`, `packages/api/test/user.e2e-spec.ts`(신규)
- **acceptance**:
  1. `getPublicProfile(id)`: User 를 `select`(email 제외)로 조회 → `AuthorProfileDto`(id·name·avatarUrl·bio·createdAt·postCount). **이메일 절대 미포함**(단위).
  2. `postCount` = 그 작성자의 `status:PUBLISHED` count(1회 쿼리, N+1 없음).
  3. 없는 id → `NotFoundException`(404). 전 User 대상(MEMBER 도 조회, postCount 0 가능).
  4. `GET /api/users/:id` e2e: 발행글 N개 작성자 postCount=N, 응답에 email 0(왕복). avatarUrl 이 있으면 그 `/uploads` 경로가 200 서빙(기존 아바타 검증 재사용 — ADR-0025, #9). 신규 e2e spec 은 DATABASE_URL 자체 기본값 미설정(#8).

### 스토리 S19.4 — bio 편집 (Auth, ADR-0025 amend)

#### T-AUTH-014 — PATCH /api/auth/me bio amend
- **context**: AUTH / **priority**: 101 / **deps**: T-AUTH-012 / **tdd_first**: true / **예상**: 1h
- **변경 파일**: `packages/api/src/auth/dto/update-profile.dto.ts`(bio @MaxLength 200), `packages/api/src/auth/auth.controller.ts`·`auth.service.ts`(bio 반영), `packages/api/test/profile.e2e-spec.ts`
- **acceptance**:
  1. `PATCH /api/auth/me` 가 `bio` 수용 → User.bio 갱신, 응답 `AuthUserDto.bio` 반영(본인만).
  2. bio 201자 → 400(class-validator `@MaxLength(200)`).
  3. bio `null`/빈 문자열 허용(소개 제거).
  4. e2e 왕복: bio 편집 → `GET /api/auth/me` 에 bio 반영. 기존 name·avatar 수정 무회귀.

### 스토리 S19.5 — 웹 UI

#### T-WEB-402 — 작성자 프로필 페이지 + 작성자 링크
- **context**: WEB / **priority**: 102 / **deps**: T-PUB-107, T-AUTH-013 / **tdd_first**: true / **예상**: 2h
- **변경 파일**: `packages/web/src/pages/AuthorProfile.tsx`(신규), `src/routes/*`(라우트), `src/users/useAuthorProfile.ts`(신규 훅), `src/posts/usePosts.ts`(author 파라미터), `src/components/PostListView`·카드·`pages/PostDetail.tsx`(작성자 링크), 단위 테스트
- **acceptance**:
  1. `/users/:id` AuthorProfile: 헤더(Avatar·이름·bio·가입일·발행글 수) + 작성자 발행글 목록(`?author=:id`). 빈 목록 시 "아직 발행한 글이 없습니다"(S1).
  2. 글 목록 카드·상세 헤더의 작성자 이름이 `/users/:authorId` 링크(`<a>`/`<Link>`, 접근가능 이름).
  3. `useAuthorProfile(id)` + `usePosts({ author })` 훅(직접 fetch 금지).
  4. web unit + 회귀 0(기존 목록·상세 셀렉터 유지).

#### T-WEB-403 — /profile 소개(bio) 편집
- **context**: WEB / **priority**: 103 / **deps**: T-AUTH-014 / **tdd_first**: true / **예상**: 1h
- **변경 파일**: `packages/web/src/pages/Profile.tsx`(bio textarea), `src/profile/useUpdateProfile`(bio 포함, 기존 훅 확장), 단위 테스트
- **acceptance**:
  1. `/profile` 에 소개(bio) textarea(현재 bio 로드), 저장 시 `PATCH /api/auth/me` 에 bio 전송 → 반영.
  2. bio 200자 제한 클라이언트 표시(서버 검증과 정합). 폼 zod 는 web 인라인.
  3. web unit + 회귀 0(기존 name·avatar 편집 유지).

## 진행 순서 요약

```
T-AUTH-012 (스키마·shared 타입)
   ├─▶ T-PUB-107 (작성자 목록 필터 + authorId)
   ├─▶ T-AUTH-013 (GET /api/users/:id 공개 프로필) ─┐
   └─▶ T-AUTH-014 (PATCH me bio) ──▶ T-WEB-403 (bio 편집)
                                      T-WEB-402 (프로필 페이지+링크) ◀── T-PUB-107 + T-AUTH-013
```

> 완료는 태스크별 `/finish`(검증→verifier→feature_list done→이 파일 동기화→handoff→commit). code-reviewer 가 commit 직전 자동 검토. CLAUDE.md AUTO-MANAGED 표에 `GET /api/users/:id` 추가(엔드포인트 신규).
