import {
  Body,
  Controller,
  Get,
  INestApplication,
  Module,
  Post,
  Req,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsString } from 'class-validator';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/common/app-setup';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: unknown;
}

// 프로브 DTO/컨트롤러 — 전역 설정만 검증 (Prisma/DB 무관)
class ProbeDto {
  @IsString()
  name!: string;
}

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() dto: ProbeDto) {
    return { ok: true, name: dto.name };
  }

  @Get('cookie')
  readCookie(@Req() req: Request) {
    return { sid: (req.cookies as Record<string, string>)?.sid ?? null };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('전역 설정 (ValidationPipe + cookie-parser) (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('유효한 요청은 통과한다 (/api 프리픽스 적용)', () => {
    return request(app.getHttpServer())
      .post('/api/probe')
      .send({ name: 'kim' })
      .expect(201)
      .expect({ ok: true, name: 'kim' });
  });

  it('검증 실패 시 400 + { statusCode, message, error } 형태를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/probe')
      .send({ name: 123 }) // name은 string이어야 함
      .expect(400);
    const body = res.body as ErrorBody;
    expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect(body.message).toBeDefined();
  });

  it('화이트리스트 외 속성은 forbidNonWhitelisted로 400 거부된다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/probe')
      .send({ name: 'kim', evil: 'x' })
      .expect(400);
    const body = res.body as ErrorBody;
    expect(body.statusCode).toBe(400);
  });

  it('cookie-parser가 적용되어 req.cookies를 읽는다', () => {
    return request(app.getHttpServer())
      .get('/api/probe/cookie')
      .set('Cookie', 'sid=abc123')
      .expect(200)
      .expect({ sid: 'abc123' });
  });
});
