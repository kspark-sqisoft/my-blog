import { render, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReadingArticle } from './ReadingArticle';
import type { TocItem } from '../lib/article-enhance';

describe('ReadingArticle', () => {
  it('본문을 렌더하고, 보강 후 코드 하이라이트와 헤딩 id 를 적용한다', async () => {
    const html =
      '<h2>설치</h2><p>본문</p><pre><code>function add(a, b) { return a + b; }</code></pre>';
    const { container } = render(<ReadingArticle html={html} />);

    // 첫 페인트(보강 전)에도 본문 텍스트는 보인다.
    expect(container.textContent).toContain('본문');

    // 보강 완료 후 코드블록에 hljs 클래스, 헤딩에 id 가 박힌다.
    await waitFor(() => {
      expect(container.querySelector('pre code.hljs')).not.toBeNull();
      expect(container.querySelector('h2#설치')).not.toBeNull();
    });
  });

  // 회귀(scroll 버그): PostDetail 은 목차 등장 시 <aside> 를 본문 컬럼 "앞"에 삽입한다.
  // 그러면 본문 컬럼이 리마운트되는데, 명령형 ref.innerHTML 방식은 보강 결과가 sanitized 로 되돌아가
  // 헤딩 id 가 사라졌다(앵커 스크롤 불능). 보강 결과는 리마운트 후에도 유지돼야 한다.
  it('목차 등장으로 본문 컬럼이 리마운트돼도 헤딩 id·하이라이트가 유지된다', async () => {
    function Host() {
      // onToc → setToc(비어있지 않음) → aside 가 컬럼 앞에 삽입 → 컬럼 리마운트 (PostDetail 모사)
      const [toc, setToc] = useState<TocItem[]>([]);
      return (
        <div>
          {toc.length > 0 && <aside data-testid="toc-aside" />}
          <div>
            <ReadingArticle
              html="<h2>설치</h2><pre><code>const x = 1;</code></pre>"
              onToc={setToc}
            />
          </div>
        </div>
      );
    }
    const { container } = render(
      <StrictMode>
        <Host />
      </StrictMode>,
    );

    // 목차가 추출되어 aside 가 삽입(리마운트 발생)될 때까지 기다린다.
    await waitFor(() =>
      expect(container.querySelector('[data-testid="toc-aside"]')).not.toBeNull(),
    );
    // 리마운트 이후에도 헤딩 id·하이라이트가 살아있어야 한다.
    await waitFor(() => {
      expect(container.querySelector('h2#설치')).not.toBeNull();
      expect(container.querySelector('pre code.hljs')).not.toBeNull();
    });
  });

  it('추출한 목차를 onToc 로 상위에 전달한다', async () => {
    const onToc = vi.fn<(toc: TocItem[]) => void>();
    render(
      <ReadingArticle html="<h1>가이드</h1><h2>준비</h2>" onToc={onToc} />,
    );

    await waitFor(() => expect(onToc).toHaveBeenCalled());
    const toc = onToc.mock.calls.at(-1)?.[0];
    expect(toc).toEqual([
      { id: '가이드', text: '가이드', level: 1 },
      { id: '준비', text: '준비', level: 2 },
    ]);
  });
});
