import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

// 전역 앱 설정. main.ts와 e2e 테스트가 동일하게 사용한다.
export function configureApp(app: INestApplication): INestApplication {
  // 모든 라우트는 /api 하위 (TRD §3)
  app.setGlobalPrefix('api');

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
