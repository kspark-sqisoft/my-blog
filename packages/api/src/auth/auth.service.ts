import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { AuthUserDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

// 자격 증명이 틀렸을 때 사용자 열거(enumeration)를 막기 위해 단일 메시지를 쓴다.
const INVALID_CREDENTIALS = '이메일 또는 비밀번호가 올바르지 않습니다.';
const SALT_ROUNDS = 10;

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

    return this.issue(user);
  }

  // 회원가입: 항상 MEMBER로 생성하고 즉시 로그인 토큰을 발급한다 (ADR-0018).
  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<LoginResult> {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name, role: 'MEMBER' },
    });
    return this.issue(user);
  }

  // 서명 토큰 + 노출용 user(민감정보 제외)를 만든다.
  private async issue(user: {
    id: string;
    email: string;
    name: string;
    role: AuthUserDto['role'];
  }): Promise<LoginResult> {
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
