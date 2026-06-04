import { requireJwtSecret } from './jwt-secret';

// JWT_SECRET 부트 검증 (C1). 폴백 'change-me' 제거 → 누락 시 즉시 throw.
describe('requireJwtSecret', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = original;
    }
  });

  it('JWT_SECRET 미설정이면 throw', () => {
    delete process.env.JWT_SECRET;
    expect(() => requireJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('JWT_SECRET 빈 문자열이면 throw', () => {
    process.env.JWT_SECRET = '';
    expect(() => requireJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('JWT_SECRET 공백만 있는 문자열도 throw', () => {
    process.env.JWT_SECRET = '   ';
    expect(() => requireJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('JWT_SECRET 값이 있으면 그 값을 반환', () => {
    process.env.JWT_SECRET = 'real-secret';
    expect(requireJwtSecret()).toBe('real-secret');
  });
});
