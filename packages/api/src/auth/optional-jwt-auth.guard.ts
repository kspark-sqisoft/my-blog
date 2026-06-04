import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// 선택적 인증 가드 (ADR-0018). 토큰이 없거나 무효여도 401을 던지지 않고 통과시킨다.
// 로그인 시에는 req.user가 채워지고(실명), 비로그인 시에는 undefined(익명)로 진행한다.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // 토큰이 유효하면 검증을 수행하되, 비로그인은 허용한다.
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // 인증 실패(에러/유저 없음)여도 throw하지 않고 undefined를 반환한다.
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser | undefined {
    return user ?? undefined;
  }
}
