import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { AuthUserDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

// 자격 증명이 틀렸을 때 사용자 열거(enumeration)를 막기 위해 단일 메시지를 쓴다.
const INVALID_CREDENTIALS = '이메일 또는 비밀번호가 올바르지 않습니다.';

export interface LoginResult {
  accessToken: string;
  user: AuthUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // 운영자 자격을 검증하고 서명된 JWT를 발급한다 (ADR-0001).
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
