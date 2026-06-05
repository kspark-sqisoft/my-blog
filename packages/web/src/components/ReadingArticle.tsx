import { useEffect, useMemo, useRef } from 'react';
import { enhanceArticleHtml, type TocItem } from '../lib/article-enhance';
import { sanitizeRichHtml } from '../lib/sanitize-rich-html';

// T-READ-102: 글 상세 본문 렌더러. 클라이언트 sanitize(이중 방어) → enhance(헤딩 id·목차·코드
// 하이라이트) 순서로 처리한다(ADR-0023). enhance 는 비동기(highlight.js 동적 import)라, 첫 페인트는
// 보강 전 평문 본문을 dangerouslySetInnerHTML 로 보여주고, 보강이 끝나면 동일 노드의 innerHTML 을
// 보강 결과로 교체한다(추가 리렌더/effect-내 setState 없이). 추출한 목차는 onToc 로 상위에 전달(T-READ-103).

interface ReadingArticleProps {
  html: string;
  onToc?: (toc: TocItem[]) => void;
  className?: string;
}

export function ReadingArticle({ html, onToc, className }: ReadingArticleProps) {
  const sanitized = useMemo(() => sanitizeRichHtml(html), [html]);
  const ref = useRef<HTMLDivElement>(null);

  // onToc 참조가 매 렌더 바뀌어도 enhance 가 재실행되지 않도록 ref 로 고정한다.
  const onTocRef = useRef(onToc);
  useEffect(() => {
    onTocRef.current = onToc;
  }, [onToc]);

  useEffect(() => {
    let alive = true;
    enhanceArticleHtml(sanitized).then(({ html: out, toc }) => {
      if (!alive) return;
      if (ref.current) ref.current.innerHTML = out; // 보강 결과를 DOM 에 직접 반영
      onTocRef.current?.(toc);
    });
    return () => {
      alive = false;
    };
  }, [sanitized]);

  return (
    <div
      ref={ref}
      className={`ab-rich-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
