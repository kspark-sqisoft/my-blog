import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from './seed-operator';

// 통합 테스트: 실제 DB 필요 (dev compose db, localhost:5433 기본)
process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('seedOperator (통합)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const params = { email: 'owner@example.com', password: 'secret123' };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await moduleRef?.close();
  });

  it('운영자 계정을 생성하고 비밀번호는 bcrypt 해시로 저장한다(평문 미저장)', async () => {
    const user = await seedOperator(prisma, params);
    expect(user.email).toBe(params.email);
    expect(user.passwordHash).not.toBe(params.password);
    expect(await bcrypt.compare(params.password, user.passwordHash)).toBe(true);
  });

  it('재실행해도 동일 email은 중복 생성하지 않는다(upsert)', async () => {
    await seedOperator(prisma, params);
    await seedOperator(prisma, params);
    expect(await prisma.user.count()).toBe(1);
  });

  it('시드 후 User가 정확히 1건 존재한다', async () => {
    await seedOperator(prisma, params);
    expect(await prisma.user.count()).toBe(1);
  });
});
