import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { SeriesNavDto } from '@blog/shared';
import { SeriesNav } from './SeriesNav';

const nav = (over: Partial<SeriesNavDto> = {}): SeriesNavDto => ({
  id: 's1',
  slug: 'react-입문',
  title: 'React 입문',
  position: 2,
  total: 3,
  prev: { slug: 'p1', title: '1편' },
  next: { slug: 'p3', title: '3편' },
  ...over,
});

function renderNav(series: SeriesNavDto) {
  return render(
    <MemoryRouter>
      <SeriesNav series={series} />
    </MemoryRouter>,
  );
}

describe('SeriesNav (T-WEB-502)', () => {
  it('시리즈 제목 링크(/series/:slug) + N/M편을 표시한다', () => {
    renderNav(nav());
    const link = screen.getByRole('link', { name: /React 입문/ });
    expect(link).toHaveAttribute('href', '/series/react-입문');
    expect(screen.getByText(/2\s*\/\s*3편/)).toBeInTheDocument();
  });

  it('이전/다음 글 링크(/posts/:slug, 접근가능 이름)를 표시한다', () => {
    renderNav(nav());
    const prev = screen.getByRole('link', { name: /1편/ });
    expect(prev).toHaveAttribute('href', '/posts/p1');
    const next = screen.getByRole('link', { name: /3편/ });
    expect(next).toHaveAttribute('href', '/posts/p3');
  });

  it('첫 글(prev=null)은 이전 링크를 숨긴다', () => {
    renderNav(nav({ position: 1, prev: null }));
    expect(screen.queryByText(/이전/)).not.toBeInTheDocument();
    // 다음은 여전히 있음
    expect(screen.getByRole('link', { name: /3편/ })).toBeInTheDocument();
  });

  it('끝 글(next=null)은 다음 링크를 숨긴다', () => {
    renderNav(nav({ position: 3, next: null }));
    expect(screen.queryByText(/다음/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /1편/ })).toBeInTheDocument();
  });
});
