import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

// 통합 테스트: 실제 DB 연결 필요 (기동된 Postgres).
// 로컬 기본값 — 환경변수가 없으면 dev compose의 db(localhost:5433)로 연결.
process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

// @Global 검증용 소비자: PrismaModule을 직접 import하지 않고 PrismaService를 주입받는다.
@Injectable()
class ConsumerService {
  constructor(readonly prisma: PrismaService) {}
}

@Module({ providers: [ConsumerService] })
class ConsumerModule {}

describe('PrismaService (통합)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let consumer: ConsumerService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ConsumerModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    consumer = moduleRef.get(ConsumerService);
    // onModuleInit(connect) 트리거
    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('PrismaModule이 @Global로 export되어 import 없이 다른 모듈에 주입된다', () => {
    // ConsumerModule은 PrismaModule을 import하지 않았지만 주입에 성공
    expect(consumer.prisma).toBeDefined();
    expect(consumer.prisma).toBe(prisma);
  });

  it('OnModuleInit에서 DB에 연결되어 SELECT 1이 성공한다', async () => {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(Number(rows[0].ok)).toBe(1);
  });

  it('모델 위임이 노출된다 (user.count 호출 가능)', async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe('number');
  });
});
