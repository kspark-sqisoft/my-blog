import { UnauthorizedException } from '@nestjs/common';
import type { AuthUserDto } from '@blog/shared';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

// passport-jwt 가 handleRequest 로 넘기는 인자 형태:
// - 토큰 없음:   err=null, user=false, info={ message: 'No auth token' }
// - 토큰 만료:   err=null, user=false, info=TokenExpiredError (name='TokenExpiredError')
// - 토큰 위조:   err=null, user=false, info=JsonWebTokenError (name='JsonWebTokenError')
// - 정상:        err=null, user={...AuthUserDto}, info=undefined
//
// H3: 토큰 자체에 문제가 있는 경우(만료/위조)는 익명 통과시키지 말고 401 로 명시한다.
//     "헤더 없음(=비로그인)"만 익명 통과한다.
describe('OptionalJwtAuthGuard.handleRequest', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('토큰 없음(헤더 없음)은 익명 통과 → undefined', () => {
    const info = { message: 'No auth token' };
    expect(guard.handleRequest(null, false, info)).toBeUndefined();
  });

  it('TokenExpiredError 는 UnauthorizedException 으로 차단 (H3)', () => {
    const info = Object.assign(new Error('jwt expired'), {
      name: 'TokenExpiredError',
    });
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      UnauthorizedException,
    );
  });

  it('JsonWebTokenError(위조/잘못된 서명) 는 UnauthorizedException 으로 차단 (H3)', () => {
    const info = Object.assign(new Error('invalid signature'), {
      name: 'JsonWebTokenError',
    });
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      UnauthorizedException,
    );
  });

  it('NotBeforeError 도 UnauthorizedException 으로 차단', () => {
    const info = Object.assign(new Error('jwt not active'), {
      name: 'NotBeforeError',
    });
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      UnauthorizedException,
    );
  });

  it('정상 user 면 user 그대로 반환', () => {
    const user: AuthUserDto = {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'AUTHOR',
    };
    expect(guard.handleRequest<AuthUserDto>(null, user, undefined)).toEqual(
      user,
    );
  });

  it('err 가 명시적 Error 면 그대로 던진다', () => {
    const err = new Error('passport internal');
    expect(() => guard.handleRequest(err, false, undefined)).toThrow(err);
  });
});
