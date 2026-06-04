import * as bcrypt from 'bcrypt';
import type { PrismaClient } from '../../generated/prisma/client';

const SALT_ROUNDS = 10;

export interface SeedOperatorParams {
  email: string;
  password: string;
  name?: string; // 작성자 표시 이름(ADR-0017). 미지정 시 email 로컬파트 사용
}

// 운영자(User) 1인을 부트스트랩한다 (ADR-0002).
// 비밀번호는 bcrypt 해시로만 저장(평문 미저장). email 기준 upsert로 재실행에 안전.
export async function seedOperator(
  prisma: Pick<PrismaClient, 'user'>,
  { email, password, name }: SeedOperatorParams,
) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const displayName = name ?? email.split('@')[0]; // 미지정 시 @ 앞부분
  return prisma.user.upsert({
    where: { email },
    update: {}, // 기존 계정 유지(비밀번호 변경은 별도 절차)
    create: { email, passwordHash, name: displayName },
  });
}
