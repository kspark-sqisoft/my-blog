import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { absoluteUrl, siteUrl } from './site-url';
import { escapeXml } from './xml';

// sitemap.xml + robots.txt 생성 (ADR-0026, seo-feed).
// 발행글 슬러그 + 발행글에 사용된 태그 페이지 + 홈을 sitemaps.org 0.9 로 노출한다.
// 초안·미발행은 어디에도 노출하지 않는다.
@Injectable()
export class SitemapService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSitemap(): Promise<string> {
    const base = siteUrl();
    // 발행글·태그를 각각 단일 findMany 로 병렬 조회(N+1 없음).
    const [posts, tags] = await Promise.all([
      this.prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.tag.findMany({
        where: { postTags: { some: { post: { status: 'PUBLISHED' } } } },
        select: { name: true },
      }),
    ]);

    const urls = [
      this.urlEntry(`${base}/`),
      ...posts.map((p) =>
        this.urlEntry(absoluteUrl(`/posts/${p.slug}`, base), p.updatedAt),
      ),
      ...tags.map((t) => this.urlEntry(absoluteUrl(`/tags/${t.name}`, base))),
    ];

    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls.join('') +
      '</urlset>'
    );
  }

  buildRobots(): string {
    const sitemap = absoluteUrl('/sitemap.xml');
    return `User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`;
  }

  // lastmod 는 W3C 날짜(YYYY-MM-DD). 정적/태그 페이지는 lastmod 생략.
  private urlEntry(loc: string, lastmod?: Date): string {
    const mod = lastmod
      ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`
      : '';
    return `<url><loc>${escapeXml(loc)}</loc>${mod}</url>`;
  }
}
