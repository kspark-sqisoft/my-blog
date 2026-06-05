import { describe, expect, it } from 'vitest';
import { estimateReadingTime } from './reading-time';

describe('estimateReadingTime', () => {
  it('공백 제외 글자 수를 500자/분으로 환산하고 올림한다', () => {
    // 500자 → 정확히 1분
    expect(estimateReadingTime('가'.repeat(500))).toBe(1);
    // 600자 → ceil(1.2) = 2분
    expect(estimateReadingTime('가'.repeat(600))).toBe(2);
    // 1500자 → 3분
    expect(estimateReadingTime('가'.repeat(1500))).toBe(3);
  });

  it('짧은 본문도 최소 1분으로 보장한다', () => {
    expect(estimateReadingTime('<p>안녕하세요</p>')).toBe(1);
  });

  it('HTML 태그는 글자 수에서 제외한다', () => {
    // 태그를 벗기면 본문 글자는 단 몇 자 → 1분
    const html = '<h1>제목</h1><p><strong>굵게</strong> 본문</p>';
    expect(estimateReadingTime(html)).toBe(1);
  });

  it('빈 본문/태그만 있는 경우 0을 반환한다(호출부에서 숨김)', () => {
    expect(estimateReadingTime('')).toBe(0);
    expect(estimateReadingTime('   ')).toBe(0);
    expect(estimateReadingTime('<p></p><br><hr>')).toBe(0);
  });

  it('HTML 엔티티와 다중 공백은 글자 수에서 정규화한다', () => {
    // &nbsp; 와 연속 공백/개행은 공백으로 취급되어 글자 수에 포함되지 않는다
    const html = '<p>가\n\n  나&nbsp;&nbsp;다</p>';
    // 실제 글자: 가, 나, 다 = 3자 → 최소 1분
    expect(estimateReadingTime(html)).toBe(1);
  });
});
