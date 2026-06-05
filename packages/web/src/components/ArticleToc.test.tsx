import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleToc } from './ArticleToc';
import type { TocItem } from '../lib/article-enhance';

// 제어 가능한 IntersectionObserver 목 — 콜백을 캡처해 테스트에서 직접 교차를 흉내낸다.
let ioCallback: IntersectionObserverCallback | null = null;
const observe = vi.fn();
const disconnect = vi.fn();

class MockIO {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
}

function fireIntersect(el: Element, isIntersecting: boolean) {
  ioCallback?.(
    [{ target: el, isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

const TOC: TocItem[] = [
  { id: 'intro', text: '소개', level: 1 },
  { id: 'install', text: '설치', level: 2 },
  { id: 'usage', text: '사용법', level: 2 },
];

describe('ArticleToc', () => {
  beforeEach(() => {
    ioCallback = null;
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIO);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('목차 항목을 #id 링크와 레벨 클래스로 렌더한다', () => {
    const { container, getByRole } = render(<ArticleToc items={TOC} />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('href')).toBe('#intro');
    expect(links[1].textContent).toBe('설치');
    // 레벨별 들여쓰기 클래스
    expect(container.querySelector('.ab-toc-item.lv2')).not.toBeNull();
    expect(getByRole('navigation')).toBeInTheDocument();
  });

  it('항목이 없으면 아무것도 렌더하지 않는다(목차 숨김)', () => {
    const { container } = render(<ArticleToc items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('스크롤스파이: 가시 헤딩에 해당하는 항목을 활성(aria-current) 표시한다', () => {
    // 관찰 대상 헤딩들을 문서에 둔다.
    document.body.insertAdjacentHTML(
      'beforeend',
      '<h2 id="intro">소개</h2><h2 id="install">설치</h2><h2 id="usage">사용법</h2>',
    );
    const { container } = render(<ArticleToc items={TOC} />);
    expect(observe).toHaveBeenCalledTimes(3);

    // install 헤딩이 화면에 들어옴 → 해당 링크가 active
    act(() => fireIntersect(document.getElementById('install')!, true));

    const active = container.querySelector('a[aria-current="location"]');
    expect(active?.getAttribute('href')).toBe('#install');
  });

  it('언마운트 시 옵저버를 정리한다', () => {
    document.body.insertAdjacentHTML('beforeend', '<h2 id="intro">소개</h2>');
    const { unmount } = render(<ArticleToc items={TOC} />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
