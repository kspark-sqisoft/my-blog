import type { PostSummaryDto } from '@blog/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PostListView } from './PostListView';

// 카드 목록 뷰 — 시리즈 배지 회귀(H1). 시리즈 소속 글은 카드 상단에
// "{시리즈명} · X편째" 배지(시리즈 상세로 이동) 가 보여야 한다.
const baseItem = (over: Partial<PostSummaryDto> = {}): PostSummaryDto => ({
  id: 'p1',
  slug: 'p1',
  title: '글 1',
  summary: '요약',
  tags: [],
  authorId: 'u1',
  authorName: '작성자',
  authorAvatarUrl: null,
  publishedAt: '2026-06-01T00:00:00Z',
  coverImageUrl: null,
  viewCount: 0,
  likeCount: 0,
  series: null,
  ...over,
});

function renderList(items: PostSummaryDto[]) {
  return render(
    <MemoryRouter>
      <PostListView items={items} />
    </MemoryRouter>,
  );
}

describe('PostListView 시리즈 배지', () => {
  it('시리즈 소속 글은 시리즈 배지(이름·순서)가 보이고 시리즈 상세로 링크된다', () => {
    renderList([
      baseItem({
        id: 'p1',
        title: 'TypeScript 깊이 1',
        series: {
          slug: 'typescript-깊이',
          title: 'TypeScript 깊이',
          order: 1,
        },
      }),
    ]);
    const badge = screen.getByRole('link', {
      name: /시리즈 TypeScript 깊이, 1편째/,
    });
    // jsdom 은 href 를 raw unicode 로 보존(브라우저는 자동 percent-encoding).
    expect(badge).toHaveAttribute('href', '/series/typescript-깊이');
    expect(badge).toHaveTextContent('TypeScript 깊이');
    expect(badge).toHaveTextContent('1편째');
  });

  it('시리즈 미소속 글은 배지가 없다', () => {
    renderList([baseItem({ series: null })]);
    expect(
      screen.queryByRole('link', { name: /편째/ }),
    ).toBeNull();
  });

  it('혼합 목록에서 소속 글에만 배지가 보인다', () => {
    renderList([
      baseItem({
        id: 'p1',
        title: '시리즈 글',
        series: { slug: 's', title: '시리즈 A', order: 2 },
      }),
      baseItem({ id: 'p2', title: '일반 글', series: null }),
    ]);
    const badges = screen.getAllByRole('link', { name: /편째/ });
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('시리즈 A');
    expect(badges[0]).toHaveTextContent('2편째');
  });
});
