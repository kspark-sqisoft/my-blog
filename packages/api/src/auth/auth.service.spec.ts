import { UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { seedOperator } from './seed-operator';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';
process.env.JWT_SECRET ??= 'test-secret';

describe('AuthService (통합)', () => {
  let moduleRef: TestingModule;
  let service: AuthService;
  let prisma: PrismaService;

  const email = 'owner@example.com';
  const password = 'secret123';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        PrismaModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [AuthService],
    }).compile();
    service = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await seedOperator(prisma, { email, password });
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await moduleRef?.close();
  });

  it('올바른 자격이면 서명된 JWT 문자열과 user를 반환한다', async () => {
    const res = await service.login(email, password);
    expect(typeof res.accessToken).toBe('string');
    expect(res.accessToken.split('.')).toHaveLength(3); // header.payload.signature
    expect(res.user.email).toBe(email);
    expect(typeof res.user.id).toBe('string');
    expect(res.user.id.length).toBeGreaterThan(0);
    // name·role 포함 (ADR-0018). 시드 운영자는 ADMIN
    expect(res.user.name.length).toBeGreaterThan(0);
    expect(res.user.role).toBe('ADMIN');
  });

  it('비밀번호가 틀리면 UnauthorizedException', async () => {
    await expect(service.login(email, 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('없는 email과 틀린 비밀번호는 동일한 메시지로 거부한다(사용자 열거 방지)', async () => {
    const msgNoUser = await service
      .login('nobody@example.com', password)
      .catch((e: Error) => e.message);
    const msgBadPw = await service
      .login(email, 'wrong-password')
      .catch((e: Error) => e.message);
    expect(msgNoUser).toBe(msgBadPw);
  });
});
