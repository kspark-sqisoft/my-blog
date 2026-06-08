import { FeedService } from './feed.service';
import { PrismaService } from '../../prisma/prisma.service';

// T-SEO-002: RSS 2.0 피드 생성 (ADR-0026). 발행글만, 요약만, dc:creator.
interface FindManyArg {
  where: unknown;
  orderBy: unknown;
  take: number;
  include: unknown;
}

describe('FeedService', () => {
  const origSite = process.env.SITE_URL;
  const origMax = process.env.FEED_MAX_ITEMS;

  afterEach(() => {
    if (origSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = origSite;
    if (origMax === undefined) delete process.env.FEED_MAX_ITEMS;
    else process.env.FEED_MAX_ITEMS = origMax;
    jest.clearAllMocks();
  });

  function makeService(rows: unknown[]) {
    const findMany = jest
      .fn<Promise<unknown[]>, [FindManyArg]>()
      .mockResolvedValue(rows);
    const prisma = { post: { findMany } } as unknown as PrismaService;
    return { service: new FeedService(prisma), findMany };
  }

  const post1 = {
    slug: 'first-post',
    title: 'First & <b>Post</b>',
    contentHtml: '<p>안녕하세요 본문입니다.</p>',
    contentMarkdown: '',
    publishedAt: new Date('2026-06-03T09:00:00Z'),
    author: { name: 'A & B' },
  };
  const post2 = {
    slug: '두번째',
    title: '두 번째 글',
    contentHtml: '<p>두번째 본문.</p>',
    contentMarkdown: '',
    publishedAt: new Date('2026-06-04T09:00:00Z'),
    author: { name: '박기순' },
  };

  it('발행글만 publishedAt 최신순 최대 N(기본 20) 단일 findMany 로 조회(N+1 없음)', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    delete process.env.FEED_MAX_ITEMS;
    const { service, findMany } = makeService([post2, post1]);
    await service.buildRss();
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: 'PUBLISHED' });
    expect(arg.orderBy).toEqual({ publishedAt: 'desc' });
    expect(arg.take).toBe(20);
    expect(arg.include).toEqual({ author: { select: { name: true } } });
  });

  it('RSS 루트에 atom·dc 네임스페이스 + channel + atom:link self', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = makeService([post1]);
    const xml = await service.buildRss();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain(
      '<atom:link href="https://blog.example.com/feed.xml" rel="self"',
    );
  });

  it('각 item: link·guid(슬러그 절대URL)·description(요약)·pubDate(RFC822)·dc:creator', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = makeService([post2]);
    const xml = await service.buildRss();
    const slugUrl =
      'https://blog.example.com/posts/' + encodeURIComponent('두번째');
    expect(xml).toContain('<item>');
    expect(xml).toContain(`<link>${slugUrl}</link>`);
    expect(xml).toContain(`<guid isPermaLink="true">${slugUrl}</guid>`);
    expect(xml).toContain('<dc:creator>박기순</dc:creator>');
    expect(xml).toContain('두번째 본문'); // 요약(평문)
    expect(xml).toContain(
      `<pubDate>${post2.publishedAt.toUTCString()}</pubDate>`,
    );
  });

  it('제목·작성자의 특수문자를 이스케이프해 유효 XML(원시 태그 없음)', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = makeService([post1]);
    const xml = await service.buildRss();
    expect(xml).toContain('First &amp; &lt;b&gt;Post&lt;/b&gt;');
    expect(xml).toContain('<dc:creator>A &amp; B</dc:creator>');
    expect(xml).not.toContain('<b>Post</b>');
  });

  it('FEED_MAX_ITEMS 환경변수로 take 상한 조정', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    process.env.FEED_MAX_ITEMS = '5';
    const { service, findMany } = makeService([]);
    await service.buildRss();
    expect(findMany.mock.calls[0][0].take).toBe(5);
  });
});
