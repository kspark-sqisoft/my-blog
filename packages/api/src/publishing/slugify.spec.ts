import { slugify } from './slugify';

// T-PUB-108 (ADR-0022): 제목 → URL 슬러그. 한글 보존, 공백→-, 특수문자 제거.
describe('slugify', () => {
  it('영문은 소문자화하고 공백을 - 로 바꾼다', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('한글은 보존하고 공백을 - 로 바꾼다', () => {
    expect(slugify('NestJS 입문')).toBe('nestjs-입문');
  });

  it('특수문자/구두점은 제거한다', () => {
    expect(slugify('React, 그리고 Vite!')).toBe('react-그리고-vite');
  });

  it('연속 공백/하이픈을 하나로 합치고 양끝 하이픈을 제거한다', () => {
    expect(slugify('  --제목   여백--  ')).toBe('제목-여백');
  });

  it('슬러그가 비면 post 로 폴백한다', () => {
    expect(slugify('!!!')).toBe('post');
    expect(slugify('   ')).toBe('post');
  });

  it('최대 80자로 자르고 잘린 끝 하이픈은 제거한다', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});
