# seo — 발견/유입(SEO·공유)

> 정규 소스는 `feature_list.json`. 이 문서는 미러다(절대 규칙 #10). 근거: ADR-0022.

"고급 블로그" 로드맵 A단계. 슬러그 URL → (다음) 메타/OG → (다음) sitemap·RSS 순.

## 태스크

#### T-PUB-108 — Post 슬러그(생성·유일화·idOrSlug 조회·백필)
- priority: 70 / 의존: T-PUB-005 / status: done (2026-06-05)
- acceptance:
  1. `Post.slug` @unique 컬럼 + 안전 마이그레이션(기존행 임시 `slug=id`).
  2. 생성 시 `slugify(title)` 로 슬러그 부여, 충돌 시 `-2/-3` 유일화(한글 보존).
  3. `GET /api/posts/:idOrSlug` 가 slug·cuid 둘 다로 발행글 조회, 응답에 `slug` 포함.
  4. 기존 글 백필 스크립트(`backfill:slugs`) 멱등, 회귀 없음(api 단위 127 · e2e 66).

#### T-WEB-309 — 슬러그 URL 라우팅·링크 + cuid 리다이렉트
- priority: 71 / 의존: T-PUB-108 / status: done (2026-06-05)
- acceptance:
  1. 목록/카드 링크가 `/posts/{slug}`, 라우트 `/posts/:slug`.
  2. `PostDetail` 이 slug·cuid 둘 다 조회(한글 슬러그 인코딩), cuid 진입 시 슬러그 URL 로 `replace`(canonical).
  3. 회귀 없음: web unit 98 통과(redirect 테스트 포함).

## 다음 단계 (이 feature 의 후속)
- A② 글별 메타/OG·Twitter 카드 + JSON-LD
- A③ sitemap.xml · RSS/Atom · robots.txt
