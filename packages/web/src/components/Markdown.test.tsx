import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown 렌더', () => {
  it('마크다운 헤딩과 안전한 이미지를 렌더한다', () => {
    const { container } = render(
      <Markdown content={'# 제목\n\n![고양이](https://example.com/cat.png)'} />,
    );
    expect(
      screen.getByRole('heading', { name: '제목' }),
    ).toBeInTheDocument();
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.com/cat.png');
  });

  it('script 태그는 무력화된다(실행 요소로 렌더되지 않음)', () => {
    const { container } = render(
      <Markdown content={"<script>alert('xss')</script>"} />,
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('이미지의 onerror 등 위험 속성은 제거된다', () => {
    const { container } = render(
      <Markdown
        content={'<img src="x" onerror="alert(1)" />'}
      />,
    );
    const img = container.querySelector('img');
    // raw HTML 미파싱 또는 sanitize로 onerror 핸들러가 남지 않아야 함
    expect(img?.getAttribute('onerror') ?? null).toBeNull();
  });
});
