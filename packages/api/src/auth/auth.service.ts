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

  // 회원가입: 항상 AUTHOR로 생성하고 즉시 로그인 토큰을 발급한다 (ADR-0019).
  // 공개 가입자는 가입 즉시 본인 글을 쓸 수 있다(ADR-0018의 기본 MEMBER를 갱신).
  // 클라이언트가 role을 지정할 수 없도록 서버가 강제한다(화이트리스트).
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
      data: { email, passwordHash, name, role: 'AUTHOR' },
    });
    return this.issue(user);
  }

  // 서명 토큰 + 노출용 user(민감정보 제외)를 만든다.
  private async issue(user: {
    id: string;
    email: string;
    name: string;
    role: AuthUserDto['role'];
    avatarUrl: string | null;
    bio: string | null;
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
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
    };
  }

  // 프로필 수정 (ADR-0025): 본인 이름·아바타만. avatarUrl 은 로컬 /uploads 경로 또는 null.
  // (경로 형식 검증은 컨트롤러 DTO(class-validator)가 강제한다.)
  async updateProfile(
    userId: string,
    input: { name?: string; avatarUrl?: string | null; bio?: string | null },
  ): Promise<AuthUserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.bio !== undefined && { bio: input.bio }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        bio: true,
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }
}
