import { Controller, Get, Header, Param } from '@nestjs/common';
import { OgMetaService } from './og-meta.service';

// 봇용 Open Graph HTML 컨트롤러 (ADR-0026). /og 는 전역 prefix(/api) 에서 제외된다.
// nginx 가 크롤러 UA 의 /posts/:slug 를 여기로 프록시한다(사람은 SPA). 직접 호출도 가능(테스트).
@Controller('og')
export class OgController {
  constructor(private readonly og: OgMetaService) {}

  @Get('posts/:slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  postOg(@Param('slug') slug: string): Promise<string> {
    return this.og.buildPostOg(slug);
  }
}
