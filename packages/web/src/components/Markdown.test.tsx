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

  // T-WEB-201: .mp4 URL 의 이미지 노드는 <video> 로 자동 분기 (ADR-0020).
  it('![alt](*.mp4) 는 <video controls preload="metadata" playsInline> 로 렌더된다', () => {
    const { container } = render(
      <Markdown content={'![데모](/uploads/clip.mp4)'} />,
    );
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/uploads/clip.mp4');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
    // playsInline 은 React 에서 camelCase 가 DOM 속성 'playsinline' 으로 직렬화됨
    expect(video?.hasAttribute('playsinline')).toBe(true);
    // 이미지 노드가 비디오로 치환되었으므로 <img> 는 없어야 한다
    expect(container.querySelector('img')).toBeNull();
  });

  it('비디오에는 autoplay 가 없다 (UX/배터리 보호)', () => {
    const { container } = render(
      <Markdown content={'![데모](/uploads/clip.mp4)'} />,
    );
    const video = container.querySelector('video');
    expect(video?.hasAttribute('autoplay')).toBe(false);
  });

  it('이미지 확장자(.jpg/.png/.gif/.webp) 는 기존 <img> 로 렌더된다', () => {
    const cases = [
      '/uploads/a.jpg',
      '/uploads/a.png',
      '/uploads/a.gif',
      '/uploads/a.webp',
    ];
    for (const src of cases) {
      const { container, unmount } = render(
        <Markdown content={`![alt](${src})`} />,
      );
      expect(container.querySelector('video')).toBeNull();
      expect(container.querySelector('img')?.getAttribute('src')).toBe(src);
      unmount();
    }
  });

  it('alt 텍스트는 <video> 의 aria-label 로 매핑된다', () => {
    const { container } = render(
      <Markdown content={'![데모 클립](/uploads/clip.mp4)'} />,
    );
    const video = container.querySelector('video');
    expect(video?.getAttribute('aria-label')).toBe('데모 클립');
  });

  it('raw <video> 태그 텍스트는 렌더되지 않는다 (sanitize 차단)', () => {
    const { container } = render(
      <Markdown
        content={'<video src="https://evil.example.com/x.mp4" autoplay></video>'}
      />,
    );
    expect(container.querySelector('video')).toBeNull();
  });
});
