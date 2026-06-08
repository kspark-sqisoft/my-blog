import { escapeXml } from './xml';

// T-SEO-001: XML/HTML 이스케이프 (ADR-0026). 피드·사이트맵·OG 메타 주입 방지.
describe('escapeXml', () => {
  it('& < > " \' 를 엔티티로 치환', () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f',
    );
  });

  it('& 를 먼저 치환해 이중 이스케이프하지 않는다', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
    expect(escapeXml('a & b')).toBe('a &amp; b');
  });

  it('일반 텍스트(한글 포함)는 변경하지 않는다', () => {
    expect(escapeXml('한글 텍스트 123 abc')).toBe('한글 텍스트 123 abc');
  });

  it('빈 문자열은 빈 문자열', () => {
    expect(escapeXml('')).toBe('');
  });
});
