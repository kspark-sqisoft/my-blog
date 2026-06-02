import * as bcrypt from 'bcrypt';
import type { PrismaClient } from '../../generated/prisma/client';

const SALT_ROUNDS = 10;

export interface SeedOperatorParams {
  email: string;
  password: string;
}

// 운영자(User) 1인을 부트스트랩한다 (ADR-0002).
// 비밀번호는 bcrypt 해시로만 저장(평문 미저장). email 기준 upsert로 재실행에 안전.
export async function seedOperator(
  prisma: Pick<PrismaClient, 'user'>,
  { email, password }: SeedOperatorParams,
) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.user.upsert({
    where: { email },
    update: {}, // 기존 계정 유지(비밀번호 변경은 별도 절차)
    create: { email, passwordHash },
  });
}
