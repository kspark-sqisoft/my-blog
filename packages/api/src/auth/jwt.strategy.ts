import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUserDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { requireJwtSecret } from './jwt-secret';

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
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      // JWT_SECRET 미설정 시 부팅 차단 (C1)
      secretOrKey: requireJwtSecret(),
    });
  }

  // 검증된 payload의 sub로 User를 매 요청 재조회한다 (ADR-0018).
  // → 역할 승격/강등이 토큰 만료를 기다리지 않고 즉시 반영되고, 삭제된 계정 토큰은 무효화된다.
  async validate(payload: JwtPayload): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
