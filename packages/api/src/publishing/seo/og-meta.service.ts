import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { extractFirstImageUrl } from '../cover-image';
import { toSummaryText } from '../markdown-summary';
import { absoluteUrl, siteUrl } from './site-url';
import { DEFAULT_OG_IMAGE, SITE_NAME } from './site-config';
import { escapeXml } from './xml';

const SUMMARY_MAX = 200;

// OG HTML 생성에 필요한 최소 형태(발행 Post + 작성자 표시 이름).
interface OgPost {
  slug: string;
  title: string;
  contentHtml: string;
  contentMarkdown: string;
  author: { name: string };
}

// 봇용 Open Graph 메타 HTML 생성 (ADR-0026, seo-feed).
// SPA(CSR) 라 크롤러가 글별 메타를 못 읽으므로, 봇 요청에 한해 서버가 메타만 채운
// 최소 HTML 을 제공한다(사람은 SPA 그대로). 발행글만, 미발행/없음은 404(발행 격리).
@Injectable()
export class OgMetaService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPostOg(idOrSlug: string): Promise<string> {
    const post = (await this.prisma.post.findFirst({
      where: {
        status: 'PUBLISHED',
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      include: { author: { select: { name: true } } },
    })) as OgPost | null;
    if (!post) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }

    const base = siteUrl();
    const url = escapeXml(absoluteUrl(`/posts/${post.slug}`, base));
    const title = escapeXml(post.title);
    const description = escapeXml(
      toSummaryText(post.contentHtml || post.contentMarkdown, SUMMARY_MAX),
    );
    const image = escapeXml(this.ogImage(post, base));
    const siteName = escapeXml(SITE_NAME);

    return (
      '<!doctype html>' +
      '<html lang="ko"><head>' +
      '<meta charset="utf-8">' +
      `<title>${title} — ${siteName}</title>` +
      `<link rel="canonical" href="${url}">` +
      '<meta property="og:type" content="article">' +
      `<meta property="og:site_name" content="${siteName}">` +
      `<meta property="og:title" content="${title}">` +
      `<meta property="og:description" content="${description}">` +
      `<meta property="og:url" content="${url}">` +
      `<meta property="og:image" content="${image}">` +
      '<meta name="twitter:card" content="summary_large_image">' +
      `<meta name="twitter:title" content="${title}">` +
      `<meta name="twitter:description" content="${description}">` +
      `<meta name="twitter:image" content="${image}">` +
      '</head><body>' +
      `<noscript>${description}</noscript>` +
      '</body></html>'
    );
  }

  // 대표 이미지: **로컬 업로드 경로(/uploads/...)만 신뢰**해 SITE_URL 로 절대화한다.
  // 외부 절대 URL·protocol-relative(//host)·기타는 모두 기본 이미지로 폴백
  // (외부 URL 을 fetch 하지 않고 카드에도 노출하지 않음 — SSRF·외부 추적·깨진 카드 차단).
  private ogImage(post: OgPost, base: string): string {
    const first = extractFirstImageUrl(
      post.contentHtml || post.contentMarkdown,
    );
    if (first && first.startsWith('/uploads/') && !first.includes('..')) {
      return absoluteUrl(first, base);
    }
    return absoluteUrl(DEFAULT_OG_IMAGE, base);
  }
}
