import { absoluteUrl, isExternalUrl, siteUrl } from './site-url';

// T-SEO-001: 절대 URL 생성 유틸 (ADR-0026). SITE_URL 기준 절대화 + 외부 URL 판별.
describe('site-url', () => {
  const orig = process.env.SITE_URL;
  afterEach(() => {
    if (orig === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = orig;
  });

  describe('siteUrl()', () => {
    it('SITE_URL 미설정 시 dev 기본값(http://localhost:5173)', () => {
      delete process.env.SITE_URL;
      expect(siteUrl()).toBe('http://localhost:5173');
    });

    it('SITE_URL 설정 시 후행 슬래시 제거', () => {
      process.env.SITE_URL = 'https://blog.example.com/';
      expect(siteUrl()).toBe('https://blog.example.com');
    });
  });

  describe('absoluteUrl()', () => {
    it('상대 경로를 SITE_URL 기준 절대화 + 한글 슬러그 인코딩', () => {
      process.env.SITE_URL = 'https://blog.example.com';
      expect(absoluteUrl('/posts/슬러그')).toBe(
        'https://blog.example.com/posts/' + encodeURIComponent('슬러그'),
      );
    });

    it('이미 절대 URL 이면 그대로 반환', () => {
      expect(absoluteUrl('https://other.com/a.jpg')).toBe(
        'https://other.com/a.jpg',
      );
    });

    it('선행 슬래시가 없어도 붙여서 절대화', () => {
      process.env.SITE_URL = 'https://blog.example.com';
      expect(absoluteUrl('feed.xml')).toBe('https://blog.example.com/feed.xml');
    });
  });

  describe('isExternalUrl()', () => {
    it('외부 http(s) 절대 URL 은 true', () => {
      expect(isExternalUrl('https://other.com/x.jpg')).toBe(true);
      expect(isExternalUrl('http://other.com/x.jpg')).toBe(true);
    });

    it('로컬 /uploads 상대경로는 false', () => {
      expect(isExternalUrl('/uploads/abc.jpg')).toBe(false);
    });
  });
});
