import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichContent } from './RichContent';

// T-WEB-303: 클라이언트 단계의 sanitize 회귀 가드. 서버가 마지막 게이트지만 잘못된 입력이
// 어떤 경로로든 흘러 들어와도 dompurify 가 화이트리스트 외를 제거한다.
describe('RichContent (T-WEB-303)', () => {
  it('정상 HTML(헤딩/단락) 을 렌더한다', () => {
    const { container } = render(
      <RichContent html="<h2>제목</h2><p>본문</p>" />,
    );
    expect(container.querySelector('h2')?.textContent).toBe('제목');
    expect(container.querySelector('p')?.textContent).toBe('본문');
  });

  it('span class 화이트리스트(text-rose-500/text-lg) 를 보존한다', () => {
    const { container } = render(
      <RichContent html='<p><span class="text-rose-500 text-lg">강조</span></p>' />,
    );
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-rose-500');
    expect(span?.className).toContain('text-lg');
  });

  it('<script> 는 제거된다', () => {
    const { container } = render(
      <RichContent html="<p>안녕</p><script>alert(1)</script>" />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('안녕');
  });

  it('이미지 onerror 같은 위험 속성은 제거된다', () => {
    const { container } = render(
      <RichContent html='<img src="/uploads/a.jpg" onerror="alert(1)">' />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
    expect(img?.getAttribute('src')).toBe('/uploads/a.jpg');
  });

  it('javascript: 스킴 링크의 href 는 제거된다', () => {
    const { container } = render(
      <RichContent html='<a href="javascript:alert(1)">클릭</a>' />,
    );
    const a = container.querySelector('a');
    const href = a?.getAttribute('href') ?? '';
    expect(href).not.toMatch(/^javascript:/i);
  });

  it('<video src controls preload="metadata" playsinline> 노드를 렌더한다', () => {
    const { container } = render(
      <RichContent html='<video src="/uploads/clip.mp4" controls preload="metadata" playsinline></video>' />,
    );
    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/uploads/clip.mp4');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });

  it('빈 입력은 빈 컨테이너', () => {
    const { container } = render(<RichContent html="" />);
    const wrap = container.querySelector('.ab-rich-content');
    expect(wrap).not.toBeNull();
    expect(wrap?.innerHTML).toBe('');
  });
});
