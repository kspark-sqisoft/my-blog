# Tasks — 시리즈 (Series, 연재) · E20

> 입력: `docs/trd/series.md`, `docs/adr/0029-series.md`, `docs/prd/series.md`. 정규 소스는 `feature_list.json`(이 .md 는 미러 — 절대규칙 #10).
> 모든 태스크 TDD-first. 한 태스크 = 한 Bounded Context(전부 Publishing/PUB 또는 WEB).

## 진행 순서 요약
```
T-SER-001 (스키마 Series + Post.seriesId/Order + shared 타입)  ← 토대
   ├─▶ T-SER-002 (Series CRUD + 권한)
   │      └─▶ T-SER-003 (PUT posts 멤버십·순서)
   │      └─▶ T-SER-004 (공개 목록·상세)
   └─▶ T-SER-005 (글 상세 시리즈 네비 파생)

T-SER-004 ─▶ T-WEB-501 (시리즈 상세 페이지) ─▶ T-WEB-503 (시리즈 목록/인덱스)
T-SER-005 ─▶ T-WEB-502 (글 상세 시리즈 네비 UI)
T-SER-002+003 ─▶ T-WEB-504 (작성자 시리즈 관리 UI)
```

## 에픽 E20 — 시리즈(연재)

### 스토리 S20.1 — 토대 (Publishing)

#### T-SER-001 — Series 스키마 + Post 소속/순서 + shared 타입 ✅ done (2026-06-08)
- **context**: PUB / **priority**: 200 / **deps**: 없음 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/api/prisma/schema.prisma`(+migration), `packages/shared/src/dto/series.ts`(신규), `packages/shared/src/dto/post.ts`(PostDetailDto.series), `packages/shared/src/index.ts`
- **acceptance**:
  1. `Series{id,slug(unique),title,description?,authorId,createdAt,updatedAt}` 모델 + `@@index([authorId])`. `Post.seriesId String?`(`onDelete: SetNull`)+`seriesOrder Int @default(0)`+`@@index([seriesId, seriesOrder])`. 마이그레이션 **비파괴**(`check_migration_destructive`)·인덱스 점검(`check_index`).
  2. shared 에 `SeriesSummaryDto`·`SeriesDetailDto`·`SeriesNavDto`·`SeriesNavPostDto`·`CreateSeriesDto`·`UpdateSeriesDto`·`SetSeriesPostsDto` **순수 타입** 정의 + `PostDetailDto.series: SeriesNavDto | null` 추가. index 에서 export. shared 에 zod/런타임 값 미추가(함정 #9).
  3. `pnpm --filter @blog/shared run build` 통과, api 타입 컴파일 통과(기존 회귀 0). 마이그레이션 blog·blog_test 적용.

### 스토리 S20.2 — 시리즈 CRUD·멤버십 (Publishing)

#### T-SER-002 — SeriesService/Controller 생성·수정·삭제 + 권한 ✅ done (2026-06-08)
- **context**: PUB / **priority**: 201 / **deps**: T-SER-001 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `packages/api/src/publishing/series.service.ts`(+`.spec`), `packages/api/src/publishing/series.controller.ts`, 모듈 등록
- **acceptance**:
  1. `POST /api/series`(AUTHOR/ADMIN): `{title,description?}` → 201 `SeriesDetailDto`(posts []), `authorId=actor.id`, slug title 파생·중복 suffix(ADR-0022). title 1~120·description 0~500 검증(400).
  2. `PATCH /api/series/:id`(소유자/ADMIN): title/description 수정 200, slug 불변. 타인 403, 없음 404.
  3. `DELETE /api/series/:id`(소유자/ADMIN): 204, 소속 글 `seriesId=null`(SetNull)로 보존(글 안 지워짐). 타인 403, 없음 404.
  4. 미인증 쓰기 401. 단위(권한 분기)+e2e(왕복) GREEN.

#### T-SER-003 — PUT /series/:id/posts 멤버십·순서 원자 재지정 ✅ done (2026-06-08)
- **context**: PUB / **priority**: 202 / **deps**: T-SER-001, T-SER-002 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `series.service.ts`(+`.spec`), `series.controller.ts`, `test/series.e2e-spec.ts`
- **acceptance**:
  1. `PUT /api/series/:id/posts`(소유자/ADMIN) `{postIds:[]}`: 단일 트랜잭션으로 목록 글 `seriesId=this, seriesOrder=index`, 목록에서 빠진(기존 소속) 글 `seriesId=null`. 멱등. 200 `SeriesDetailDto`.
  2. **권한 분기**: `AUTHOR` 는 **본인 소유 글만** 편입(타인 글 포함 시 403), `ADMIN` 은 임의 글 편입 가능 — e2e 로 두 분기 검증. 없는 글 400, 중복 postId 400. 부분 적용 없음(롤백).
  3. `postIds` 배열 최대 100(`@ArrayMaxSize(100)`) 초과 시 400.
  4. 한 글이 다른 시리즈에 있었다면 이 PUT 으로 이동(이전 시리즈에서 빠짐). 한 글 최대 1 시리즈 불변식 유지.
  5. 단위(트랜잭션·권한 분기·검증)+e2e(재정렬·ADMIN 교차소유 왕복) GREEN.

### 스토리 S20.3 — 공개 읽기 (Publishing)

#### T-SER-004 — 공개 시리즈 목록·상세(발행글만) ✅ done (2026-06-08)
- **context**: PUB / **priority**: 203 / **deps**: T-SER-001, T-SER-002 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `series.service.ts`(+`.spec`), `series.controller.ts`, `test/series.e2e-spec.ts`
- **acceptance**:
  1. `GET /api/series`(공개): `Paginated<SeriesSummaryDto>`, `postCount`=발행글 수(초안 제외, N+1 없음), 페이지네이션(ADR-0010). 빈 목록 200.
  2. `GET /api/series/:idOrSlug`(공개): `SeriesDetailDto`, `posts`=발행글만 `seriesOrder` 오름차순(초안 제외). slug·cuid 둘 다(ADR-0022). 없음 404, 발행글 0 → 200 빈 posts.
  3. 초안/미발행 글이 posts·postCount 에 절대 미포함(발행 격리 회귀 0). 단위+e2e GREEN.

#### T-SER-005 — 글 상세 시리즈 네비 파생 ✅ done (2026-06-08)
- **context**: PUB / **priority**: 204 / **deps**: T-SER-001 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/api/src/publishing/post.service.ts`(+`.spec`), `test/post.e2e-spec.ts`
- **acceptance**:
  1. `getPublishedDetail` 가 현재 글이 시리즈 소속이면 `PostDetailDto.series`(id·slug·title·position·total·prev·next) 채움. 미소속이면 `series:null`.
  2. position/total/prev/next 는 **같은 시리즈 발행글만** `seriesOrder` 정렬 기준(초안 제외). 첫 글 prev=null, 끝 글 next=null. 추가 쿼리 1회(N+1 없음).
  3. 단위(파생 계산·경계)+e2e(이전/다음 노출) GREEN. 기존 PostDetail 회귀 0.

### 스토리 S20.4 — 웹 (WEB)

#### T-WEB-501 — 시리즈 상세 페이지 /series/:slug ✅ done (2026-06-08)
- **context**: WEB / **priority**: 205 / **deps**: T-SER-004 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `packages/web/src/pages/SeriesDetail.tsx`(신규), `src/series/useSeries.ts`(신규 훅), `src/routes.tsx`, 단위 테스트
- **acceptance**:
  1. `/series/:slug` 헤더(제목·설명·작성자 링크 `/users/:authorId`) + 순서대로 발행글 목록(`PostListView` 재사용). 빈 발행글 시 "아직 발행된 글이 없습니다".
  2. `useSeries(idOrSlug)` 훅 경유(직접 fetch 금지). 404 에러 상태 처리.
  3. web unit(렌더·빈 상태·404) + 기존 라우트/홈·상세 테스트 무회귀(전체 web 스위트 GREEN).

#### T-WEB-502 — 글 상세 시리즈 네비 UI ✅ done (2026-06-08)
- **context**: WEB / **priority**: 206 / **deps**: T-SER-005 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/web/src/pages/PostDetail.tsx`, `src/components/SeriesNav.tsx`(신규), 단위 테스트
- **acceptance**:
  1. 시리즈 소속 발행글 상세에 "X 시리즈 · N/M편"(시리즈 상세 링크) + 이전/다음 글 링크(`/posts/:slug`, 접근가능 이름). 미소속이면 미표시.
  2. 첫/끝 글에서 이전/다음 적절히 비활성/숨김. web unit + 회귀 0(기존 상세 셀렉터 유지).

#### T-WEB-503 — 시리즈 목록/인덱스 /series
- **context**: WEB / **priority**: 207 / **deps**: T-SER-004 / **tdd_first**: true / **예상**: 1.5h
- **변경 파일**: `packages/web/src/pages/SeriesList.tsx`(신규), `src/series/useSeriesList.ts`(신규 훅), `src/routes.tsx`, 네비 링크, 단위 테스트
- **acceptance**:
  1. `/series` 시리즈 카드 목록(제목·설명·글 수·작성자) + 페이지네이션. 각 카드 → `/series/:slug`.
  2. 빈 목록 안내. `useSeriesList` 훅 경유. web unit(렌더·빈 목록·페이지네이션) + 기존 web 스위트 무회귀(전체 GREEN).

#### T-WEB-504 — 작성자 시리즈 관리 UI
- **context**: WEB / **priority**: 208 / **deps**: T-SER-002, T-SER-003 / **tdd_first**: true / **예상**: 2.5h
- **변경 파일**: `packages/web/src/pages/admin/SeriesManage.tsx`·`SeriesEditor.tsx`(신규), `src/series/useSeriesAdmin.ts`(훅: create/update/delete/setPosts), `src/routes.tsx`(AdminLayout 하위), 단위 테스트
- **acceptance**:
  1. `/admin/series` 내 시리즈 목록(ADMIN 전체) + 생성. `/admin/series/:id/edit` 제목·설명 수정 + 내 발행글 선택·순서 지정 → `PUT /series/:id/posts`. 삭제.
  2. 폼 검증 web 인라인 zod(title 1~120·description 0~500), 서버 검증과 정합. 직접 fetch 금지(훅 경유).
  3. 권한: AUTHOR 는 본인 시리즈만, ADMIN 전체. web unit + 회귀 0.
