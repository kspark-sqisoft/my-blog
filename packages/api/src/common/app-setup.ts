import * as path from 'node:path';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

// 전역 앱 설정. main.ts와 e2e 테스트가 동일하게 사용한다.
export function configureApp(app: INestApplication): INestApplication {
  // 모든 라우트는 /api 하위 (TRD §3).
  // 단, seo-feed 산출물은 크롤러·피드리더 표준 경로라 /api prefix 에서 제외한다(ADR-0026).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'feed.xml', method: RequestMethod.GET },
      { path: 'sitemap.xml', method: RequestMethod.GET },
      { path: 'robots.txt', method: RequestMethod.GET },
      { path: 'og/(.*)', method: RequestMethod.GET },
    ],
  });

  // 업로드 이미지 정적 서빙 (ADR-0012).
  // LocalStorageProvider와 동일한 경로/URL 베이스를 사용해야 한다.
  // setGlobalPrefix(/api)의 영향을 받지 않으므로 UPLOAD_URL_BASE(기본 /uploads)로 노출된다.
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
  const uploadUrlBase = (process.env.UPLOAD_URL_BASE ?? '/uploads').replace(
    /\/+$/,
    '',
  );
  (app as NestExpressApplication).useStaticAssets(uploadDir, {
    prefix: uploadUrlBase,
  });

  // httpOnly 쿠키(JWT) 파싱 (ADR-0001)
  app.use(cookieParser());

  // 전역 입력 검증: 화이트리스트 외 속성 거부 + DTO 변환
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
