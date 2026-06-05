# ADR-0023: 읽기 경험 부가 기능을 렌더타임 클라이언트 변환으로 구현

## 상태 (Status)

Accepted - 2026-06-05

## 컨텍스트 (Context)

"고급 블로그" 로드맵 B단계(읽기 경험). 본문은 sanitize 된 HTML(ADR-0021)이고, 글 상세는
`RichContent` 가 `dangerouslySetInnerHTML` 로 렌더한다. 읽기 경험을 높이기 위해 다음 4가지를 더한다:
**코드 하이라이트, 목차(TOC), 읽는 시간, 관련 글**.

이때 코드 하이라이트·헤딩 anchor·목차·읽는 시간은 "본문 HTML 에서 파생되는 표현(presentation)"이다.
이 파생값을 (a) DB 에 저장/비정규화할지, (b) 렌더 시점에 계산할지 결정이 필요하다. 기존 코드블록은
언어 정보 없이 `<pre><code>` 로 저장돼 있고(에디터 StarterKit 기본), 발행된 글도 32+건 존재한다.

## 결정 (Decision)

### 1. 파생 표현은 저장하지 않고 렌더타임에 계산한다
- 본문 HTML 이 단일 정규 소스(source of truth)다. 코드 하이라이트·헤딩 id·목차·읽는 시간은
  **클라이언트 렌더 직전 1회 변환**으로 만든다 → DB/마이그레이션/API 응답 스키마 변경 없음,
  **기존 글에도 즉시 소급 적용**.
- 처리 순서: 서버 sanitize → 클라이언트 sanitize(`RichContent` 의 기존 이중 방어 게이트) →
  **enhance**(우리가 생성하는 신뢰된 마크업) → 렌더. enhance 결과는 재-sanitize 하지 않는다.

### 2. 코드 하이라이트 = highlight.js 자동감지 (언어 미저장)
- 코드블록에 언어 class 가 없으므로 highlight.js 자동감지로 하이라이트하고 `hljs` 토큰 span 을 부착.
- highlight.js 는 **동적 import** 로 상세 페이지에서만 로드(초기 번들 분리). 로드 실패 시 평문 코드로
  graceful fallback. (정확한 언어 지정/에디터 언어 선택은 범위 외 — 추후 별도 태스크.)

### 3. 목차(TOC) = 헤딩 id 부여 + 사이드바 + 스크롤스파이
- `enhanceArticleHtml(html)` 가 h1~h3 에 slug id(중복 시 `-2` suffix)를 부여하고 `toc[]`
  (id·text·level)를 추출하는 **순수 함수**. 헤딩 없으면 빈 toc → 목차 숨김.
- `ArticleToc` 가 sticky 사이드바로 렌더, IntersectionObserver 로 현재 섹션 하이라이트,
  모바일은 `<details>` 접이식.

### 4. 읽는 시간 = 순수 함수
- `estimateReadingTime(html)` 가 태그 제거 후 글자 수 → 분(한글 ~500자/분, 최소 1분). 헤더 meta 표시.

### 5. 관련 글 = API 엔드포인트(태그 겹침 우선)
- `GET /api/posts/:idOrSlug/related?limit=4`: **발행글** 중 공유 태그 수 desc → `publishedAt` desc,
  자기 제외, 부족분 최신으로 보완. shared 에 `RelatedPostDto` 정의(양쪽 import).
- web `useRelatedPosts` 훅 + `RelatedPosts` 카드 그리드. 비거나 에러면 섹션 숨김.

### 6. 중복 제거
- `RichContent` 의 sanitize 로직을 `lib/sanitize-rich-html.ts` 로 추출해 enhancer 경로와 공유.

## 범위 외 (Out of Scope)
- 에디터 언어 선택/`language-xxx` 저장, 정확 하이라이트(자동감지로 대체).
- 읽는 시간 서버 저장·이미지 가중치, 목차 자동 펼침 깊이 설정.
- 관련 글 추천 고도화(임베딩·인기도), 관련 글 캐싱.

## 결과 (Consequences)

긍정:
- 스키마/마이그레이션 0 → 기존 글 소급 적용, 롤백 안전(렌더 코드만 되돌리면 됨).
- 파생 표현과 본문이 어긋날 일 없음(항상 본문에서 재계산).
- 순수 변환 함수(`enhanceArticleHtml`·`estimateReadingTime`)라 단위 테스트 용이(TDD).

부정/비용:
- 매 렌더 클라이언트 계산(useMemo 로 1회) + highlight.js 동적 import 1회 비용. 본문 글 1건 수준이라 무시 가능.
- 자동감지는 언어 오판 가능(트레이드오프; 추후 언어 지정으로 보완).
