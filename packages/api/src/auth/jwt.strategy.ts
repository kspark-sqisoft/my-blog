import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUserDto } from '@blog/shared';

interface JwtPayload {
  sub: string;
  email: string;
}

// httpOnly 쿠키 access_token 에서 JWT를 추출한다 (ADR-0001).
const cookieExtractor = (req: Request): string | null => {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me',
    });
  }

  // 검증된 payload → req.user 매핑
  validate(payload: JwtPayload): AuthUserDto {
    return { id: payload.sub, email: payload.email };
  }
}
