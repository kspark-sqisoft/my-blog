import { Controller, Get, Header } from '@nestjs/common';
import { FeedService } from './feed.service';

// seo-feed 산출물 컨트롤러 (ADR-0026). 전역 prefix(/api) 에서 제외된 루트 경로로
// 크롤러·피드리더 표준 위치에 제공한다(app-setup.ts setGlobalPrefix exclude).
@Controller()
export class SeoController {
  constructor(private readonly feed: FeedService) {}

  // RSS 2.0 피드. 글로벌 응답 래핑이 없어 문자열이 그대로 본문으로 나간다.
  @Get('feed.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  feedXml(): Promise<string> {
    return this.feed.buildRss();
  }
}
