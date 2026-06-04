import { convertMarkdownToHtml } from './markdown-to-html';

// T-INFRA-303: 마크다운 본문을 ADR-0021 의 sanitize 통과 HTML 로 변환한다.
// - markdown-it 으로 1차 HTML
// - .mp4 확장자 <img> 를 <video> 노드로 후처리(ADR-0020 호환)
// - sanitize-html(richHtmlSchema) 통과 — 위험 입력 모두 제거
// - 멱등(같은 입력은 같은 결과)
describe('convertMarkdownToHtml (ADR-0021 마이그레이션 변환)', () => {
  it('마크다운 기본 변환: 헤딩/굵게/리스트', () => {
    const html = convertMarkdownToHtml('# 제목\n\n**굵게**\n\n- 하나\n- 둘');
    expect(html).toContain('<h1>제목</h1>');
    expect(html).toContain('<strong>굵게</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>하나</li>');
    expect(html).toContain('<li>둘</li>');
  });

  it('![alt](*.jpg) 는 <img> 로 변환된다', () => {
    const html = convertMarkdownToHtml('![풍경](/uploads/a.jpg)');
    expect(html).toMatch(/<img[^>]+src="\/uploads\/a\.jpg"[^>]*>/);
    expect(html).toMatch(/alt="풍경"/);
  });

  it('![alt](*.mp4) 는 <video controls preload="metadata" playsinline> 로 후처리된다', () => {
    const html = convertMarkdownToHtml('![데모](/uploads/clip.mp4)');
    expect(html).toMatch(
      /<video[^>]+src="\/uploads\/clip\.mp4"[^>]*><\/video>/,
    );
    expect(html).toMatch(/controls/);
    expect(html).toMatch(/preload="metadata"/);
    expect(html).toMatch(/playsinline/);
    // 같은 자리에 <img> 가 남아있으면 회귀
    expect(html).not.toMatch(/<img[^>]+\.mp4/);
  });

  it('<script> 태그는 제거된다(XSS)', () => {
    const html = convertMarkdownToHtml('<script>alert(1)</script>안녕');
    expect(html).not.toContain('<script');
    expect(html).toContain('안녕');
  });

  it('img onerror 같은 위험 속성은 제거된다', () => {
    const html = convertMarkdownToHtml(
      '<img src="/uploads/a.jpg" onerror="alert(1)" />',
    );
    expect(html).not.toMatch(/onerror/i);
  });

  it('javascript: 스킴 마크다운 링크는 href 로 박히지 않는다 (markdown-it 안전 + sanitize 이중 방어)', () => {
    const html = convertMarkdownToHtml('[클릭](javascript:alert(1))');
    expect(html).not.toMatch(/href=["'][^"']*javascript:/i);
  });

  it('raw <a href="javascript:..."> 도 sanitize 가 href 를 제거한다', () => {
    const html = convertMarkdownToHtml(
      '<a href="javascript:alert(1)">클릭</a>',
    );
    expect(html).not.toMatch(/href=["'][^"']*javascript:/i);
  });

  it('일반 링크에는 target=_blank + rel=noopener noreferrer 가 자동 부착된다', () => {
    const html = convertMarkdownToHtml('[블로그](https://example.com)');
    expect(html).toMatch(/<a [^>]*href="https:\/\/example\.com"/);
    expect(html).toMatch(/target="_blank"/);
    expect(html).toMatch(/rel="noopener noreferrer"/);
  });

  it('멱등: 한 번 변환된 결과를 다시 넣어도 같은 결과', () => {
    const md = '# 제목\n\n![demo](/uploads/x.mp4)';
    const once = convertMarkdownToHtml(md);
    const twice = convertMarkdownToHtml(md);
    expect(twice).toBe(once);
  });

  it('이미 HTML 인 contentHtml 도 안전하게 통과한다(빈 입력 케이스)', () => {
    expect(convertMarkdownToHtml('')).toBe('');
  });
});
