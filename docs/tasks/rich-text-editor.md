# rich-text-editor — 본문 WYSIWYG 전환

> 정규 소스는 `feature_list.json`. 이 문서는 미러다(절대 규칙 #10).
> 근거: ADR-0021(supersedes ADR-0003) / PRD: `docs/prd/rich-text-editor.md` / TRD: `docs/trd/rich-text-editor.md`.

## 배경
본문 모델을 마크다운에서 sanitize 된 HTML 로 전환한다. 에디터는 TipTap. 색/크기는 화이트리스트
Tailwind 클래스로만. 기존 글은 일회성 마이그레이션으로 contentMarkdown → contentHtml 자동 변환.

## 태스크

#### T-INFRA-301 — shared richHtmlSchema + DTO 갱신
- priority: 57 / 의존: 없음 / status: done (2026-06-05)
- 산출:
  - `packages/shared/src/rich-html-schema.ts`: `richHtmlSchema` + `RICH_HTML_SPAN_CLASSES`(색 8 + 크기 4) + `RichHtmlSchema`/`RichHtmlSpanClass` 타입.
  - `packages/shared/src/index.ts`: 위 export 추가.
  - `packages/shared/src/dto/post.ts`: `PostDetailDto.contentHtml?: string`, `CreatePostDto.contentHtml?: string` 과도기 optional 로 추가. `contentMarkdown` 은 deprecated 표시 후 유지 — T-PUB-301 이 required 로 회수 + contentMarkdown 응답 제거.
  - `packages/api/src/publishing/rich-html-schema.spec.ts` 신규 7 케이스: 허용/위험 태그, a/img/video 속성, span/code/pre/p 의 class 만 허용(인라인 style 금지), span class 화이트리스트(색·크기 프리셋), 스킴 화이트리스트.
- acceptance:
  1. `richHtmlSchema` export + unit spec(7 케이스). ✅
  2. CreatePostDto 에 `contentHtml` 추가 — **과도기 optional**(T-PUB-301 에서 required 회수 + 컴파일 enforce). 부분 충족(과도기 기준).
  3. PostDetailDto.contentHtml 노출 — **과도기 optional**(T-PUB-301 에서 required + contentMarkdown 응답 제거). 부분 충족.
- 비고: acceptance 2·3 의 "필수/응답 제거" 부분은 contentHtml 가 실제 값으로 채워지는 T-PUB-301(서버 sanitize 적용)에서 회수한다. 지금 시점에 required 로 바꾸면 호출처 컴파일이 깨져 단계 의미가 사라진다.

#### T-INFRA-302 — Prisma 스키마: Post.contentHtml 컬럼 + 마이그레이션
- priority: 58 / 의존: T-INFRA-301 / status: done (2026-06-05)
- 산출:
  - `schema.prisma`: Post 모델에 `contentHtml String @default("")` 추가. contentMarkdown 은 `@deprecated` 주석으로 과도기 보존.
  - 마이그레이션: `prisma/migrations/20260604151420_add_post_content_html/migration.sql` 생성, dev DB(`blog`) + 테스트 DB(`blog_test`) 양쪽 적용.
- acceptance:
  1. `posts.contentHtml text NOT NULL default ''` 컬럼 생성. ✅ (psql `\d posts` 확인)
  2. 기존 row 는 default `''` 로 채워짐 — T-INFRA-303 가 markdown→html 변환으로 덮어쓴다. ✅
  3. blog_test DB 도 마이그레이션 통과: api 통합/e2e(`pnpm test` 102/102, `pnpm test:e2e` 10/61) 회귀 0. ✅

#### T-INFRA-303 — 일회성 마이그레이션 스크립트 (markdown → html)
- priority: 59 / 의존: T-INFRA-302 / status: done (2026-06-05)
- 산출:
  - 의존성: `markdown-it`, `sanitize-html` (+ types).
  - 변환 헬퍼 `packages/api/src/publishing/markdown-to-html.ts`: `convertMarkdownToHtml`, `sanitizeRichHtml` export. markdown-it(html+linkify) → mp4 img→video 후처리 → sanitize-html(richHtmlSchema, a 태그에 target/rel 자동 부착).
  - 단위 spec `markdown-to-html.spec.ts` (10 케이스): 기본 변환, jpg/mp4 분기, script/onerror 제거, javascript: 차단(마크다운+raw a 양쪽), 외부 a 의 target/rel 자동, 멱등, 빈 입력.
  - 일회성 스크립트 `scripts/migrate-md-to-html.ts` + pnpm 명령 `migrate:md-to-html` (dry-run 지원).
  - 실제 dev DB 적용: 2 글 변환 완료. 2차 실행 멱등 검증(changed=0/skipped=2).
- acceptance:
  1. 스크립트 실행 후 모든 Post 의 contentHtml 이 비지 않는다. ✅
  2. `.mp4` 이미지 임베드 → `<video src controls preload="metadata" playsinline>` 보존. ✅ (실제 DB 결과로 확인)
  3. `<script>`/onerror/javascript: 등 위험 입력 제거. ✅ (단위 spec 4건)
  4. 멱등. ✅ (실제 2차 실행 결과 + 단위 spec)

#### T-PUB-301 — api PostService: contentHtml 입력 + sanitize + 응답 형식
- priority: 60 / 의존: T-INFRA-302 / status: done (2026-06-05)
- 산출:
  - `dto/create-post.dto.ts`, `dto/update-post.dto.ts`: `contentMarkdown`/`contentHtml` 모두 optional. 서비스가 정합성 강제.
  - `post.service.ts`: `resolveBody(input)` 헬퍼(contentHtml 우선 sanitize, 없으면 markdown → html), create/update 가 contentMarkdown+contentHtml 양쪽에 저장, `toDetail` 에 contentHtml 노출.
  - `post.controller.ts` 가 `dto.contentHtml` 도 전달.
  - e2e 3 신규: contentHtml 입력 OK + 응답 contentHtml, `<script>`/onerror 제거(응답+상세), contentMarkdown 호환.
- acceptance:
  1. `POST/PATCH /api/posts { contentHtml }` → sanitize 결과로 DB 저장. ✅
  2. `<script>`/`onerror` 등 위험 태그 응답·DB 에서 제거. ✅
  3. `GET /api/posts/:id` 응답에 contentHtml 포함. ✅ / `contentMarkdown` 키 응답에서 제거는 **T-WEB-303(클라가 contentHtml 사용 전환) 이후 별도 ADR/태스크에서 회수** — 점진 전환을 위해 과도기 동안 양쪽 노출.

#### T-PUB-302 — 파생값(summary/coverImageUrl) HTML 입력 대응
- priority: 61 / 의존: T-PUB-301 / status: done (2026-06-05)
- 산출:
  - 의존성 `cheerio` 추가.
  - `cover-image.ts`: `extractFirstImageUrl(html)` 을 cheerio 기반으로 재작성 — DOM 순회로 첫 `<img>`/`<video>` 중 더 먼저 등장하는 src 반환. 함수명 호환 유지(슈퍼셋 의미).
  - `markdown-summary.ts`: `toSummaryText(html, max)` 를 cheerio.text() 기반 평문 추출.
  - `post.service.ts` `toSummary`: contentHtml 우선 사용(빈 경우 contentMarkdown 폴백).
  - spec 갱신: cover-image 8 + summary 6 케이스 모두 HTML 입력 기준.
- acceptance:
  1. HTML 본문에서 첫 미디어 URL 정확히 추출(.mp4 첫 노드면 그 URL). ✅
  2. 평문 요약이 헤딩/마크업 없이 200자 trim. ✅
  3. 기존 e2e 회귀 0건 — unit 18/116 pass, e2e 10/64 pass. ✅

#### T-WEB-301 — TipTap 기반 RichEditor 컴포넌트
- priority: 62 / 의존: T-INFRA-301 / status: todo
- 산출:
  - `packages/web/src/components/editor/RichEditor.tsx` 신규. StarterKit + Link + Underline + Image + Video(커스텀 노드) + TextStyle + Color + FontSize.
  - `Toolbar.tsx` 분리(B/I/U/S/Code, H1·H2·H3, List/OrderedList, Blockquote, CodeBlock, Link, HorizontalRule, 색 8 + 크기 4, 미디어 업로드).
  - 색/크기는 Tailwind 클래스(`text-red-500`, `text-lg` 등) 로 노드에 부착.
- acceptance:
  1. 도구바의 모든 버튼이 onClick 으로 editor 명령을 실행하고 활성 상태(isActive) 가 반영된다.
  2. `editor.getHTML()` 가 화이트리스트 클래스만 사용(인라인 style 없음).
  3. 미디어 업로드 버튼은 기존 useUploadImage 훅을 호출, 응답 url 로 setImage/setVideo.

#### T-WEB-302 — PostEditor 통합 (textarea → RichEditor)
- priority: 63 / 의존: T-WEB-301, T-PUB-301 / status: todo
- 산출:
  - `pages/admin/PostEditor.tsx` 의 본문 textarea 를 RichEditor 로 교체. 기존 invalidField/검증 로직 유지.
  - 저장 시 `editor.getHTML()` 을 contentHtml 로 전송.
- acceptance:
  1. 본문 textarea 가 사라지고 RichEditor 렌더.
  2. 빈 본문(공백·빈 단락만) 저장 시 클라이언트 검증으로 차단.
  3. 수정 모드: 기존 글의 contentHtml 을 editor 에 로드, 변경 후 PATCH.

#### T-WEB-303 — RichContent 렌더러(상세) + 마크다운 렌더러 제거 경로 정리
- priority: 64 / 의존: T-PUB-301 / status: todo
- 산출:
  - `components/RichContent.tsx`: dompurify 로 한 번 더 sanitize 후 `dangerouslySetInnerHTML`.
  - PostDetail 의 본문이 `<Markdown>` → `<RichContent>` 로 교체.
  - 색/크기 클래스가 Tailwind 안에 매핑되어 시각 적용.
- acceptance:
  1. 발행 상세에서 색/크기/링크/미디어 본문이 정확히 보임.
  2. dompurify 통과 후 raw HTML 이 직접 주입되지 않는다(잘못된 입력이 들어와도 화이트리스트 외 모두 제거).
  3. 비디오 노드는 컨트롤 + preload=metadata 로 렌더.

#### T-WEB-304 — Playwright e2e: 작성자 WYSIWYG 시연
- priority: 65 / 의존: T-WEB-302, T-WEB-303 / status: todo
- 산출:
  - `packages/web/e2e/rich-editor.spec.ts`: 작성자 가입 → 글 작성 → 일부 단어 빨강/크게 → MP4 업로드 → 발행 → 상세에서 동일 표시.
- acceptance:
  1. 도구바 상호작용으로 색·크기·이미지·비디오 모두 본문에 반영.
  2. 발행 후 상세에서 동일 시각 표시.
  3. dev DB 격리 위반 0.

## 범위 외
- 표(table)/임베드 카드, 협업 편집(yjs), 글 이력/버전.
- 임의 hex 색/px 크기 — 화이트리스트 프리셋만.
- 마크다운 toggle UI("리치/마크다운 둘 다 쓰기") — 채택 안 함.
- contentMarkdown 컬럼 drop — 별도 후속 ADR(롤백 안전망 유지).
