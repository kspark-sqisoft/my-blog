import { useEffect, useRef, useState } from 'react';
import type { TocItem } from '../lib/article-enhance';

// T-READ-103: 글 목차(TOC). 데스크톱은 sticky 사이드바, 모바일은 <details> 접이식(CSS).
// IntersectionObserver 로 현재 화면에 보이는 헤딩을 추적해 활성 항목을 표시한다.
// 항목이 없으면 아무것도 렌더하지 않는다(상위에서 본문 풀폭).

interface ArticleTocProps {
  items: TocItem[];
}

export function ArticleToc({ items }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string>('');
  const rootRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    let observer: IntersectionObserver | null = null;
    let rafId: number | null = null;

    const attach = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
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
        if (el) observer!.observe(el);
      });
    };

    attach();

    // 본문 DOM 이 다시 렌더되어 헤딩 노드가 교체될 수 있다(예: 목차 클릭 후
    // hash 변경으로 트리 재렌더 → dangerouslySetInnerHTML 의 콘텐츠가 재생성).
    // IO 는 stale 노드를 계속 관찰하므로, 본문에 MutationObserver 를 걸어
    // 자식 변화 시 IO 를 새 노드로 재등록한다. (rAF 로 연속 변경을 단일화)
    const body = document.querySelector('.ab-article-body');
    const mo =
      body && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            if (rafId != null) return;
            rafId = requestAnimationFrame(() => {
              rafId = null;
              attach();
            });
          })
        : null;
    if (mo && body) mo.observe(body, { childList: true, subtree: true });

    // scroll 기반 fallback: 매 스크롤마다 document.getElementById 로 최신 노드를
    // 다시 lookup 해 viewport 상단을 가장 가까이 지난 헤딩을 active 로 잡는다.
    // IO 가 stale 노드를 보거나, viewport 상단 30% 임계 밖이라 콜백이 안 발사되는
    // 경우에도 안정적으로 동기화된다. (rAF 로 throttle)
    const TOP_THRESHOLD = 96; // sticky 헤더 가림 보정
    let scrollRaf: number | null = null;
    const computeFromScroll = () => {
      let current = '';
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top - TOP_THRESHOLD <= 0) current = it.id;
        else break;
      }
      // 아무 헤딩도 통과 안 했으면 첫 항목을 활성으로(맨 위 영역).
      if (!current && items[0]) current = items[0].id;
      if (current) setActiveId(current);
    };
    const onScroll = () => {
      if (scrollRaf != null) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        computeFromScroll();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer?.disconnect();
      mo?.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      if (scrollRaf != null) cancelAnimationFrame(scrollRaf);
    };
  }, [items]);

  // active 가 바뀌면 목차 패널 안에서 해당 항목이 보이게 컨테이너 scrollTop 을 조정한다.
  // 페이지 스크롤은 절대 건드리지 않는다(부모 .ab-toc-aside 의 scrollTop 만 변경).
  useEffect(() => {
    if (!activeId) return;
    const root = rootRef.current;
    if (!root) return;
    const container = root.closest('.ab-toc-aside') as HTMLElement | null;
    if (!container) return;
    const safeId =
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(activeId) : activeId;
    const link = container.querySelector(
      `a[href="#${safeId}"]`,
    ) as HTMLElement | null;
    if (!link) return;
    const cRect = container.getBoundingClientRect();
    const lRect = link.getBoundingClientRect();
    if (lRect.top < cRect.top + 8) {
      container.scrollTop += lRect.top - cRect.top - 8;
    } else if (lRect.bottom > cRect.bottom - 8) {
      container.scrollTop += lRect.bottom - cRect.bottom + 8;
    }
  }, [activeId]);

  if (items.length === 0) return null;

  return (
    <details ref={rootRef} className="ab-toc" open>
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
