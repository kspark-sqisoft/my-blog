import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// passport-jwt 가 info 로 넘기는 토큰 자체 오류의 name 집합.
// 이 케이스들은 "유효한 토큰을 줬지만 무효"이므로 익명 통과시키지 않고 401 로 명시한다 (H3).
const JWT_TOKEN_ERROR_NAMES = new Set([
  'TokenExpiredError',
  'JsonWebTokenError',
  'NotBeforeError',
]);

// 선택적 인증 가드 (ADR-0018).
// - 토큰이 아예 없으면(헤더 없음) 비로그인으로 간주하고 통과시킨다.
// - 토큰이 있는데 만료/위조면 익명 강등(silent demotion)을 막기 위해 401을 던진다 (H3).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // 토큰 검증 자체는 부모(AuthGuard('jwt'))가 수행한다.
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // 부모 인증 결과를 후처리한다.
  // err: passport 가 명시적으로 던진 에러(거의 null)
  // user: 검증 성공 시 payload 변환 결과, 실패 시 false
  // info: 실패 사유(에러 인스턴스 또는 { message } 형태)
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info?: unknown,
  ): TUser | undefined {
    if (err instanceof Error) {
      throw err;
    }
    if (this.isTokenError(info)) {
      throw new UnauthorizedException();
    }
    // 그 외(헤더 없음 = info.message === 'No auth token' 또는 user 객체) → 비로그인 통과
    return user ? user : undefined;
  }

  private isTokenError(info: unknown): boolean {
    if (!info || typeof info !== 'object') return false;
    const name = (info as { name?: unknown }).name;
    return typeof name === 'string' && JWT_TOKEN_ERROR_NAMES.has(name);
  }
}
