import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedOperator } from '../src/auth/seed-operator';

// 운영자 계정 부트스트랩 엔트리 (ADR-0002).
// 실행: pnpm --filter api db:seed (OPERATOR_EMAIL/OPERATOR_PASSWORD/DATABASE_URL 필요)
async function main(): Promise<void> {
  const email = process.env.OPERATOR_EMAIL;
  const password = process.env.OPERATOR_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'OPERATOR_EMAIL과 OPERATOR_PASSWORD 환경변수가 필요합니다.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const user = await seedOperator(prisma, { email, password });
    console.log(`운영자 계정 준비 완료: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
