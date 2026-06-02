import { IsEmail, IsString, MinLength } from 'class-validator';

// 운영자 로그인 요청 (api 측 검증 — ADR-0004)
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
