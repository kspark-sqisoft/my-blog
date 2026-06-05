import { render, waitFor } from '@testing-library/react';
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
