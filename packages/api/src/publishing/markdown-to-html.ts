import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { richHtmlSchema } from '@blog/shared';

// markdown-it 인스턴스 — 안전 모드 + 자동 링크 인식.
// markdown-it 은 기본적으로 raw HTML 을 보존(html: true)하지만, 우리는 sanitize-html 게이트가
// 마지막 진입점이므로 1차 변환에서는 html: true 로 둬 raw HTML 도 받은 뒤 일관되게 sanitize.
const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

// markdown-it 의 img 출력을 <video> 로 후처리한다.
// markdown-it 은 ![alt](url) 를 그대로 <img> 로 직렬화 — url 확장자가 .mp4(쿼리/해시 포함)면
// video 노드로 교체한다 (ADR-0020 호환, Markdown.tsx 의 VIDEO_EXTENSIONS 와 한 쌍).
function rewriteMp4ImagesToVideo(html: string): string {
  return html.replace(
    /<img\b([^>]*?)src="([^"]+\.mp4(?:\?[^"]*)?(?:#[^"]*)?)"([^>]*?)\/?>/gi,
    (_match, _pre, src) =>
      `<video src="${src}" controls preload="metadata" playsinline></video>`,
  );
}

// sanitize-html 의 옵션은 shared 의 richHtmlSchema 정책에서 파생한다.
// 외부 링크는 항상 target=_blank + rel=noopener noreferrer 부착(보안).
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [...richHtmlSchema.allowedTags],
  allowedAttributes: Object.fromEntries(
    Object.entries(richHtmlSchema.allowedAttributes).map(([tag, attrs]) => [
      tag,
      [...attrs],
    ]),
  ),
  allowedClasses: Object.fromEntries(
    Object.entries(richHtmlSchema.allowedClasses).map(([tag, classes]) => [
      tag,
      [...classes],
    ]),
  ),
  allowedSchemes: [...richHtmlSchema.allowedSchemes],
  allowedSchemesByTag: Object.fromEntries(
    Object.entries(richHtmlSchema.allowedSchemesByTag).map(([tag, schemes]) => [
      tag,
      [...schemes],
    ]),
  ),
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
  },
};

// 본 변환: 마크다운 → HTML → .mp4 후처리 → sanitize.
// 멱등성 보장: sanitize-html 통과 후의 결과를 같은 함수로 다시 통과시켜도 같은 결과가 나와야 한다.
export function convertMarkdownToHtml(markdownInput: string): string {
  if (!markdownInput) return '';
  const raw = md.render(markdownInput);
  const withVideo = rewriteMp4ImagesToVideo(raw);
  return sanitizeHtml(withVideo, sanitizeOptions);
}

// 외부에서 sanitize 만 적용해야 할 때(예: PostService 가 이미 HTML 입력을 받을 때).
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, sanitizeOptions);
}
