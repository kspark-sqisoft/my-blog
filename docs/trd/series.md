# TRD — 시리즈 (Series, 연재)

> 입력: `docs/glossary.md`(시리즈·시리즈 순서·시리즈 네비게이션), `docs/prd/series.md`, `docs/bounded-contexts.md`(Publishing).
> 결정은 `docs/adr/0029-series.md` 로 분리(아래 §결정 추출).

## 1. 아키텍처 개요

```
[독자]                                   [작성자/운영자]
  │ GET /api/series (목록)                  │ POST   /api/series           (생성)
  │ GET /api/series/:idOrSlug (상세+발행글)  │ PATCH  /api/series/:id       (제목·설명)
  │ GET /api/posts/:idOrSlug (시리즈 네비)   │ DELETE /api/series/:id       (삭제·SetNull)
  ▼                                        │ PUT    /api/series/:id/posts (멤버십·순서 원자 재지정)
 [SeriesController] ──► [SeriesService] ──► Prisma ──► PostgreSQL
                                  ▲                     Series(신규) + Post.seriesId/seriesOrder
 [PostController/Service] ── getPublishedDetail 에서 시리즈 네비 파생(이전/다음 발행글)
```
- Series 는 Publishing 의 신규 Aggregate(ADR-0029). 소유 작성자만 `authorId` 로 참조.
- 소속·순서는 **Post 측**(`seriesId`+`seriesOrder`). 공개 노출은 **발행글만**(`status=PUBLISHED`).

## 2. 백엔드 모듈 구조 (Publishing 내)
- `packages/api/src/publishing/series.controller.ts` — `@Controller('series')`. 공개 GET(목록·상세) + 보호 POST/PATCH/DELETE/PUT(멤버십).
- `packages/api/src/publishing/series.service.ts` — 시리즈 CRUD + 멤버십/순서 재지정 + 목록/상세 읽기. Actor 소유권(ADR-0018) 재사용.
- `packages/api/src/publishing/post.service.ts` — `getPublishedDetail` 에 **시리즈 네비 파생**(현재 글이 시리즈 소속이면 같은 시리즈 발행글을 `seriesOrder` 정렬해 위치·이전/다음 계산).
- `PublishingModule`(또는 기존 모듈)에 `SeriesController`/`SeriesService` 등록. 슬러그 생성은 기존 Post 슬러그 유틸 재사용(ADR-0022).

## 3. API 명세

> 전역 prefix `api`. 응답 포맷 고정(`{data}`/`{error}` 는 기존 인터셉터 관행 따름).

### GET `/api/series` (공개) — 시리즈 목록(페이지네이션)
- 쿼리: `page?`, `pageSize?`(기본 20, ADR-0010 동형).
- 응답 `Paginated<SeriesSummaryDto>`:
```json
{ "items": [ { "id": "ckxs…", "slug": "react-입문", "title": "React 입문", "description": "초보용 연재", "authorId": "cku…", "authorName": "글쓴이", "postCount": 3 } ], "page": 1, "pageSize": 20, "total": 1 }
```
- `postCount` = 그 시리즈의 **발행글** 수(초안 제외, N+1 없이 group count).

### GET `/api/series/:idOrSlug` (공개) — 시리즈 상세 + 발행글
- 슬러그·cuid 둘 다 수용(ADR-0022 동형). 없으면 404.
- 응답 `SeriesDetailDto`:
```json
{ "id":"ckxs…","slug":"react-입문","title":"React 입문","description":"초보용 연재","authorId":"cku…","authorName":"글쓴이",
  "posts":[ { "id":"…","slug":"react-1","title":"1편",…PostSummaryDto, "seriesOrder":0 } ] }
```
- `posts` 는 **발행글만** `seriesOrder` 오름차순. 빈 배열 허용(발행글 0 → 상세는 200, 빈 안내).

### POST `/api/series` (AUTHOR/ADMIN) — 생성
- 요청 `CreateSeriesDto`: `{ "title": "React 입문", "description": "초보용 연재" }` (description 선택).
- 동작: `authorId = actor.id`, slug 는 title 에서 파생(중복 시 -2 등 suffix, Post 동형). 201 + `SeriesDetailDto`(posts 빈 배열).
- 검증: title 1~120자(class-validator), description 0~500자.

