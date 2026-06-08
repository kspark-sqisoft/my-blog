import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toSummaryText } from '../markdown-summary';
import { absoluteUrl, siteUrl } from './site-url';
import { SITE_DESCRIPTION, SITE_NAME, feedMaxItems } from './site-config';
import { escapeXml } from './xml';

const SUMMARY_MAX = 200;

// 피드 생성에 필요한 최소 형태(발행 Post + 작성자 표시 이름).
interface FeedRow {
  slug: string;
  title: string;
  contentHtml: string;
  contentMarkdown: string;
  publishedAt: Date | null;
  author: { name: string };
}

// RSS 2.0 피드 생성 (ADR-0026, seo-feed).
// 발행글만 요약(평문)으로 신디케이션한다. 작성자는 PII 인 RSS author(이메일) 대신
// dc:creator(표시 이름)로 노출하고, 모든 사용자 콘텐츠는 XML 이스케이프한다.
@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async buildRss(): Promise<string> {
    // 발행글·작성자를 단일 findMany(include)로 배치 로드 — N+1 없음.
    const posts = (await this.prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: feedMaxItems(),
      include: { author: { select: { name: true } } },
    })) as FeedRow[];

    const base = siteUrl();
    const feedUrl = absoluteUrl('/feed.xml', base);
    const items = posts.map((post) => this.item(post, base)).join('');

    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<channel>' +
      `<title>${escapeXml(SITE_NAME)}</title>` +
      `<link>${base}</link>` +
      `<description>${escapeXml(SITE_DESCRIPTION)}</description>` +
      `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>` +
      items +
      '</channel>' +
      '</rss>'
    );
  }

  private item(post: FeedRow, base: string): string {
    const url = absoluteUrl(`/posts/${post.slug}`, base);
    const summary = toSummaryText(
      post.contentHtml || post.contentMarkdown,
      SUMMARY_MAX,
    );
    const pubDate = post.publishedAt ? post.publishedAt.toUTCString() : '';
    return (
      '<item>' +
      `<title>${escapeXml(post.title)}</title>` +
      `<link>${url}</link>` +
      `<guid isPermaLink="true">${url}</guid>` +
      `<description>${escapeXml(summary)}</description>` +
      (pubDate ? `<pubDate>${pubDate}</pubDate>` : '') +
      `<dc:creator>${escapeXml(post.author.name)}</dc:creator>` +
      '</item>'
    );
  }
}
