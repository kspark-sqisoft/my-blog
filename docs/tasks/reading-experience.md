# reading-experience — 읽기 경험 (B단계)

> 정규 소스는 `feature_list.json`. 이 문서는 미러다(절대 규칙 #10). 근거: ADR-0023.

"고급 블로그" 로드맵 B단계. 본문 HTML 을 렌더타임에 변환해 코드 하이라이트·목차·읽는 시간을
더하고, 관련 글 API 를 추가한다. DB·스키마 변경 없이 기존 글에 소급 적용(ADR-0023).

## 태스크

#### T-READ-101 — 읽는 시간 유틸 + 헤더 표시
- priority: 72 / 의존: T-WEB-309 / status: done (2026-06-05)
- acceptance:
  1. `estimateReadingTime(html)` 순수 함수: 태그 제거 후 글자 수 → 분(한글 ~500자/분, 최소 1분).
  2. 빈 본문/태그만 있는 경우 안전(최소 1분 또는 0 처리 명시), HTML 엔티티·공백 정규화.
  3. PostDetail 헤더 meta 에 "· N분 읽기" 표시(저자·날짜 옆).
  4. 회귀 없음: web 단위 테스트 통과(reading-time 신규 spec 포함).

#### T-READ-102 — 코드 하이라이트(자동감지) + 헤딩 id 부여
- priority: 73 / 의존: T-WEB-309 / status: done (2026-06-05)
- acceptance:
  1. `enhanceArticleHtml(html)` 순수 변환: h1~h3 에 slug id(중복 `-2` suffix) 부여 + `toc[]`(id·text·level) 추출.
  2. 코드블록(`pre code`)에 highlight.js 자동감지 적용(hljs class), highlight.js 는 동적 import.
  3. 헤딩/코드 없으면 안전(toc 빈 배열, 원본 보존). sanitize 로직은 `sanitize-rich-html.ts` 로 공유.
  4. 상세 페이지 코드블록이 하이라이트되어 렌더. 회귀 없음: web 단위(article-enhance 신규 spec) 통과.

#### T-READ-103 — TOC 사이드바 + 스크롤스파이
- priority: 74 / 의존: T-READ-102 / status: todo
- acceptance:
  1. `ArticleToc` 가 `toc[]` 를 sticky 사이드바 목차로 렌더(데스크톱), 모바일 `<details>` 접이식.
  2. IntersectionObserver 로 현재 섹션 활성 하이라이트, 클릭 시 해당 헤딩으로 스크롤.
  3. toc 비면 목차 숨김 + 본문 풀폭. PostDetail 을 본문+TOC 2단 그리드로.
  4. 회귀 없음: web 단위(ArticleToc render/scroll-spy mock) 통과.

#### T-READ-104 — 관련 글 API + shared 타입 + web 섹션
- priority: 75 / 의존: T-WEB-309 / status: todo
- acceptance:
  1. shared `RelatedPostDto`(id·slug·title·coverImageUrl?·publishedAt·tags) 정의(양쪽 import).
  2. `GET /api/posts/:idOrSlug/related?limit=4`: 발행글 중 공유 태그 수 desc → publishedAt desc, 자기 제외, 부족분 최신 보완.
  3. web `useRelatedPosts` 훅 + `RelatedPosts` 카드 그리드, 비거나 에러면 섹션 숨김.
  4. 회귀 없음: api 단위(related 정렬·자기제외·보완·발행만) + web 단위 통과.

## 다음 단계 (이 feature 의 후속)
- 에디터 코드 언어 선택 + 정확 하이라이트(자동감지 보완)
- 관련 글 추천 고도화(인기도·조회수 기반)
