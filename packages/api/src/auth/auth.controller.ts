import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUserDto } from '@blog/shared';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const ACCESS_COOKIE = 'access_token';
const ONE_HOUR_MS = 60 * 60 * 1000;

// JWT를 httpOnly 쿠키로 굽는다 (ADR-0001). login·register 공통.
function setAuthCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_HOUR_MS,
    path: '/',
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 운영자/회원 로그인 → httpOnly 쿠키로 JWT 발급 (ADR-0001)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const { accessToken, user } = await this.auth.login(
      dto.email,
      dto.password,
    );
    setAuthCookie(res, accessToken);
    return { user };
  }

  // 회원가입 → MEMBER 생성 + 즉시 로그인(쿠키) (ADR-0018). 201 반환.
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserDto }> {
    const { accessToken, user } = await this.auth.register(
      dto.email,
      dto.password,
      dto.name,
    );
    setAuthCookie(res, accessToken);
    return { user };
  }

  // 로그아웃 → 쿠키 만료
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    return { success: true };
  }

  // 현재 운영자 확인 (인증 필요)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request): { user: AuthUserDto } {
    return { user: req.user as AuthUserDto };
  }

  // 프로필 수정 (ADR-0025): 본인 이름·아바타만. 인증 필요.
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ): Promise<{ user: AuthUserDto }> {
    const actor = req.user as AuthUserDto;
    const user = await this.auth.updateProfile(actor.id, {
      name: dto.name,
      avatarUrl: dto.avatarUrl,
    });
    return { user };
  }
}