### PATCH `/api/series/:id` (소유자/ADMIN) — 제목·설명 수정
- 요청 `UpdateSeriesDto`: `{ "title"?, "description"? }`. 200 + `SeriesDetailDto`.
- 권한: `series.authorId === actor.id || actor.role==='ADMIN'` 아니면 403. 없으면 404.
- slug 는 MVP 에서 **불변**(제목 바꿔도 slug 유지 — 링크 안정성, ADR-0022 정신). [재생성은 후속]

### DELETE `/api/series/:id` (소유자/ADMIN) — 삭제
- 동작: Series 삭제, 소속 Post 의 `seriesId` 는 `onDelete: SetNull` 로 자동 해제(**글은 삭제 안 됨**). 204.
- 권한: 소유자/ADMIN. 없으면 404.

### PUT `/api/series/:id/posts` (소유자/ADMIN) — 멤버십·순서 원자 재지정
- 요청 `SetSeriesPostsDto`: `{ "postIds": ["p3","p1","p2"] }` (이 순서가 곧 `seriesOrder` 0,1,2).
- 동작(단일 트랜잭션): (1) 이 시리즈에 현재 속한 Post 중 목록에 없는 것 → `seriesId=null`. (2) 목록의 각 Post → `seriesId=this, seriesOrder=index`. 멱등.
- 검증/권한:
  - actor 가 **시리즈 소유자 또는 ADMIN** 이어야 함(아니면 403).
  - **글 편입 경계**: `AUTHOR` 는 **본인 소유 글만**(`post.authorId === actor.id`) 편입 가능. `ADMIN` 은 **임의 작성자의 글**도 편입 가능(운영 모더레이션). AUTHOR 가 타인 글 포함 시 403.
  - 목록의 모든 postId 는 **존재**해야 하고(없으면 400), **중복 금지**(400). 위반 시 부분 적용 없음(트랜잭션 롤백).
  - `postIds` 배열 최대 길이 **100**(class-validator `@ArrayMaxSize(100)`) — 한 트랜잭션 다건 갱신 비용 상한(비기능 성능, PRD).
- 응답 200 + `SeriesDetailDto`.

### GET `/api/posts/:idOrSlug` (공개) — 시리즈 네비 추가
- 기존 `PostDetailDto` 에 `series` 필드(현재 글이 시리즈 소속이고 그 글이 발행 상태일 때):
```json
"series": { "id":"…","slug":"react-입문","title":"React 입문","position":2,"total":3,
            "prev": {"slug":"react-1","title":"1편"}, "next": {"slug":"react-3","title":"3편"} }
```
- 미소속이면 `series: null`. position/total/prev/next 는 **발행글만** `seriesOrder` 정렬 기준. 단일 추가 쿼리(같은 시리즈 발행글 목록 1회).

## 4. DB 스키마 (Prisma)
```prisma
model Series {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  description String?
  authorId    String
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  posts       Post[]   // 역참조(읽기 전용; 소속은 Post.seriesId 가 진실원천)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([authorId])
}

// Post 모델에 추가
  seriesId    String?
  series      Series?  @relation(fields: [seriesId], references: [id], onDelete: SetNull)
  seriesOrder Int      @default(0)
  // 시리즈 상세/네비 정렬·조회 최적화
  @@index([seriesId, seriesOrder])
```
- 마이그레이션: `Series` 테이블 생성 + `Post.seriesId/seriesOrder` 컬럼·인덱스 추가(비파괴 — 기존 글 seriesId=null, seriesOrder=0). prisma-helper `check_migration_destructive`/`check_index` 로 게이트.

## 5. 프론트엔드 라우트와 페이지
- 공개:
  - `/series` — `SeriesList`(인덱스, 페이지네이션).
  - `/series/:slug` — `SeriesDetail`(제목·설명·작성자 링크 + 순서대로 발행글 목록, `PostListView` 재사용·빈 안내).
  - `PostDetail` — 시리즈 네비(이전/다음·N/M편) 컴포넌트 추가.
- 관리(AUTHOR/ADMIN, AdminLayout 하위):
  - `/admin/series` — 내 시리즈 목록(ADMIN 은 전체).
  - `/admin/series/new`·`/admin/series/:id/edit` — 시리즈 생성/수정 + 소속 글 선택·순서 지정(드래그 또는 순서값 → `PUT /series/:id/posts`).
