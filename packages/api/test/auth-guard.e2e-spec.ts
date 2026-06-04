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
import { PrismaModule } from './../src/prisma/prisma.module';
import { PrismaService } from './../src/prisma/prisma.service';

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
  // JwtStrategy가 PrismaService를 주입해 매 요청 User를 재조회한다 (ADR-0018)
  imports: [
    PrismaModule,
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
  let prisma: PrismaService;
  let userId: string;

  const email = 'guard-probe@example.com';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ProbeAuthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    prisma = moduleRef.get(PrismaService);
    configureApp(app);
    await app.init();

    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({
      data: { email, passwordHash: 'x', name: '프로브', role: 'ADMIN' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('유효한 access_token 쿠키 → 200 + req.user{ id, email, name, role }', () => {
    const token = jwt.sign({ sub: userId, email });
    return request(app.getHttpServer())
      .get('/api/me-probe')
      .set('Cookie', `access_token=${token}`)
      .expect(200)
      .expect({ id: userId, email, name: '프로브', role: 'ADMIN' });
  });

  it('DB에 없는 sub(삭제된 계정) → 401', () => {
    const token = jwt.sign({ sub: 'no-such-user-id', email });
    return request(app.getHttpServer())
      .get('/api/me-probe')
      .set('Cookie', `access_token=${token}`)
      .expect(401);
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
    const expired = jwt.sign({ sub: userId, email }, { expiresIn: '-10s' });
    return request(app.getHttpServer())
      .get('/api/me-probe')
      .set('Cookie', `access_token=${expired}`)
      .expect(401);
  });
});
