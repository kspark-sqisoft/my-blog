import { useEffect, useState } from 'react';
import type { TocItem } from '../lib/article-enhance';

// T-READ-103: 글 목차(TOC). 데스크톱은 sticky 사이드바, 모바일은 <details> 접이식(CSS).
// IntersectionObserver 로 현재 화면에 보이는 헤딩을 추적해 활성 항목을 표시한다.
// 항목이 없으면 아무것도 렌더하지 않는다(상위에서 본문 풀폭).

interface ArticleTocProps {
  items: TocItem[];
}

export function ArticleToc({ items }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIds = entries
          .filter((e) => e.isIntersecting)
          .map((e) => (e.target as HTMLElement).id);
        if (visibleIds.length === 0) return;
        // 문서 순서상 가장 위(목차 순서 기준 먼저)인 가시 헤딩을 활성으로.
        const first = items.find((it) => visibleIds.includes(it.id));
        if (first) setActiveId(first.id);
      },
      // 헤딩이 뷰포트 상단 근처에 올 때 활성으로 잡는다.
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <details className="ab-toc" open>
      <summary className="ab-toc-title">목차</summary>
      <nav aria-label="목차">
        <ol className="ab-toc-list">
          {items.map((it) => (
            <li key={it.id} className={`ab-toc-item lv${it.level}`}>
              <a
                href={`#${it.id}`}
                aria-current={activeId === it.id ? 'location' : undefined}
                className={activeId === it.id ? 'active' : undefined}
                onClick={() => setActiveId(it.id)}
              >
                {it.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
