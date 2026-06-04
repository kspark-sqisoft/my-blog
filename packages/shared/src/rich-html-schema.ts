// 본문 HTML 화이트리스트 (ADR-0021). 서버(sanitize-html) 와 클라(dompurify) 양쪽이
// 같은 정의를 import 해 단일 정의를 유지한다. 시각 서식은 Tailwind 클래스 화이트리스트로만 표현해
// 인라인 style 우회를 차단한다.

const SPAN_SIZE_CLASSES = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;

const SPAN_COLOR_CLASSES = [
  'text-slate-900',
  'text-slate-500',
  'text-rose-500',
  'text-orange-500',
  'text-amber-500',
  'text-emerald-500',
  'text-sky-500',
  'text-violet-500',
] as const;

export const RICH_HTML_SPAN_CLASSES = [
  ...SPAN_SIZE_CLASSES,
  ...SPAN_COLOR_CLASSES,
] as const;

export type RichHtmlSpanClass = (typeof RICH_HTML_SPAN_CLASSES)[number];

// sanitize-html 의 IOptions 모양에 호환되도록 설계. (런타임 의존은 각 패키지에서 import)
export interface RichHtmlSchema {
  readonly allowedTags: readonly string[];
  readonly allowedAttributes: Readonly<Record<string, readonly string[]>>;
  readonly allowedClasses: Readonly<Record<string, readonly string[]>>;
  readonly allowedSchemes: readonly string[];
  readonly allowedSchemesByTag: Readonly<Record<string, readonly string[]>>;
  // sanitize-html transformTags 호환: 외부 링크에 rel/target 자동 부착 등 후속 처리.
  readonly transformTagNames: readonly string[];
}

export const richHtmlSchema: RichHtmlSchema = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'strong',
    'em',
    'u',
    's',
    'code',
    'span',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'a',
    'img',
    'video',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'loading'],
    video: ['src', 'controls', 'preload', 'playsinline', 'muted'],
    span: ['class'],
    code: ['class'],
    pre: ['class'],
    p: ['class'],
  },
  allowedClasses: {
    // 시각 서식은 Tailwind 클래스로만 — 인라인 style 우회 차단(ADR-0021).
    span: RICH_HTML_SPAN_CLASSES as unknown as readonly string[],
    // 코드 블록 언어 표시 등은 후속에 추가.
    code: [],
    pre: [],
    p: [],
  },
  // javascript:/data:/vbscript:/file: 등은 누락 → sanitize-html 이 url 자체를 제거.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
    video: ['http', 'https'],
  },
  transformTagNames: ['a'],
};
