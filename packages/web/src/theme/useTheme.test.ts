import { beforeEach, describe, expect, it } from 'vitest';
import { useTheme } from './useTheme';

describe('useTheme 테마 스토어', () => {
  beforeEach(() => {
    localStorage.clear();
    useTheme.setState({ theme: 'light' });
    document.documentElement.removeAttribute('data-theme');
  });

  it('toggle 하면 light ↔ dark 가 전환되고 문서 속성/스토리지에 반영된다', () => {
    useTheme.getState().toggle();
    expect(useTheme.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('blog-theme')).toBe('dark');

    useTheme.getState().toggle();
    expect(useTheme.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('blog-theme')).toBe('light');
  });

  it('setTheme 으로 직접 지정하면 문서와 스토리지에 반영된다', () => {
    useTheme.getState().setTheme('dark');
    expect(useTheme.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('blog-theme')).toBe('dark');
  });
});
