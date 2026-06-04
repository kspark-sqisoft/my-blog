# TRD - apple-redesign

> 입력: `docs/prd/apple-redesign.md`, `docs/glossary.md`, `docs/bounded-contexts.md`.
> 비고: 2026-06-04 구현분의 사후 기술 명세. 주요 결정은 §9에서 ADR로 분리(ADR-0015, ADR-0016).

## 1. 아키텍처 개요

```
          ┌──────────────────────── packages/web (프레젠테이션) ────────────────────────┐
 브라우저 │  PublicLayout(NavBar+Footer)        AdminLayout(Sidebar)                     │
   │      │   ├ Home(masthead+카드 그리드)        ├ Dashboard(통계+테이블)               │
   │      │   ├ PostDetail(+Comments)             └ PostEditor(2단 시스템 UI)            │
   │      │   ├ TagPosts / Login                  useTheme(zustand)→[data-theme]         │
   │      │   └ PostListView(카드: 대표이미지/요약/태그)   index.css 디자인 토큰          │
   │      └───────────────────────────────────────────────────────────────────────────┘
   │                              │ GET /api/posts (목록)
   ▼                              ▼
 /uploads/* 정적 서빙      ┌──────────── packages/api (Publishing) ───────────┐
 (ADR-0012)               │ PostController.list → PostService.listPublished   │
                          │   toSummary(): extractFirstImageUrl()+toSummaryText│
                          └───────────────────────────────────────────────────┘
                                         │ Prisma findMany(본문 포함)
                                         ▼  PostgreSQL (스키마 변경 없음)
```

핵심: **백엔드는 기존 목록 쿼리(본문 포함)에서 대표 이미지·평문 요약을 파생**하고, **프론트는 시각 시스템만 교체**한다. DB 스키마·도메인 모델·엔드포인트 집합은 변하지 않는다.

## 2. 백엔드 모듈 구조 (Publishing와 1:1)

- `PostService.toSummary(post)` 가 두 파생값을 만든다:
  - `coverImageUrl = extractFirstImageUrl(post.contentMarkdown)` — 본문 첫 이미지 URL (ADR-0015)
  - `summary = toSummaryText(post.contentMarkdown, 200)` — 마크다운 제거 평문 요약
- 새 순수 헬퍼: `publishing/cover-image.ts`, `publishing/markdown-summary.ts` (둘 다 DB 비의존, 단위 테스트 보유).
- 목록 쿼리는 이미 `include: withTags` 로 `contentMarkdown` 을 들고 있어 **추가 조회 없음**.

## 3. API 명세 (변경분만)

### GET /api/posts — 발행 Post 목록
- 요청: `?page=1&pageSize=10&tag=git` (변경 없음)
- 응답(변경): `items[]` 의 각 요소에 `coverImageUrl` 추가, `summary` 는 평문.

```jsonc
// 200 OK
{
  "items": [
    {
      "id": "cmpyt0n7t001u2jqcdp4rhl5q",
      "title": "시맨틱 버저닝과 변경 로그 관리",
      "summary": "들어가며 MAJOR.MINOR.PATCH 규칙을 지키고 ...", // 평문(마크다운 제거)
      "tags": ["릴리스", "협업"],
      "publishedAt": "2026-06-04T01:15:57.482Z",
      "coverImageUrl": "/uploads/9ef1e0675e7015114591897391beabf0.jpg" // 첫 이미지, 없으면 null
    }
  ],
  "page": 1, "pageSize": 10, "total": 30
}
```

> 새 엔드포인트는 없다. `GET /api/posts/:id`(상세)·운영자 엔드포인트는 변경 없음.

## 4. DB 스키마

**변경 없음.** 대표 이미지·요약은 저장 컬럼이 아니라 본문에서 파생한다(ADR-0015). 마이그레이션 없음.

## 5. 프론트엔드 라우트와 페이지

라우트(경로)는 TRD(blog-mvp) §5와 동일. 레이아웃 중첩만 변경:
- `PublicLayout`(NavBar+Footer) 하위: `/`, `/posts/:id`, `/tags/:name`
- `/login` 단독(풀스크린 auth 카드)
- `ProtectedRoute > AdminLayout`(사이드바) 하위: `/admin`, `/admin/posts/new`, `/admin/posts/:id/edit`

신규/변경 컴포넌트: `components/{NavBar,Footer,Icon}`, `components/layout/{PublicLayout,AdminLayout}`, `theme/useTheme`, `lib/{site,format}`. 목록 카드(`PostListView`)에 대표 이미지 `<img class="ab-card-cover">`(없으면 `.ab-ph` 플레이스홀더).

## 6. 공유 타입 (packages/shared)

```ts
// dto/post.ts
export interface PostSummaryDto {
  id: string; title: string; summary: string;
  tags: string[]; publishedAt: string | null;
  coverImageUrl: string | null; // 신규: 본문 첫 이미지(대표 이미지)
}
```

## 7. 디자인 토큰 시스템 (ADR-0016)

- `packages/web/src/index.css`: `@import 'tailwindcss'` 유지 + 시맨틱 CSS 변수 토큰(`--bg/--text/--accent/...`) 정의. 다크는 `[data-theme='dark']` 블록에서 토큰 재정의.
- 컴포넌트 스타일은 `ab-*` 시맨틱 클래스로 표현(인라인 style 금지 규칙 준수).
- `useTheme`(zustand)이 `document.documentElement[data-theme]` 와 localStorage `blog-theme` 를 동기화.

## 8. 외부 의존성
- **Pretendard**(CDN, `index.html` `<link>`) — 한글 최적 본문 폰트. 신규 npm 의존성은 없음.
- 기존: Tailwind v4(`@tailwindcss/vite`), react-markdown + rehype-sanitize(상세 본문, 변경 없음).

## 9. 보안 처리
- 대표 이미지 URL은 운영자가 업로드한 `/uploads/*`(ADR-0012)로, 기존 정적 서빙·sanitize 경계를 그대로 재사용한다. 새 신뢰 경계 없음.
- 목록 `<img src>`는 운영자 본문에서 파생된 내부 경로만 사용(외부 임의 URL 주입 경로 아님).

## 10. 테스트 전략
- api 순수 단위: `cover-image.spec.ts`(6), `markdown-summary.spec.ts`(4) — DB 비의존.
- api 통합: `post.service.spec.ts` 에 `listPublished` 가 `coverImageUrl` 파생을 검증(테스트 DB).
- web 단위(vitest): 테마 스토어 `useTheme.test.ts`, 기존 페이지/컴포넌트 테스트(역할·라벨·동작 회귀 가드).
- E2E(Playwright): 기존 3종 그대로 통과(목록 `li`·`a[href^="/posts/"]`·`.prose img` 셀렉터 보존).

## 결정 추출 (→ ADR)
- **ADR-0015**: 목록 요약·대표 이미지를 저장 컬럼 없이 **읽기 시 본문에서 파생**.
- **ADR-0016**: 프론트 디자인 시스템을 **CSS 변수 토큰 + `data-theme` 수동 토글**로 구성.
