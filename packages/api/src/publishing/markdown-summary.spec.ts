import { toSummaryText } from './markdown-summary';

// T-PUB-302: 입력은 sanitize 통과한 HTML. 평문 텍스트만 추출해 목록 카드의 요약으로 쓴다.
describe('toSummaryText (HTML 입력)', () => {
  it('헤딩/단락 평문을 공백 정리해 반환한다', () => {
    const html =
      '<h2>들어가며</h2><p>규칙을 지켜라.</p><p>릴리스, 협업 정리.</p>';
    const out = toSummaryText(html);
    expect(out).toContain('들어가며');
    expect(out).toContain('규칙을 지켜라');
    expect(out).toContain('릴리스, 협업 정리');
    // 태그는 평문에 남지 않는다
    expect(out).not.toMatch(/[<>]/);
  });

  it('img/video 노드는 요약 텍스트에 포함되지 않는다', () => {
    const html = '<img src="/uploads/a.jpg" alt="커버"><p>본문 시작</p>';
    const out = toSummaryText(html);
    expect(out).toContain('본문 시작');
    expect(out).not.toContain('/uploads');
    expect(out).not.toContain('<img');
  });

  it('링크는 표시 텍스트만 남는다', () => {
    const html =
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">문서</a> 참고</p>';
    const out = toSummaryText(html);
    expect(out).toContain('문서');
    expect(out).toContain('참고');
    expect(out).not.toContain('https://example.com');
  });

  it('max 길이를 넘으면 … 로 자른다', () => {
    const html = `<p>${'가'.repeat(300)}</p>`;
    const out = toSummaryText(html, 200);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(201);
  });

  it('빈 입력은 빈 문자열', () => {
    expect(toSummaryText('')).toBe('');
    expect(toSummaryText('   ')).toBe('');
  });

  it('연속 공백·줄바꿈은 단일 공백으로 정리된다', () => {
    const html = '<p>안녕</p>\n\n<p>   여러   공백   </p>';
    const out = toSummaryText(html);
    expect(out).toBe('안녕 여러 공백');
  });
});
