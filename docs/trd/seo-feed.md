# TRD — seo-feed (피드 · 사이트맵 · Open Graph)

> Phase 4 산출물. 입력: `docs/prd/seo-feed.md`, `docs/glossary.md`, `docs/bounded-contexts.md`.
> 구현 코드는 작성하지 않는다(Phase 7). 본 문서의 "주요 결정"은 ADR-0026 으로 분리한다.

## 1. 아키텍처 개요

seo-feed 는 **새 도메인 모델·새 BC 없이** Publishing 의 발행 읽기 모델을 외부 표준 포맷으로 노출한다. 산출물은 세 갈래다.

```
                            ┌─────────────────────────────────────────────┐
   크롤러/피드리더/SNS  ───▶ │  진입(prod: nginx :80 / dev: vite :5173)      │
                            └───────────────┬─────────────────────────────┘
            ┌───────────────────────────────┼───────────────────────────────┐
            │ /feed.xml /sitemap.xml         │ /posts/:slug (봇 UA)           │ 그 외 모든 경로
            │ /robots.txt                    │                                │ (사람 트래픽)
            ▼                                ▼                                ▼
   ┌──────────────────┐          ┌──────────────────────┐        ┌──────────────────┐
   │ api(NestJS)       │          │ api(NestJS)            │        │ SPA(index.html)   │
   │ 동적 XML 생성     │          │ OG 메타 HTML 생성      │        │ 기존과 동일 부팅   │
   │ (prefix 제외)     │          │ (prefix 제외, 봇 전용) │        │ (영향 0)          │
   └────────┬─────────┘          └───────────┬────────────┘        └──────────────────┘
            │ 발행 Post 읽기                  │ slug 로 발행 Post 읽기
            ▼                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │ PostService / Prisma — 발행(PUBLISHED) Post 만 읽기 전용 조회  │
   └──────────────────────────────────────────────────────────┘
```

핵심: **사람 트래픽은 기존 SPA 경로를 그대로 탄다(영향 0).** 크롤러/피드리더만 api 가 생성한 산출물을 받는다.

## 2. 백엔드 모듈 구조 (BC 1:1 — Publishing)

`PublishingModule`(=PostModule) 안에 SEO 산출물 책임을 추가한다. 별도 BC 가 아니므로 **새 모듈을 만들지 않고** Publishing 모듈에 컨트롤러·서비스를 더한다.

| 요소 | 역할 |
|---|---|
| `SeoController` | 루트 경로(prefix 제외) `GET /feed.xml`·`GET /sitemap.xml`·`GET /robots.txt` 제공 |
| `OgController` | 루트 경로(prefix 제외) `GET /og/posts/:slug` 등 — 봇용 OG 메타 HTML |
| `FeedService` | 발행 Post → RSS 2.0 XML 문자열 생성(요약만) |
| `SitemapService` | 발행 Post 슬러그 + 태그 + 정적 URL → sitemap XML 생성 |
| `OgMetaService` | slug → 발행 Post 조회 후 OG/Twitter 메타 HTML 생성(없음/미발행은 기본 사이트 메타) |
| (재사용) `PostService`·`toSummaryText`·`extractFirstImageUrl`·`slugify` | 발행 조회·평문 요약·대표 이미지 파생 그대로 사용 |

> 모든 조회는 **읽기 전용**이며 `status: 'PUBLISHED'` 필터를 강제한다(초안·미발행 절대 비노출 — PRD 보안요구). 한 트랜잭션 다중 Aggregate 수정 없음(DDD 정합).

## 3. 라우팅·서빙 (prefix 제외 + 진입 라우팅)

### 3.1 전역 prefix 제외
`app-setup.ts` 의 `setGlobalPrefix('api', { exclude: [...] })` 로 다음을 prefix 밖 루트 경로로 노출한다(현행 `/uploads` 선례와 동일 사상):
- `/feed.xml`, `/sitemap.xml`, `/robots.txt`
- `/og/(.*)` (봇 OG HTML)

### 3.2 진입(nginx/vite) 라우팅
- **prod nginx**: `location = /feed.xml`, `= /sitemap.xml`, `= /robots.txt` 를 `api:3000` 으로 프록시 추가(`/uploads/` 와 동일 블록). 봇 OG 는 §4 참조.
- **dev vite**: `server.proxy` 에 `/feed.xml`·`/sitemap.xml`·`/robots.txt`·`/og` 를 `VITE_API_PROXY` 로 추가(현행 `/uploads` 와 동일).

