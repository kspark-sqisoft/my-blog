# Tasks — seo-feed (피드 · 사이트맵 · Open Graph)

> Phase 6 산출물. 입력: `docs/trd/seo-feed.md`, ADR-0026. 정규 진행 상태는 `feature_list.json`(이 파일은 미러 — 절대규칙 #10).
> epic **E17**, context 대부분 **PUB**(Publishing 읽기 파생) + 서빙 정합 1건. 모두 `tdd_first: true`.

## 에픽 E17 — 발행 콘텐츠 외부 노출(seo-feed)

새 BC·스키마·shared 변경 없음(ADR-0026). 모든 조회는 발행글(`PUBLISHED`)만, 읽기 전용.

### 스토리 S17.1 — 산출물 생성 기반(유틸·환경변수)

#### T-SEO-001 — 절대 URL·XML 이스케이프 유틸 + `SITE_URL`/`FEED_MAX_ITEMS` 환경변수 — ✅ done (2026-06-08)
- **context**: PUB / **priority**: 87 / **deps**: 없음 / **tdd_first**: true / **예상**: 1h / **status**: done
- **변경 파일**: `packages/api/src/publishing/seo/site-url.ts`(+`.spec`), `packages/api/src/publishing/seo/xml.ts`(+`.spec`), `.env.example`, `docker-compose.yml`(api environment), `docker-compose.dev.yml`(필요 시)
- **acceptance**:
  1. `absoluteUrl(base, '/posts/슬러그')` 가 `SITE_URL` 기준 절대 URL 반환(한글 슬러그 인코딩 포함), 이미 절대 URL(`http(s)://`)이면 그대로 반환.
  2. `isExternalUrl(url)` 가 외부 절대 URL(`https://other...`)은 true, 로컬 `/uploads/...` 상대경로는 false.
  3. `escapeXml(s)` 가 `& < > " '` 를 엔티티로 치환(주입 방지), 일반 텍스트는 불변.
  4. `SITE_URL` 미설정 시 dev 기본값(`http://localhost:5173`)을 쓰고, `.env.example` 에 `SITE_URL`·`FEED_MAX_ITEMS=20` 문서화 + compose 주입.

### 스토리 S17.2 — RSS 피드

#### T-SEO-002 — FeedService + `GET /feed.xml` (RSS 2.0, 요약만) — ✅ done (2026-06-08)
- **context**: PUB / **priority**: 88 / **deps**: T-SEO-001 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/api/src/publishing/seo/feed.service.ts`(+`.spec`), `packages/api/src/publishing/seo/seo.controller.ts`, `packages/api/src/common/app-setup.ts`(`setGlobalPrefix` exclude), `packages/api/test/seo.e2e-spec.ts`
- **acceptance**:
  1. FeedService 가 발행글만 `publishedAt` 최신순, 최대 `FEED_MAX_ITEMS`(기본 20)로 RSS 2.0 XML 생성 — 초안/미발행 제외(단위 spec).
  2. 각 `<item>` 에 제목·`<description>`(평문 요약, `toSummaryText` 재사용)·`<link>`/`<guid isPermaLink="true">`(슬러그 절대 URL)·`<pubDate>`(RFC822)·`<dc:creator>`(표시 이름). `<rss>` 에 `xmlns:atom`·`xmlns:dc` 선언, `<atom:link rel="self">` 포함.
  3. 제목·요약·작성자에 `<`,`&` 등이 있어도 이스케이프되어 **유효한 XML 로 파싱**된다(주입 방지).
  4. `GET /feed.xml` → 200 + `Content-Type: application/rss+xml; charset=utf-8` + `Cache-Control` 헤더, 발행글 포함·초안 0건(e2e, 절대규칙 #9 왕복).
  5. 발행글·작성자·태그를 **N+1 없이** 배치 로드(쿼리 수 검증 또는 단일 findMany+include).

### 스토리 S17.3 — 사이트맵·robots

#### T-SEO-003 — SitemapService + `GET /sitemap.xml` + `GET /robots.txt` — ✅ done (2026-06-08)
- **context**: PUB / **priority**: 89 / **deps**: T-SEO-001 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/api/src/publishing/seo/sitemap.service.ts`(+`.spec`), `packages/api/src/publishing/seo/seo.controller.ts`, `packages/api/src/common/app-setup.ts`, `packages/api/test/seo.e2e-spec.ts`
- **acceptance**:
  1. SitemapService 가 홈(`/`) + 발행글 슬러그 URL(절대) + 태그 페이지(`/tags/:name`)를 sitemaps.org 0.9 `urlset` 으로 생성, 초안/미발행 제외(단위 spec).
  2. 글 `<lastmod>` = `Post.updatedAt`(`@updatedAt` NOT NULL), YYYY-MM-DD(W3C). 태그·홈 lastmod 는 선택.
  3. `GET /sitemap.xml` → 200 + `Content-Type: application/xml; charset=utf-8`, 발행 슬러그·태그·홈 포함·초안 0건(e2e 왕복).
  4. `GET /robots.txt` → 200 + `Content-Type: text/plain`, `Sitemap: {SITE_URL}/sitemap.xml` 절대 URL 포함.
  5. 태그·슬러그 수집을 N+1 없이 배치 로드.

### 스토리 S17.4 — Open Graph (봇 서버측 메타)

#### T-SEO-004 — OgMetaService + `GET /og/posts/:slug` (봇 OG HTML) — ✅ done (2026-06-08)
- **context**: PUB / **priority**: 90 / **deps**: T-SEO-001 / **tdd_first**: true / **예상**: 2h / **status**: done
- **변경 파일**: `packages/api/src/publishing/seo/og-meta.service.ts`(+`.spec`), `packages/api/src/publishing/seo/og.controller.ts`, `packages/api/src/common/app-setup.ts`, `packages/api/test/seo.e2e-spec.ts`
- **acceptance**:
  1. OgMetaService 가 발행 Post 로 `<head>` HTML 생성: `og:type=article`·`og:title`·`og:description`(요약)·`og:url`(슬러그 canonical 절대)·`og:image`(절대)·`twitter:card=summary_large_image`·`<link rel="canonical">` — 값 정확(단위 spec).
  2. 대표 이미지가 로컬 `/uploads/...` 면 `SITE_URL` 로 절대화, **외부 절대 URL 이거나 없으면 사이트 기본 이미지(`{SITE_URL}/og-default.png`)로 폴백**(외부 URL fetch 안 함). 기본 이미지는 T-SEO-006 이 web `public/` 에 배치하며 실제 200 으로 서빙되어야 한다.
  3. 메타 속성값에 따옴표·`<` 등이 있어도 HTML 이스케이프되어 안전.
  4. `GET /og/posts/:slug` (Twitterbot UA) → 200 + `text/html`, 위 메타 포함(e2e 왕복). **미발행/없는 slug → 404**(ADR-0026).
  5. 초안 slug 로 호출해도 404(발행 격리 검증).

### 스토리 S17.5 — 서빙 정합(진입 라우팅) · 정적 메타

#### T-SEO-005 — nginx 봇 UA 분기 + 산출물 프록시 + dev vite proxy — ✅ done (2026-06-08)
- **context**: WEB(서빙 정합) / **priority**: 91 / **deps**: T-SEO-002, T-SEO-003, T-SEO-004 / **tdd_first**: true / **예상**: 1.5h / **status**: done
- **변경 파일**: `packages/web/nginx.conf`, `packages/web/vite.config.ts`, `.env.example`(필요 시 주석)
- **acceptance**:
  1. nginx `map $http_user_agent $is_crawler` 가 대표 봇(facebookexternalhit·Twitterbot·kakaotalk·Slackbot·Discordbot·Googlebot·LinkedInBot)을 1로 판별.
  2. `location ~ ^/posts/` 에서 봇이면 `api:3000` 의 `/og/posts/...` 로 프록시, **사람(또는 무 UA)이면 `try_files $uri $uri/ /index.html`(SPA)** — 사람 트래픽 영향 0.
  3. `= /feed.xml`·`= /sitemap.xml`·`= /robots.txt`·`/og/` 가 `api:3000` 으로 프록시. dev `vite.config.ts` proxy 에도 동일 경로 추가.
  4. `nginx -t` 구성 검증 통과(봇 `map`·`/posts` 분기·산출물 프록시 문법) + 설정 정합 code-reviewer 검토. 실제 봇/사람 컨테이너 스모크(봇→OG HTML, 사람→`index.html`)는 prod 배포·격리 e2e 검증 항목(후속).

#### T-SEO-006 — web `index.html` 기본 OG 메타 + 피드 자동발견 link — ✅ done (2026-06-08)
- **context**: WEB / **priority**: 92 / **deps**: 없음 / **tdd_first**: true / **예상**: 30m / **status**: done
- **변경 파일**: `packages/web/index.html`, `packages/web/src/**`(존재 확인 단위 테스트)
- **acceptance**:
  1. `index.html <head>` 에 `<link rel="alternate" type="application/rss+xml" title="..." href="/feed.xml">` 추가.
  2. 사이트 기본 OG 메타(`og:site_name`·기본 `og:title`/`og:description`/`og:image`·`twitter:card`) 추가(글별 동적 OG 는 봇 경로 담당).
  3. 기본 OG 이미지 자산을 `packages/web/public/og-default.png` 에 배치 → `GET /og-default.png` 가 200 + `image/png` 로 서빙(절대규칙 #9 왕복, T-SEO-004 폴백이 참조).
  4. web 빌드·기존 단위/e2e 회귀 0(셀렉터·렌더 영향 없음).

## 진행 순서 요약

```
T-SEO-001 (유틸·env)
   ├─▶ T-SEO-002 (feed.xml)
   ├─▶ T-SEO-003 (sitemap.xml·robots)
   └─▶ T-SEO-004 (og/posts/:slug) ──▶ T-SEO-005 (nginx·vite 서빙 정합)
T-SEO-006 (index.html 정적 메타) — 독립
```

> 완료는 태스크별 `/finish T-SEO-00X`(검증→verifier acceptance→feature_list done→이 파일 동기화→handoff→commit). code-reviewer 가 commit 직전 자동 검토.
