# TRD - 리치 텍스트 본문 에디터 (마크다운 → WYSIWYG)

> 입력: `docs/prd/rich-text-editor.md`, ADR-0021. ADR-0003(본문 마크다운) supersede.

## 핵심 기술 결정

| # | 결정 | 선택 |
|---|---|---|
| ① | 에디터 라이브러리 | **TipTap**(`@tiptap/react` + StarterKit + Image + 커스텀 Video + TextStyle/Color/FontSize/Link/Underline) |
| ② | 저장 형식 | **sanitize 된 HTML** — Post 에 `contentHtml: String` 컬럼 추가, `contentMarkdown` 은 후속 제거 마이그레이션까지 보존(rollback safety) |
| ③ | sanitize 라이브러리 | **`sanitize-html`**(서버) + **`dompurify`/`isomorphic-dompurify`**(클라). 동일 화이트리스트를 `packages/shared` 의 `richHtmlSchema` 한 곳에서 정의 |
| ④ | 마이그레이션 | 새 Prisma migration + 일회성 스크립트(`scripts/migrate-md-to-html.ts`): `markdown-it` 로 contentMarkdown → contentHtml, `.mp4` 확장자 img 를 video 노드로 후처리, 서버 sanitize 통과 |
| ⑤ | 본문 파생값(요약/커버) | `cheerio` 로 HTML 파싱. `extractFirstMediaUrl(html)`, `toSummaryText(html, 200)` 로 통일 |
| ⑥ | 응답 모양 | `PostDetailDto.contentHtml: string` 신규, `contentMarkdown` 은 deprecated(과도기 응답에 포함하지 않음). `CreatePostDto.contentHtml` 로 입력 |
| ⑦ | 색/크기 | TipTap `TextStyle` + `Color`(팔레트 9: 기본 해제 + 8색) + `FontSize` 커스텀 익스텐션(class 기반: `text-sm/text-base/text-lg/text-xl` Tailwind 사용 — style 미사용으로 정규화 단순) |

## DB 스키마 변경 (Prisma)

```prisma
model Post {
  // ...기존 필드...
  contentMarkdown String   // 과도기 보존, 후속에 제거
  contentHtml     String   // 신규 (sanitize 후 결과)
}
```

마이그레이션 `add_post_content_html`:
1. `contentHtml TEXT NOT NULL DEFAULT ''` 컬럼 추가
2. 일회성 데이터 마이그레이션 스크립트 실행 → 기존 모든 Post 의 `contentMarkdown` → `contentHtml` 채움
3. (별도 후속 ADR) `contentMarkdown` drop

## sanitize 화이트리스트 (`packages/shared/rich-html-schema.ts`)

```ts
export const richHtmlSchema = {
  allowedTags: [
    'p','br','hr',
    'h1','h2','h3',
    'strong','em','u','s','code','span',
    'ul','ol','li',
    'blockquote','pre',
    'a','img','video',
  ],
  allowedAttributes: {
    a:     ['href','target','rel'],
    img:   ['src','alt','loading'],
    video: ['src','controls','preload','playsinline','muted'],
    span:  ['class'],   // FontSize/Color 모두 class 기반 (text-red-500, text-lg 등 Tailwind)
    code:  ['class'],
    pre:   ['class'],
    p:     ['class'],
  },
  allowedClasses: {
    span: [
      'text-sm','text-base','text-lg','text-xl',
      'text-slate-900','text-slate-500','text-rose-500','text-orange-500',
      'text-amber-500','text-emerald-500','text-sky-500','text-violet-500',
    ],
  },
  allowedSchemes: ['http','https','mailto','tel'],
  allowedSchemesByTag: { img: ['http','https'], video: ['http','https'] },
  transformTags: {
    a: (tag, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' },
    }),
  },
};
```

- 인라인 `style` 미허용 — 색/크기는 `<span class="text-red-500 text-lg">` 같은 Tailwind 클래스로 표현 (정규화 단순, sanitize 우회 여지 작음).
- 외부 host img/video 도 허용(기존 ADR-0012 입장 유지). 우리 업로드 url 은 상대 경로(`/uploads/...`).
- script/iframe/object/embed/style/link/meta 등은 화이트리스트 외라 자동 제거.

