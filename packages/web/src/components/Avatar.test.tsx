import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('src 가 있으면 이미지로 렌더한다(alt=name)', () => {
    render(<Avatar src="/uploads/a.png" name="박기순" />);
    const img = screen.getByRole('img', { name: '박기순' });
    expect(img).toHaveAttribute('src', '/uploads/a.png');
  });

  it('src 가 없으면 이름 첫 글자 이니셜로 폴백한다', () => {
    render(<Avatar name="kim" />);
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('이름도 없으면 ? 로 폴백한다', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
