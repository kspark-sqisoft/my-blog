import { extractFirstImageUrl } from './cover-image';

describe('extractFirstImageUrl', () => {
  it('마크다운 이미지의 첫 URL을 반환한다', () => {
    const md = '소개 문단\n\n![대표](/uploads/a.png)\n\n본문';
    expect(extractFirstImageUrl(md)).toBe('/uploads/a.png');
  });

  it('이미지가 여러 개면 가장 먼저 나오는 것을 반환한다', () => {
    const md = '![first](/uploads/1.png) 그리고 ![second](/uploads/2.png)';
    expect(extractFirstImageUrl(md)).toBe('/uploads/1.png');
  });

  it('이미지 뒤 title 속성이 있어도 URL만 추출한다', () => {
    const md = '![alt](/uploads/x.png "캡션")';
    expect(extractFirstImageUrl(md)).toBe('/uploads/x.png');
  });

  it('원시 HTML <img> 도 인식한다', () => {
    const md = '<img src="/uploads/raw.png" alt="x" />';
    expect(extractFirstImageUrl(md)).toBe('/uploads/raw.png');
  });

  it('이미지가 없으면 null', () => {
    expect(extractFirstImageUrl('# 제목\n본문만 있음')).toBeNull();
  });

  it('빈 문자열/공백은 null', () => {
    expect(extractFirstImageUrl('')).toBeNull();
    expect(extractFirstImageUrl('   ')).toBeNull();
  });
});