- API 훅(`src/series/*` 또는 `src/api/`): `useSeriesList`, `useSeries(idOrSlug)`, `useMySeriesAdmin`, `useCreateSeries`/`useUpdateSeries`/`useDeleteSeries`/`useSetSeriesPosts`. 직접 fetch 금지(훅 경유).

## 6. 공유 타입 (`packages/shared`, 순수 타입만 — 함정 #9)
```ts
export interface SeriesSummaryDto { id: string; slug: string; title: string; description: string | null; authorId: string; authorName: string; postCount: number; }
export interface SeriesNavPostDto { slug: string; title: string; }
export interface SeriesNavDto { id: string; slug: string; title: string; position: number; total: number; prev: SeriesNavPostDto | null; next: SeriesNavPostDto | null; }
export interface SeriesDetailDto { id: string; slug: string; title: string; description: string | null; authorId: string; authorName: string; posts: (PostSummaryDto & { seriesOrder: number })[]; }
// 입력 계약(검증은 각 패키지): CreateSeriesDto{title;description?}, UpdateSeriesDto{title?;description?}, SetSeriesPostsDto{postIds:string[]}
// PostDetailDto 에 series: SeriesNavDto | null 추가
```
- zod/스키마 값은 shared 에 넣지 않는다(폼 zod=web 인라인, 서버=class-validator). ADR-0004·함정 #9.

## 7. 외부 의존성
- 없음(신규 라이브러리 0). 슬러그 생성은 기존 Post 유틸 재사용. 드래그 정렬은 가벼운 HTML(접근 가능한 순서값 입력 우선, 드래그는 선택).

## 8. 보안 처리
- 시리즈 쓰기(POST/PATCH/DELETE/PUT posts)는 `JwtAuthGuard + RolesGuard('AUTHOR','ADMIN')` + 서비스 레벨 Actor 소유권 검사(소유자 또는 ADMIN). 타인 시리즈/타인 글 편입 차단.
- 공개 GET 은 **발행글만** 노출(초안 격리) — 시리즈 상세 posts·네비 prev/next·postCount 전부 `status=PUBLISHED` 필터.
- 입력 검증: title/description 길이 제한, postIds 배열(존재·소유·중복 검사). XSS: title/description 평문 저장 + React escape(`dangerouslySetInnerHTML` 금지).

## 9. 테스트 전략
- 단위(service.spec): 생성/수정/삭제 권한(소유자/ADMIN/타인 403), slug 파생·중복, PUT posts 멤버십·순서·타인 글 거부·트랜잭션, 시리즈 네비 파생(position/total/prev/next, 발행글만), postCount 발행 only.
- e2e(series.e2e-spec): 공개 목록/상세(발행글만·빈 상태 200), 생성→글 편입(PUT)→상세 순서 확인 왕복, 글 상세 네비 이전/다음, 권한(미인증 401/타인 403/초안 비노출), DELETE 후 글 보존+seriesId null.
- web 단위: SeriesList/SeriesDetail 렌더·빈 상태, PostDetail 네비, 관리 폼(zod 검증·PUT 호출). 회귀 0.
- DB 가드: 스키마 변경 → `check_migration_destructive`(비파괴 확인)+`check_index`(`(seriesId,seriesOrder)`·`authorId`).

## 결정 추출 (→ ADR-0029 로 분리)
1. Series 를 Publishing 의 **신규 Aggregate** 로 추가(읽기 파생 아님). 소속·순서는 Post 측(`seriesId`+`seriesOrder`), 한 글 최대 1 시리즈.
2. 멤버십·순서를 `PUT /series/:id/posts {postIds}` **원자 재지정**으로(부분 패치 대신 전체 목록). 중복 order 불변식을 index 로 자명하게 보장.
3. 순서 재정렬 시 **여러 Post 다건 갱신**(한 트랜잭션) — "한 트랜잭션 한 Aggregate" 의 실용적 예외로 수용.
4. 공개 노출은 발행글만(초안 격리), 시리즈 자체는 항상 공개(비공개 시리즈 없음).
5. slug 는 생성 시 title 에서 파생(ADR-0022 동형), 수정 시 **불변**(링크 안정성).
6. 삭제는 Series 만 제거, 소속 글은 `SetNull` 로 보존.
7. 권한은 Actor 소유권 패턴(ADR-0018) 재사용 — 소유자/ADMIN.
8. 검증은 각 패키지(ADR-0004) — shared 순수성 유지(함정 #9).
