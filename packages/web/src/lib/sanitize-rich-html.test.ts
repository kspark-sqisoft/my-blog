import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from './sanitize-rich-html';

// T-READ-102: 클라이언트 sanitize 게이트(구 RichContent 회귀 가드, T-WEB-303)를 util 단위로 검증.
// 서버가 마지막 게이트지만 잘못된 입력이 어떤 경로로든 흘러 들어와도 화이트리스트 외는 제거된다.
function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('sanitizeRichHtml', () => {
  it('정상 HTML(헤딩/단락) 은 보존한다', () => {
    const doc = parse(sanitizeRichHtml('<h2>제목</h2><p>본문</p>'));
    expect(doc.querySelector('h2')?.textContent).toBe('제목');
    expect(doc.querySelector('p')?.textContent).toBe('본문');
  });

  it('span class 화이트리스트(text-rose-500/text-lg) 를 보존한다', () => {
    const doc = parse(
      sanitizeRichHtml('<p><span class="text-rose-500 text-lg">강조</span></p>'),
    );
    const span = doc.querySelector('span');
    expect(span?.className).toContain('text-rose-500');
    expect(span?.className).toContain('text-lg');
  });

  it('<script> 는 제거한다', () => {
    const doc = parse(sanitizeRichHtml('<p>안녕</p><script>alert(1)</script>'));
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('p')?.textContent).toBe('안녕');
  });

  it('이미지 onerror 같은 위험 속성은 제거한다', () => {
    const doc = parse(
      sanitizeRichHtml('<img src="/uploads/a.jpg" onerror="alert(1)">'),
    );
    const img = doc.querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
    expect(img?.getAttribute('src')).toBe('/uploads/a.jpg');
  });

  it('javascript: 스킴 링크의 href 는 제거한다', () => {
    const doc = parse(sanitizeRichHtml('<a href="javascript:alert(1)">클릭</a>'));
    const href = doc.querySelector('a')?.getAttribute('href') ?? '';
    expect(href).not.toMatch(/^javascript:/i);
  });

  it('<video src controls preload playsinline> 속성을 보존한다', () => {
    const doc = parse(
      sanitizeRichHtml(
        '<video src="/uploads/clip.mp4" controls preload="metadata" playsinline></video>',
      ),
    );
    const video = doc.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/uploads/clip.mp4');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });

  it('빈 입력은 빈 문자열', () => {
    expect(sanitizeRichHtml('')).toBe('');
  });
});
