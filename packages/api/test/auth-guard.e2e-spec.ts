import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/common/app-setup';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard';
import { JwtStrategy } from './../src/auth/jwt.strategy';

process.env.JWT_SECRET ??= 'test-secret';

// 보호 라우트 프로브: req.user를 그대로 반환
@Controller('me-probe')
class MeProbeController {
  @UseGuards(JwtAuthGuard)
  @Get()
  me(@Req() req: Request) {
    return req.user;
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [MeProbeController],
  providers: [JwtStrategy],
})
class ProbeAuthModule {}

describe('JwtAuthGuard + JwtStrategy (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ProbeAuthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('유효한 access_token 쿠키 → 200 + req.user{ id, email }', () => {
    const token = jwt.sign({ sub: 'u1', email: 'owner@example.com' });
    return request(app.getHttpServer())
      .get('/api/me-probe')
      .set('Cookie', `access_token=${token}`)
      .expect(200)
      .expect({ id: 'u1', email: 'owner@example.com' });
  });

  it('쿠키 없음 → 401', () => {
    return request(app.getHttpServer()).get('/api/me-probe').expect(401);
  });

  it('위조 토큰 → 401', () => {
    return request(app.getHttpServer())
      .get('/api/me-probe')
      .set('Cookie', 'access_token=not.a.realtoken')
      .expect(401);
  });

  it('만료 토큰 → 401', () => {
    const expired = jwt.sign(
      { sub: 'u1', email: 'owner@example.com' },
      { expiresIn: '-10s' },
    );
    return request(app.getHttpServer())
      .get('/api/me-probe')
      .set('Cookie', `access_token=${expired}`)
      .expect(401);
  });
});
