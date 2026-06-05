import { useEffect, useMemo, useRef, useState } from 'react';
import { enhanceArticleHtml, type TocItem } from '../lib/article-enhance';
import { sanitizeRichHtml } from '../lib/sanitize-rich-html';

// T-READ-102/103: 글 상세 본문 렌더러. 클라이언트 sanitize(이중 방어) → enhance(헤딩 id·목차·코드
// 하이라이트) 순서로 처리한다(ADR-0023). enhance 는 비동기(highlight.js 동적 import)다.
// 보강 결과는 **React 상태**로 보관해 dangerouslySetInnerHTML 의 단일 소스로 삼는다. (명령형
// ref.innerHTML 로 덮어쓰면 React 재조정/StrictMode/리마운트가 sanitized 로 되돌려 헤딩 id·하이라이트가
// 사라진다 — 앵커 스크롤 불능. 보강된 마크업이 React 가 관리하는 콘텐츠여야 안전하게 보존된다.)

interface ReadingArticleProps {
  html: string;
  onToc?: (toc: TocItem[]) => void;
  className?: string;
}

export function ReadingArticle({ html, onToc, className }: ReadingArticleProps) {
  const sanitized = useMemo(() => sanitizeRichHtml(html), [html]);
  // 현재 입력(src)에 대한 보강 결과. src 가 다르면(입력 변경/보강 전) sanitized 를 렌더한다.
  const [enhanced, setEnhanced] = useState<{ src: string; html: string } | null>(
    null,
  );

  // onToc 참조가 매 렌더 바뀌어도 enhance 가 재실행되지 않도록 ref 로 고정한다.
  const onTocRef = useRef(onToc);
  useEffect(() => {
    onTocRef.current = onToc;
  }, [onToc]);

  useEffect(() => {
    let alive = true;
    enhanceArticleHtml(sanitized).then(({ html: out, toc }) => {
      if (!alive) return;
      // 비동기 보강 결과로 파생 상태를 갱신(데이터 패칭과 동일한 비동기 setState 패턴).
       
      setEnhanced({ src: sanitized, html: out });
      onTocRef.current?.(toc);
    });
    return () => {
      alive = false;
    };
  }, [sanitized]);

  // 보강 결과가 현재 입력에 대한 것이면 그것을, 아니면 보강 전 sanitized 를 렌더.
  const display =
    enhanced && enhanced.src === sanitized ? enhanced.html : sanitized;

  return (
    <div
      className={`ab-rich-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: display }}
    />
  );
}
