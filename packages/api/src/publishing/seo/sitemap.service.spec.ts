import { SitemapService } from './sitemap.service';
import { PrismaService } from '../../prisma/prisma.service';

// T-SEO-003: sitemap.xml + robots.txt (ADR-0026). 발행글 슬러그+태그+홈, 초안 제외.
describe('SitemapService', () => {
  const orig = process.env.SITE_URL;
  afterEach(() => {
    if (orig === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = orig;
    jest.clearAllMocks();
  });

  function make(posts: unknown[], tags: unknown[]) {
    const postFind = jest
      .fn<Promise<unknown[]>, [Record<string, unknown>]>()
      .mockResolvedValue(posts);
    const tagFind = jest
      .fn<Promise<unknown[]>, [Record<string, unknown>]>()
      .mockResolvedValue(tags);
    const prisma = {
      post: { findMany: postFind },
      tag: { findMany: tagFind },
    } as unknown as PrismaService;
    return { service: new SitemapService(prisma), postFind, tagFind };
  }

  it('홈 + 발행글 슬러그 + 태그 urlset(0.9), 발행글만, lastmod=updatedAt', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service, postFind } = make(
      [{ slug: '첫글', updatedAt: new Date('2026-06-03T00:00:00Z') }],
      [{ name: 'nestjs' }],
    );
    const xml = await service.buildSitemap();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml).toContain('<loc>https://blog.example.com/</loc>');
    const postUrl =
      'https://blog.example.com/posts/' + encodeURIComponent('첫글');
    expect(xml).toContain(`<loc>${postUrl}</loc>`);
    expect(xml).toContain('<lastmod>2026-06-03</lastmod>');
    expect(xml).toContain('<loc>https://blog.example.com/tags/nestjs</loc>');
    expect(postFind.mock.calls[0][0]).toMatchObject({
      where: { status: 'PUBLISHED' },
    });
  });

  it('발행글·태그를 각각 단일 findMany 로 조회(N+1 없음), 태그는 발행글 사용분만', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service, postFind, tagFind } = make([], []);
    await service.buildSitemap();
    expect(postFind).toHaveBeenCalledTimes(1);
    expect(tagFind).toHaveBeenCalledTimes(1);
    expect(tagFind.mock.calls[0][0]).toMatchObject({
      where: { postTags: { some: { post: { status: 'PUBLISHED' } } } },
    });
  });

  it('robots.txt 에 User-agent·Allow·Sitemap 절대 URL 포함', () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make([], []);
    const txt = service.buildRobots();
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Sitemap: https://blog.example.com/sitemap.xml');
  });
});
