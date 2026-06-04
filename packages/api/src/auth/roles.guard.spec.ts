import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@blog/shared';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

// Reflector·ExecutionContext를 가짜로 구성해 순수 권한 분기만 검증한다.
function makeContext(user: { role: UserRole } | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(required: UserRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === ROLES_KEY ? required : undefined,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('@Roles 메타데이터가 없으면 통과한다(역할 무관 엔드포인트)', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext({ role: 'MEMBER' }))).toBe(true);
  });

  it('빈 역할 배열이면 통과한다', () => {
    const guard = makeGuard([]);
    expect(guard.canActivate(makeContext({ role: 'MEMBER' }))).toBe(true);
  });

  it('user.role이 요구 역할에 포함되면 통과한다', () => {
    const guard = makeGuard(['AUTHOR', 'ADMIN']);
    expect(guard.canActivate(makeContext({ role: 'AUTHOR' }))).toBe(true);
    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('user.role이 요구 역할에 없으면 ForbiddenException', () => {
    const guard = makeGuard(['ADMIN']);
    expect(() => guard.canActivate(makeContext({ role: 'MEMBER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('user가 없으면 ForbiddenException', () => {
    const guard = makeGuard(['ADMIN']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
