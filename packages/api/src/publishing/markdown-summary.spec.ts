import { toSummaryText } from './markdown-summary';

describe('toSummaryText', () => {
  it('이미지 마크다운을 제거한다', () => {
    const out = toSummaryText('![커버](/uploads/a.jpg) 본문 시작');
    expect(out).toBe('본문 시작');
    expect(out).not.toContain('![');
    expect(out).not.toContain('/uploads');
  });

  it('헤딩/코드펜스/강조/링크를 평문으로 정리한다', () => {
    const md =
      '![커버](/uploads/x.jpg)\n## 들어가며\n규칙을 지켜라. ```ts feat: x ``` 이 글은 **릴리스, 협업** 정리. [문서](https://e) 참고';
    const out = toSummaryText(md);
    expect(out).not.toMatch(/[#`*]/);
    expect(out).not.toContain('![');
    expect(out).toContain('들어가며');
    expect(out).toContain('릴리스, 협업');
    expect(out).toContain('문서'); // 링크 텍스트만 남는다
    expect(out).not.toContain('https://e');
  });

  it('max 길이를 넘으면 … 로 자른다', () => {
    const out = toSummaryText('가'.repeat(300), 200);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(201);
  });

  it('빈 입력은 빈 문자열', () => {
    expect(toSummaryText('')).toBe('');
  });
});