## 모듈 구조

| 모듈 | 추가/변경 |
|---|---|
| `packages/shared` | `richHtmlSchema`(escape 정책 단일 소스), `PostDetailDto.contentHtml`, `CreatePostDto.contentHtml`, `UpdatePostDto.contentHtml` |
| `packages/api` PublishingModule | `PostService.create/update` 가 `contentHtml` 을 받아 `sanitize-html` 통과 후 저장. `toSummary`/`extractFirstMediaUrl` 가 `cheerio` 로 HTML 파싱 |
| `packages/web` | `components/editor/RichEditor.tsx` (TipTap), `PostEditor.tsx` 가 textarea → RichEditor. `components/Markdown.tsx` → `components/RichContent.tsx` 로 대체(클라 sanitize + dangerouslySetInnerHTML) |
| `scripts/migrate-md-to-html.ts` | 일회성: 모든 Post 의 contentMarkdown → contentHtml 변환, `.mp4` img → video 노드 후처리, sanitize 통과 |

## API 변경

### `POST /api/posts`, `PATCH /api/posts/:id`
- 요청: `{ title, contentHtml, tags? }` (contentMarkdown 은 받지 않음)
- 서버: `contentHtml` 을 `sanitize-html(richHtmlSchema)` 통과 → 저장
- 응답: `PostDetailDto { ..., contentHtml }`

### `GET /api/posts`, `/posts/:id`, `/admin/posts`, `/admin/posts/:id`
- `PostSummaryDto`/`PostDetailDto` 에 `contentHtml` 노출, `contentMarkdown` 미노출
- summary/coverImageUrl 은 cheerio 파싱 결과로 동일 모양

## 웹 변경 핵심

- `RichEditor`: useEditor + StarterKit + Image + Video(커스텀 노드) + Link + Underline + TextStyle + Color + FontSize. 도구바는 `Toolbar.tsx` 분리. 미디어 업로드는 기존 useUploadImage 훅 재사용 → 성공 시 `editor.chain().focus().setImage()` 또는 setVideo.
- `RichContent`: `<div dangerouslySetInnerHTML={{ __html: sanitized }} />`. sanitize 는 `dompurify` 또는 동형 wrapper 한 번 더.
- `PostListView.coverImageUrl` 분기는 그대로(URL 확장자 기준).

## 테스트 전략

- shared: `richHtmlSchema` snapshot.
- api unit: `PostService` create/update 의 sanitize 통과 후 저장 모양, `extractFirstMediaUrl`/`toSummaryText` HTML 입력 케이스.
- api e2e: 발행 흐름(create → publish → detail), 위험 입력(script/onerror/style) → 제거 확인.
- web unit: `RichEditor` 도구바 상태/명령(B/I/U/Heading/List/Color/FontSize/Link/Image/Video), `RichContent` sanitize.
- Playwright e2e: 작성자 시연(빈 글 작성 → 일부 단어 빨강+크게 → 비디오 업로드 → 발행 → 상세에서 동일하게 보임).

## 보안 처리

- 서버 sanitize 는 마지막 게이트 — 클라이언트 호환성과 무관하게 항상 통과.
- 클라이언트 dompurify 는 서버 통과 결과를 그대로 렌더해도 안전한지 한 번 더 점검(이중 방어).
- 색/크기는 Tailwind 클래스 화이트리스트로만 — 인라인 style 허용 안 함 → CSS injection 표면 최소화.
- 외부 링크는 자동 `rel="noopener noreferrer" target="_blank"` 부착.

## 마이그레이션 절차

1. PR 1: 스키마(`contentHtml` 추가, default '') + 마이그레이션 스크립트 + 새 코드 경로(읽기/쓰기 contentHtml). 응답에 `contentHtml` 추가, 입력도 `contentHtml` 만 받음. 마이그레이션 스크립트는 `pnpm` 명령으로 호출. dev/test/prod 순서 단계.
2. PR 2 (후속 ADR): `contentMarkdown` 컬럼 제거 + `Markdown.tsx`/markdown-it 의존성 정리.
