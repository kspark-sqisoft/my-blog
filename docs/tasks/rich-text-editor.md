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
- priority: 58 / 의존: T-INFRA-301 / status: todo
- 산출:
  - schema.prisma: `contentHtml String @default("")` 추가. contentMarkdown 은 과도기 보존.
  - prisma migrate dev 로 마이그레이션 생성. dev/test DB 모두 적용.
- acceptance:
  1. `posts.content_html` 컬럼 생성, default ''.
  2. 기존 row 의 contentHtml 은 일단 빈 문자열(T-INFRA-303 이 채움).
  3. blog_test DB 도 마이그레이션 통과(통합 spec 깨지지 않음).

#### T-INFRA-303 — 일회성 마이그레이션 스크립트 (markdown → html)
- priority: 59 / 의존: T-INFRA-302 / status: todo
- 산출:
  - `scripts/migrate-md-to-html.ts`: `markdown-it` 으로 contentMarkdown → HTML, `.mp4` 확장자 `<img>` 를 `<video controls preload="metadata" playsInline>` 로 후처리, `sanitize-html(richHtmlSchema)` 통과 후 contentHtml 채움.
  - pnpm 스크립트 등록(`pnpm migrate:md-to-html`).
- acceptance:
  1. 스크립트 실행 후 모든 Post 의 contentHtml 이 비지 않는다(빈 본문 제외).
  2. `.mp4` 이미지 임베드가 `<video>` 노드로 보존.
  3. `<script>`/`onerror`/`javascript:` 등 위험 입력이 있더라도 모두 제거.
  4. 두 번 실행해도 멱등(이미 채워진 contentHtml 은 그대로 두거나 같은 결과 산출).

#### T-PUB-301 — api PostService: contentHtml 입력 + sanitize + 응답 형식
- priority: 60 / 의존: T-INFRA-302 / status: todo
- 산출:
  - `post.service.ts`: create/update 가 `contentHtml` 을 받아 서버 sanitize 통과 후 저장.
  - 응답 DTO 매핑(`toDetail`/`toSummary`) 가 contentHtml 노출.
  - 파생값 계산은 후속 T-PUB-302 가 담당(이 태스크는 입력/저장만).
- acceptance:
  1. `POST /api/posts { contentHtml }` → DB 의 contentHtml 가 sanitize 결과로 저장.
  2. `<script>` 같은 위험 태그는 응답·DB 모두에서 제거.
  3. `GET /api/posts/:id` 응답에 contentHtml 포함, contentMarkdown 키 없음.

#### T-PUB-302 — 파생값(summary/coverImageUrl) HTML 입력 대응
- priority: 61 / 의존: T-PUB-301 / status: todo
- 산출:
  - `cover-image.ts` / `markdown-summary.ts` 가 HTML 입력에서 동작하도록 교체.
    `extractFirstMediaUrl(html)` (cheerio 사용) — 첫 `<img src>` 또는 `<video src>` URL.
    `toSummaryText(html, max)` — 평문 200자.
- acceptance:
  1. HTML 본문에서 첫 미디어 URL 정확히 추출(.mp4 첫 노드면 그 URL).
  2. 평문 요약이 헤딩/마크업 없이 200자 trim.
  3. 기존 e2e 회귀 0건.

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
