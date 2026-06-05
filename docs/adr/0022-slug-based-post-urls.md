# ADR-0022: 슬러그 기반 글 URL (canonical) + cuid 리다이렉트

## 상태 (Status)

Accepted - 2026-06-05

## 컨텍스트 (Context)

글 상세 URL이 `/posts/{cuid}`(예: `/posts/cmpz9j67s00012jpddg2rz23a`)다. 불투명한 cuid는
가독성·공유·검색엔진 최적화(SEO)에 불리하다. "고급 블로그"의 발견/유입(SEO·공유) 강화의 첫
단계로, 사람이 읽을 수 있는 슬러그 URL(`/posts/nestjs-입문`)을 도입한다. 이미 발행된 글
(32+건)과 기존 cuid 링크/북마크가 깨지지 않아야 한다.

## 결정 (Decision)

### 1. 슬러그 모델
- `Post.slug`(String, **@unique**) 컬럼을 추가한다.
- 슬러그는 제목에서 파생한다(`slugify`): ASCII 소문자화, 공백→`-`, **한글·영숫자·`-` 만 남기고**
  나머지 제거, 중복 `-` 정리, 좌우 `-` 트림, 최대 80자, 빈 결과면 `post` 폴백.
  한글은 보존한다(한글 SEO 정상, 주소창 가독성). 동의어 금지: permalink(코드/문서는 "슬러그"로 통일).
- 유일성: 기본 슬러그가 이미 있으면 `-2`, `-3` … 를 붙여 유일화한다.
- 슬러그는 **생성 시 1회 확정되고 이후 불변(v1)**. (작성자 수정 기능은 추후 ADR/태스크 — 변경 시
  기존 링크/SEO 영향 때문에 별도 결정.)

### 2. 라우팅·조회 (canonical + 리다이렉트)
- canonical 공개 URL은 `/posts/{slug}`.
- 공개 상세 API는 `GET /api/posts/:idOrSlug` 단일 엔드포인트로 **슬러그 우선, 없으면 cuid** 로
  발행글을 조회하고 응답에 `slug`를 포함한다. (cuid 와 slug 모두 수용)
- 프론트 `PostDetail`은 진입 param 이 응답 `slug` 와 다르면 `/posts/{slug}` 로 `replace` 이동한다.
  → 기존 `/posts/{cuid}` 링크로 들어와도 canonical 슬러그 URL 로 정리된다(SPA 클라이언트 리다이렉트).
- 관리자 편집 라우트(`/admin/posts/:id/edit`)는 내부 **id 기준 그대로** 둔다(공개 노출 아님).

### 3. 마이그레이션
- `slug` 컬럼 추가 마이그레이션 + 기존 글 일회성 **백필 스크립트**(제목→슬러그, 멱등). dev `blog`,
  test `blog_test` 양쪽 적용(기존 절차 동일).

## 범위 외 (Out of Scope)
- 글별 메타/OG 태그, sitemap.xml, RSS/Atom(같은 SEO 시리즈의 다음 단계 A②③ — 별도 태스크).
- 슬러그 수동 편집, 날짜 프리픽스(`/2026/06/slug`), 다국어 슬러그.

## 결과 (Consequences)

긍정:
- 사람이 읽는 URL → 공유/검색 유입·가독성 향상. 슬러그가 OG `url`·sitemap·RSS `link`의 기반이 된다.
- 단일 `:idOrSlug` 엔드포인트 + 클라이언트 리다이렉트로 기존 cuid 링크 무손실 + canonical 일원화.

부정/비용:
- `slug` 유일성 관리(충돌 시 접미사) + 백필 필요. 제목 수정 시 슬러그는 불변이라 의미가 어긋날 수 있음
  (v1 트레이드오프; 추후 편집 기능으로 보완).
- 상세 조회가 slug→cuid 폴백 2단계가 될 수 있음(인덱스로 비용 무시 가능).