## 4. OG 메타 — SPA 크롤러 대응 (핵심 결정 · ADR-0026)

### 트레이드오프
| 대안 | 장점 | 단점 | 판정 |
|---|---|---|---|
| **A. 봇 UA 감지 → api OG HTML**(추천) | React SSR 불필요(최경량), api 가 web dist 에 의존 안 함, 사람 트래픽 영향 0, 모든 산출물을 api 한 곳에서 | nginx UA map 유지보수(크롤러 목록), 일부 비표준 봇 누락 가능 | **채택** |
| B. 글 상세 전체 SSR(React 서버 렌더) | 사람·봇 동일 HTML, 가장 견고 | Vite SPA→SSR 전환 = 대공사, 하이드레이션·번들 위험, 범위 초과 | 기각(과대) |
| C. api 가 web index.html 에 메타 주입 | UA 감지 불필요 | api 가 web 빌드 산출물(자산 해시) 의존 → 컨테이너 경계 붕괴 | 기각 |
| D. 빌드타임 프리렌더 | 런타임 비용 0 | 글이 동적이라 발행마다 재빌드 필요 → 부적합 | 기각 |

### 채택안(A) 동작
1. **nginx**: `map $http_user_agent $is_crawler { default 0; ~*(facebookexternalhit|Twitterbot|kakaotalk|Slackbot|Discordbot|...|Googlebot) 1; }`. `location ~ ^/posts/` 에서 `$is_crawler` 면 `api:3000` 의 `/og/posts/...` 로, 아니면 기존 `try_files`(SPA).
2. **api `OgController`**: slug 로 발행 Post 조회 → `<head>` 에 `og:*`/`twitter:*` 채운 최소 HTML(+`<noscript>` 요약, canonical) 반환. 미발행/없음 → 기본 사이트 메타(또는 404 정책은 ADR-0026 에서 확정).
3. **사람**: `/posts/:slug` 는 기존 SPA 그대로(변경 0).

