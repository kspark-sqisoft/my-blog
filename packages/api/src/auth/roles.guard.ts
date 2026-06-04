import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUserDto, UserRole } from '@blog/shared';
import { ROLES_KEY } from './roles.decorator';

// 정적 역할 인가 가드 (ADR-0018). JwtAuthGuard(인증) 다음에 실행한다.
// 리소스 소유권(AUTHOR 본인 글)은 가드가 아니라 서비스 계층에서 판정한다.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    // @Roles가 없거나 빈 배열이면 역할 무관 — 통과(인증 여부는 JwtAuthGuard가 담당)
    if (!required || required.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: AuthUserDto }>();
    const user = req.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('이 작업을 수행할 권한이 없습니다.');
    }
    return true;
  }
}
