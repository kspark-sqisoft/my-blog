import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { richHtmlSchema } from '@blog/shared';

// T-WEB-303: 본문 HTML(ADR-0021) 렌더러. 서버 sanitize 가 마지막 게이트지만, 클라이언트에서도
// dompurify 로 한 번 더 통과시켜 이중 방어 — 어떤 경로로든 잘못된 입력이 들어와도 화이트리스트 외
// 모두 제거된다. 색/크기는 span class(Tailwind) 로 시각 적용.

// http/https/mailto/tel + 상대경로(/uploads/...) 허용. javascript:/data:/vbscript: 등 차단.
const ALLOWED_URI = /^(?:(?:https?|mailto|tel):|\/|#)/i;

// dompurify 가 element-specific 화이트리스트로 video 의 controls/preload/playsinline/muted 를
// 임의 차단하는 경우가 있어, 모듈 로드 시 글로벌 hook 으로 강제 보존(ADR-0020).
// 다른 위험 속성(onerror 등)은 hook 이후의 dompurify 본 검사가 제거한다.
const VIDEO_KEEP_ATTRS = new Set([
  'controls',
  'preload',
  'playsinline',
  'muted',
  'loading',
]);
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (VIDEO_KEEP_ATTRS.has(data.attrName.toLowerCase())) {
    data.forceKeepAttr = true;
  }
});

// 클라이언트 dompurify 는 **태그 화이트리스트** 만 적용한다. 속성별 화이트리스트는 dompurify 의
// element-specific 처리와 충돌하기 쉬워 (예: video 의 preload/playsinline 이 임의 차단),
// 정밀 화이트리스트는 서버 sanitize-html(`richHtmlSchema`) 이 최종 게이트로 보장한다.
// 클라이언트는 이중 방어로서 위험 태그(<script>/<iframe> 등) 차단 + 위험 URI 스킴 차단을 담당.
interface RichContentProps {
  html: string;
  className?: string;
}

export function RichContent({ html, className }: RichContentProps) {
  const safe = useMemo(() => {
    const result = DOMPurify.sanitize(html ?? '', {
      ALLOWED_TAGS: [...richHtmlSchema.allowedTags],
      ALLOWED_URI_REGEXP: ALLOWED_URI,
    });
    return typeof result === 'string' ? result : String(result);
  }, [html]);
  return (
    <div
      className={`ab-rich-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
