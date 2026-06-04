# Tasks - apple-redesign

> 입력: `docs/trd/apple-redesign.md` (+ glossary / bounded-contexts / ADR-0015·0016).
> 계층: **에픽 → 스토리 → 태스크**. 각 태스크 단일 Bounded Context, TDD 우선.
> Context 약어: PUB=Publishing, WEB=프론트. status: todo / in_progress / done.
> 비고: 2026-06-04 구현분의 사후 정식화. 진행 상태 정규 소스는 `feature_list.json`.

## 의존성 개요

```
T-WEB-009 (디자인 시스템/레이아웃/테마)
T-PUB-103 (목록 요약 평문화 + 대표 이미지 파생) ──▶ T-WEB-010 (목록 카드 대표 이미지 표시)
```

---

## E7. 애플 스타일 리디자인 (UI)

### S7.1 디자인 시스템 적용

#### T-WEB-009 — 애플 스타일 디자인 시스템 + 레이아웃 + 테마 토글 (WEB)
- priority: 31
- 변경 파일: `packages/web/src/index.css`, `packages/web/index.html`,
  `packages/web/src/theme/useTheme.ts(.test.ts)`, `packages/web/src/lib/{site,format}.ts`,
  `packages/web/src/components/{NavBar,Footer,Icon}.tsx`,
  `packages/web/src/components/layout/{PublicLayout,AdminLayout}.tsx`,
  `packages/web/src/routes.tsx`, 각 페이지/컴포넌트 리스타일(`pages/*`, `components/*`)
- acceptance criteria:
  1. 시맨틱 CSS 토큰 + `ab-*` 클래스로 공개·운영자 화면이 시안대로 렌더된다(인라인 style 없음).
  2. 라이트/다크 테마 토글이 `[data-theme]`·localStorage에 반영되고 새로고침 후 유지된다(`useTheme.test.ts` RED→GREEN).
  3. 공개/운영자/로그인 레이아웃이 중첩 라우트로 분리되고 기존 라우트 경로가 모두 등록된다.
  4. 기존 단위 테스트(역할/라벨/동작)와 E2E 셀렉터가 회귀 없이 통과한다.
- 예상: 2h (시안 이식)
- 의존: T-WEB-007, T-WEB-008 (done)
- status: done
- tdd_first: true (테마 스토어 테스트 우선. 시각 리스타일은 기존 테스트가 회귀 가드)

### S7.2 글 목록 대표 이미지

#### T-PUB-103 — 목록 요약 평문화 + 대표 이미지 파생 (PUB)
- priority: 32
- 변경 파일: `packages/shared/src/dto/post.ts`,
  `packages/api/src/publishing/{cover-image,markdown-summary}.ts(.spec.ts)`,
  `packages/api/src/publishing/post.service.ts(.spec.ts)`
- acceptance criteria:
  1. `extractFirstImageUrl()` 가 본문의 마크다운/HTML 첫 이미지 URL을 반환하고 없으면 null (`cover-image.spec.ts`).
  2. `toSummaryText()` 가 이미지/코드/링크/헤딩/강조를 제거한 평문을 만든다 (`markdown-summary.spec.ts`).
  3. `PostSummaryDto.coverImageUrl` 추가, `listPublished` 가 본문 첫 이미지를 `coverImageUrl`로 노출(없으면 null) — 추가 DB 조회 없음.
  4. 라이브 `GET /api/posts` 응답에 `coverImageUrl` 포함 + 요약이 평문.
- 예상: 1.5h
- 의존: T-PUB-009 (목록 API, done)
- status: done
- tdd_first: true (순수 헬퍼 RED→GREEN)

#### T-WEB-010 — 글 목록 카드 대표 이미지 표시 (WEB)
- priority: 33
- 변경 파일: `packages/web/src/components/PostListView.tsx`, `packages/web/src/index.css`
- acceptance criteria:
  1. 목록 카드에 `coverImageUrl` 이 있으면 `<img class="ab-card-cover">`(3:2, object-fit cover)로 렌더한다.
  2. `coverImageUrl` 이 없으면 줄무늬 플레이스홀더(`.ab-ph`)로 대체한다.
  3. 카드의 제목/태그 링크·`a[href^="/posts/"]` 등 기존 셀렉터·접근성이 유지된다.
  4. 실 환경에서 본문 첫 이미지가 카드 커버로 실제 로드된다(naturalWidth>0).
- 예상: 0.5h
- 의존: T-PUB-103, T-WEB-009
- status: done
- tdd_first: true (기존 PostList 단위 테스트가 회귀 가드, 실측 검증 병행)