> dev 에서는 nginx 가 없으므로 봇 분기를 vite 로 흉내내지 않고, OG 검증은 `curl -A "Twitterbot" .../og/posts/:slug` 또는 api e2e 로 직접 친다(절대규칙 #9 — 크롤러 UA HTML 에 `og:*` 실제 포함 확인).

## 5. API/산출물 명세 (요청·응답 예시)

### 5.1 `GET /feed.xml` (RSS 2.0, 요약만)
- 요청: `GET /feed.xml` (공개, 인증 없음)
- 응답 200, `Content-Type: application/rss+xml; charset=utf-8`, `Cache-Control: public, max-age=300`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>디버그 노트</title>
    <link>https://blog.example.com</link>
    <description>...</description>
    <atom:link href="https://blog.example.com/feed.xml" rel="self" type="application/rss+xml"/>
    <item>
      <title>슬러그 기반 URL 도입기</title>
      <link>https://blog.example.com/posts/슬러그-기반-url-도입기</link>
      <guid isPermaLink="true">https://blog.example.com/posts/슬러그-기반-url-도입기</guid>
      <description>본문 평문 요약 200자…</description>
      <pubDate>Tue, 03 Jun 2026 09:00:00 GMT</pubDate>
      <dc:creator>박기순</dc:creator>
    </item>
  </channel>
</rss>
```
- 규칙: 발행글만, `publishedAt` 최신순, 최대 `FEED_MAX_ITEMS`(기본 20). 모든 텍스트 XML 이스케이프. 작성자는 RSS `author`(이메일 필드, PII)가 아니라 `dc:creator`(Dublin Core, 표시 이름)로 노출한다 — `xmlns:dc` 선언 필수. 발행글·작성자·태그는 **단일/배치 쿼리로 한 번에 로드(N+1 금지 — PRD 비기능)**.

### 5.2 `GET /sitemap.xml` (sitemaps.org 0.9)
- 응답 200, `Content-Type: application/xml; charset=utf-8`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://blog.example.com/</loc></url>
  <url><loc>https://blog.example.com/posts/슬러그-기반-url-도입기</loc><lastmod>2026-06-03</lastmod></url>
  <url><loc>https://blog.example.com/tags/nestjs</loc></url>
</urlset>
```
- 포함: 홈 + 발행글 슬러그 URL(`lastmod`=`updatedAt`) + 태그 페이지(`/tags/:name`). 초안 제외. 태그/정적 lastmod 는 선택.

### 5.3 `GET /robots.txt`
- 응답 200, `Content-Type: text/plain`
```
User-agent: *
Allow: /
Sitemap: https://blog.example.com/sitemap.xml
```

### 5.4 `GET /og/posts/:slug` (봇 전용 OG HTML)
- 요청: 크롤러 UA(nginx 가 라우팅). 직접 호출도 가능(테스트).
- 응답 200, `Content-Type: text/html; charset=utf-8`
```html
<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<title>슬러그 기반 URL 도입기 — 디버그 노트</title>
<link rel="canonical" href="https://blog.example.com/posts/슬러그-기반-url-도입기">
<meta property="og:type" content="article">
<meta property="og:title" content="슬러그 기반 URL 도입기">
<meta property="og:description" content="본문 평문 요약…">
<meta property="og:url" content="https://blog.example.com/posts/슬러그-기반-url-도입기">
<meta property="og:image" content="https://blog.example.com/uploads/abc.jpg">
<meta name="twitter:card" content="summary_large_image">
</head><body><noscript>본문 평문 요약…</noscript></body></html>
```
- 미발행/없는 slug → 사이트 기본 메타(제목·설명·기본 이미지) 또는 404(ADR-0026 확정). `og:image` 없으면 사이트 기본 이미지.

## 6. DB 스키마

**변경 없음.** 새 모델·컬럼·마이그레이션 없다. `Post.updatedAt`(이미 존재, `@updatedAt`)을 `lastmod` 소스로 읽기만 한다. seo-feed 는 순수 읽기 기능이다.

## 7. 프론트엔드 (web)

- **정적 `<head>` 보강(`packages/web/index.html`)**: 피드 자동발견 `<link rel="alternate" type="application/rss+xml" href="/feed.xml">` + 사이트 기본 OG 메타(`og:site_name`·기본 `og:title`/`og:description`/기본 이미지). 글별 동적 OG 는 §4 봇 경로가 담당.
- 새 페이지·라우트 없음. 사람용 SPA 흐름 변경 없음.

## 8. 공유 타입 (packages/shared)

**추가 없음.** 산출물은 서버측 XML/HTML 문자열이라 클라이언트와 공유할 DTO 가 없다. **함정 #9 회피에 유리**(shared 에 라이브러리 값/스키마를 넣지 않는다 — 본 기능은 shared 를 건드리지 않음).

## 9. 외부 의존성 (라이브러리 선택)

| 후보 | 결정 |
|---|---|
| RSS/sitemap 생성 | **수동 XML 문자열 생성**(api 내 작은 빌더 + XML 이스케이프 유틸). RSS 2.0/sitemap 0.9 는 필드가 단순(요약만)해 라이브러리 불필요. 의존성 0, 함정 #9 안전. |
| XML/HTML 이스케이프 | 자체 유틸(`&<>"'` 치환) + 단위 테스트. 사용자 콘텐츠 주입 방지(PRD M7). |
| 봇 감지 | nginx `map`(런타임 의존 0). api 는 UA 무관하게 OG HTML 제공(테스트 용이). |

> 모든 신규 코드·의존성은 **api 전용**. shared 는 변경하지 않는다.

## 10. 환경변수

- **신규 `SITE_URL`**(예: `https://blog.example.com`): 절대 URL(og:url/og:image, feed/sitemap loc, robots Sitemap) 생성 기준. `.env.example` + `docker-compose`(api environment) 주입. 하드코딩 금지. dev 기본값(`http://localhost:5173`) 허용.
- **신규 `FEED_MAX_ITEMS`**(기본 20, 선택): 피드 항목 상한.
- `og:image` 의 상대 경로(`/uploads/...`)는 `SITE_URL` 기준으로 절대화.

## 11. 보안 처리

- **발행 격리**: 모든 조회에 `status:'PUBLISHED'` 강제 — 초안/미발행은 feed·sitemap·OG 어디에도 노출 금지(테스트로 검증).
- **주입 방지**: 제목·요약·작성자·태그 등 사용자 콘텐츠는 XML/HTML 이스케이프(PRD M7). OG HTML 은 메타 속성값도 이스케이프.
- **PII**: 작성자는 표시 이름(`name`)만 노출(이메일 금지) — 기존 authorName 규칙 유지.
- **SSRF/경로·외부 이미지**: `og:image` 는 로컬 `/uploads` 상대경로를 `SITE_URL` 로 절대화한다. 본문 파생 이미지가 **외부 절대 URL**(`https://other...`)이면 신뢰하지 않고 **사이트 기본 이미지로 폴백**한다(외부 URL 을 fetch 하지 않고 카드에도 노출 안 함). 이로써 SSRF·외부 추적·깨진 카드를 동시에 차단한다.

## 12. 테스트 전략

- **api e2e**(절대규칙 #9 쓰기-읽기 왕복):
  - `GET /feed.xml` → 200 + `application/rss+xml`, 발행글 포함·초안 제외, 항목 수 ≤ N, XML 파싱 유효.
  - `GET /sitemap.xml` → 200 + `application/xml`, 발행 슬러그·태그·홈 포함, 초안 0건.
  - `GET /robots.txt` → 200 + `text/plain`, `Sitemap:` 절대 URL 포함.
  - `GET /og/posts/:slug` (Twitterbot UA) → 200 + `text/html`, `og:title/description/image/url`·`twitter:card` 존재·값 정확. 미발행/없는 slug → **404**(ADR-0026 확정값, 아래 §14-1).
  - **nginx 봇 분기 정합**(W1): 봇 UA 면 OG HTML, 사람 UA(또는 무 UA)면 SPA `index.html` 이 반환되는지 — nginx `-t` 구성 검증 + 컨테이너 스모크(봇/사람 각각 1회)로 확인. 정규식 `location ~ ^/posts/` 안에서도 사람 트래픽은 `try_files $uri $uri/ /index.html` 를 그대로 타야 한다(영향 0).
- **단위(api)**: XML 이스케이프, FeedService(요약·이스케이프·순서·상한), SitemapService(URL 집합·초안 제외), OgMetaService(절대 URL·이미지 없음 폴백).
- **web 단위**: `index.html` 에 feed 자동발견 link + 기본 OG 메타 존재.
- **수동 검증(출시)**: 카톡/페이스북/트위터 공유 디버거 실제 카드 렌더.

## 13. 주요 결정 → ADR 분리 (Phase 5)

다음을 **ADR-0026 (seo-feed: 피드·사이트맵·Open Graph)** 하나로 묶어 기록한다(기존 기능당 ADR 1개 패턴 — 0020/0021/0024 와 동일). 개별 결정:
1. seo-feed 는 새 BC·새 스키마 없이 Publishing 읽기 모델로 구현(파생 원칙, ADR-0015 계열).
2. **OG 메타 = 봇 UA 감지 → api OG HTML**(대안 SSR/주입 기각) — 핵심.
3. 동적 산출물은 api 가 생성하고 `setGlobalPrefix` exclude 로 루트 경로 노출, nginx/vite 가 프록시(`/uploads` 선례).
4. RSS/sitemap 은 수동 XML 생성(라이브러리 0, 함정 #9 안전), 사용자 콘텐츠 이스케이프.
5. 절대 URL 기준 `SITE_URL` 환경변수 도입.
6. 발행 격리·읽기 전용(초안 비노출), shared 무변경.

## 14. 오픈 이슈 (Phase 5/6 에서 확정)

1. 미발행/없는 slug 의 OG 응답 → **404 로 확정**(ADR-0026). 발행 격리·정확성 일관성(없는 글의 카드를 만들지 않음). 사람도 SPA 404 를 본다.
2. nginx 봇 UA 목록 초기 집합(facebookexternalhit·Twitterbot·kakaotalk·Slackbot·Discordbot·Googlebot·LinkedInBot 등) 확정.
3. 태그 페이지 `lastmod` = 해당 태그 최신글 `updatedAt` 적용 여부.
4. 피드/사이트맵 캐시: `Cache-Control` 만으로 충분한지(in-memory 캐시는 보류).

---
*작성: Phase 4 (/trd). 다음: Phase 5 `/adr`(ADR-0026) → Phase 6 `/tasks seo-feed`. 검토: plan-critic 독립 검토 후 사용자 확인.*
