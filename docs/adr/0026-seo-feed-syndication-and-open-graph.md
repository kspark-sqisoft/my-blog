# ADR-0026: seo-feed — 피드·사이트맵·Open Graph (봇 UA 감지 서버측 메타)

## 상태 (Status)

Accepted - 2026-06-08

## 컨텍스트 (Context)

블로그에는 발행 콘텐츠(슬러그 URL[ADR-0022]·대표 이미지[ADR-0015]·평문 요약·작성자·발행/수정일)가 충분하지만, 그것이 **발견(검색)·공유(SNS)·구독(피드)** 되는 경로가 없다(PRD `docs/prd/seo-feed.md`).

제약·평가 기준:
- web 은 **Vite SPA(CSR)** 다. 크롤러/SNS 봇이 자바스크립트 실행 없이 받는 초기 HTML(`packages/web/index.html`)에는 글별 메타가 비어 있어 공유 카드가 뜨지 않는다.
- prod 는 **nginx 가 SPA 정적 서빙 + `/api/`·`/uploads/` 만 api 프록시**, 나머지는 `try_files → index.html`(SPA fallback). api 는 NestJS 전역 prefix `/api`, `/uploads` 만 prefix 제외 정적 서빙(`packages/api/src/common/app-setup.ts`).
- 피드·사이트맵은 **발행글 기반 동적 산출물**이라 정적 파일로 둘 수 없다.
- BC 상 seo-feed 는 새 도메인 모델이 아니라 Publishing 의 **읽기 파생**이다(`docs/bounded-contexts.md` — PostSummary[ADR-0015]와 동형). 새 Aggregate·Entity·Domain Event·스키마가 없어야 한다.
- 절대 규칙 #9(반환 산출물의 실제 서빙 왕복 검증), 함정 #9(shared 순수성 — 라이브러리 값 금지)를 지켜야 한다.

핵심 갈림길은 **SPA 환경에서 크롤러가 Open Graph 메타를 읽게 하는 방법**이다.

## 결정 (Decision)

seo-feed 를 **새 BC·새 스키마 없이 Publishing 의 읽기 전용 파생 기능**으로 구현하고, 산출물을 다음과 같이 제공한다.

1. **OG 메타 = 봇 User-Agent 감지 → api 가 OG HTML 생성**.
   - prod nginx 가 `map $http_user_agent $is_crawler` 로 크롤러를 판별하고, `location ~ ^/posts/` 에서 봇이면 api 의 `GET /og/posts/:slug` 로 프록시, 사람이면 기존 `try_files ... /index.html`(SPA)를 그대로 탄다(사람 트래픽 영향 0).
   - api `OgController` 는 slug 로 **발행 Post 만** 조회해 `og:*`/`twitter:card`·canonical 을 채운 최소 HTML 을 반환한다. **미발행/없는 slug 는 404**(발행 격리·정확성 일관성 — 없는 글의 카드를 만들지 않는다).
   - 대안 기각: (B) 글 상세 전체 React SSR = Vite SPA→SSR 대공사로 범위 초과, (C) api 가 web `index.html` 에 메타 주입 = api 가 web 빌드 자산 해시에 의존해 컨테이너 경계 붕괴, (D) 빌드타임 프리렌더 = 글이 동적이라 부적합.

2. **동적 산출물(`/feed.xml`·`/sitemap.xml`·`/robots.txt`)은 api 가 생성**하고, `setGlobalPrefix('api', { exclude: [...] })` 로 루트 경로에 노출한다(현 `/uploads` 정적 서빙과 동일 사상). prod nginx·dev vite 는 이 경로를 api 로 프록시한다.

3. **RSS 2.0·sitemap 0.9 는 수동 XML 문자열로 생성**(라이브러리 0 — 함정 #9 안전). 모든 사용자 콘텐츠는 XML/HTML 이스케이프(주입 방지). 피드는 **요약만**(전문 아님), `publishedAt` 최신순 최대 `FEED_MAX_ITEMS`(기본 20). 작성자는 PII 인 RSS `author`(이메일) 대신 **`dc:creator`(표시 이름)** 로 노출한다.

4. **사이트맵 범위 = 홈 + 발행글 슬러그 URL + 태그 페이지(`/tags/:name`)**. 글 `lastmod` 는 `Post.updatedAt`(없으면 `publishedAt`). 초안·미발행은 어떤 산출물에도 노출하지 않는다.

5. **절대 URL 기준은 신규 환경변수 `SITE_URL`**(하드코딩 금지). `og:image` 는 로컬 `/uploads` 상대경로를 `SITE_URL` 로 절대화하되, 본문 파생 이미지가 **외부 절대 URL 이면 사이트 기본 이미지로 폴백**한다(외부 URL 을 fetch 하지 않고 카드에도 노출하지 않음 — SSRF·외부 추적·깨진 카드 차단).

6. **shared·DB 무변경**: 산출물은 서버측 XML/HTML 문자열이라 공유 DTO 가 없고, Prisma 스키마/마이그레이션도 없다. 신규 코드·의존성은 api 전용이다.

## 결과 (Consequences)

긍정:
- 사람 트래픽은 기존 SPA 경로를 그대로 타므로 **회귀 위험이 낮다**(영향 0). React SSR 도입 없이 공유 카드를 확보한다.
- 모든 산출물 로직이 **api 한 곳**에 모이고, web 빌드 자산에 의존하지 않아 컨테이너 경계가 유지된다.
- 새 BC·스키마·shared 변경이 없어 prod 부팅 크래시(함정 #9) 위험이 없고, PostSummary 파생 패턴을 재사용한다.
- 라이브러리 0(수동 XML)으로 의존성·공급망 표면이 늘지 않는다.

부정/감수해야 할 것:
- **nginx `$http_user_agent` map 의 크롤러 목록을 유지보수**해야 한다(facebookexternalhit·Twitterbot·kakaotalk·Slackbot·Discordbot·Googlebot·LinkedInBot 등). 신규/비표준 봇은 카드를 못 받을 수 있다.
- 봇 경로와 사람 경로가 **분기**하므로, "봇이면 OG·사람이면 SPA" 정합을 컨테이너 스모크(nginx `-t` + 봇/사람 각 1회)로 검증해야 한다(절대 규칙 #9). dev 에는 nginx 가 없어 OG 검증은 `curl -A` UA 또는 api e2e 로 직접 친다.
- OG HTML 은 메타 전용 최소 문서라(하이드레이션 없음) 봇이 본문 전체를 읽지는 못한다(`<noscript>` 요약까지만) — 검색 색인 본문은 사이트맵+사람 경로에 의존.

## 검토 시점

- web 에 SSR/프리렌더(예: Next/Vite SSR)를 도입하게 되면 결정 1(봇 분기)을 **새 ADR 로 supersede** 한다(SSR 이면 사람·봇 동일 HTML 로 OG 가 자연 해결).
- 공유 카드 누락 봇이 반복 발생하면 UA map 정책을 재평가한다.
- JSON-LD·Atom·동적 OG 이미지·작성자 프로필 URL(author-profile 출시 후 사이트맵 포함) 등 보류 항목은 후속 기능에서 별도 결정한다.
