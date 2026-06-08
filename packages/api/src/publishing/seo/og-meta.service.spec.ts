import { NotFoundException } from '@nestjs/common';
import { OgMetaService } from './og-meta.service';
import { PrismaService } from '../../prisma/prisma.service';

// T-SEO-004: 봇용 Open Graph HTML (ADR-0026). 발행글만, 미발행 404, 외부이미지 폴백.
describe('OgMetaService', () => {
  const orig = process.env.SITE_URL;
  afterEach(() => {
    if (orig === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = orig;
    jest.clearAllMocks();
  });

  function make(post: unknown) {
    const findFirst = jest
      .fn<Promise<unknown>, [Record<string, unknown>]>()
      .mockResolvedValue(post);
    const prisma = { post: { findFirst } } as unknown as PrismaService;
    return { service: new OgMetaService(prisma), findFirst };
  }

  const published = {
    slug: '글-슬러그',
    title: 'OG 제목 & <태그>',
    contentHtml: '<p>요약 본문입니다.</p><img src="/uploads/a.jpg">',
    contentMarkdown: '',
    author: { name: '박기순' },
  };

  it('발행글 OG HTML: og:type/url·canonical·twitter:card 값 정확', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make(published);
    const html = await service.buildPostOg('글-슬러그');
    const url =
      'https://blog.example.com/posts/' + encodeURIComponent('글-슬러그');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain(`<meta property="og:url" content="${url}">`);
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image">',
    );
  });

  it('제목·설명을 HTML 이스케이프(주입 방지)', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make(published);
    const html = await service.buildPostOg('글-슬러그');
    expect(html).toContain(
      '<meta property="og:title" content="OG 제목 &amp; &lt;태그&gt;">',
    );
    expect(html).not.toContain('<태그>');
  });

  it('대표이미지 로컬 /uploads 면 SITE_URL 로 절대화', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make(published);
    const html = await service.buildPostOg('글-슬러그');
    expect(html).toContain(
      '<meta property="og:image" content="https://blog.example.com/uploads/a.jpg">',
    );
  });

  it('대표이미지가 외부 URL 이면 기본 이미지로 폴백(외부 URL 비노출)', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make({
      ...published,
      contentHtml: '<p>x</p><img src="https://evil.com/x.jpg">',
    });
    const html = await service.buildPostOg('글-슬러그');
    expect(html).toContain(
      '<meta property="og:image" content="https://blog.example.com/og-default.png">',
    );
    expect(html).not.toContain('evil.com');
  });

  it('대표이미지가 protocol-relative(//host) 면 기본 이미지로 폴백', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make({
      ...published,
      contentHtml: '<p>x</p><img src="//evil.com/x.jpg">',
    });
    const html = await service.buildPostOg('글-슬러그');
    expect(html).toContain(
      '<meta property="og:image" content="https://blog.example.com/og-default.png">',
    );
    expect(html).not.toContain('evil.com');
  });

  it('대표이미지가 없으면 기본 이미지로 폴백', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service } = make({
      ...published,
      contentHtml: '<p>이미지 없음</p>',
    });
    const html = await service.buildPostOg('글-슬러그');
    expect(html).toContain(
      '<meta property="og:image" content="https://blog.example.com/og-default.png">',
    );
  });

  it('미발행/없는 slug 는 NotFoundException(발행 격리)', async () => {
    const { service } = make(null);
    await expect(service.buildPostOg('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('발행글만 조회(where status PUBLISHED)', async () => {
    process.env.SITE_URL = 'https://blog.example.com';
    const { service, findFirst } = make(published);
    await service.buildPostOg('글-슬러그');
    expect(findFirst.mock.calls[0][0]).toMatchObject({
      where: { status: 'PUBLISHED' },
    });
  });
});
