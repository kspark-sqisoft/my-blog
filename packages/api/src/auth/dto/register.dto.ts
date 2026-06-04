import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// 회원가입 요청 (ADR-0018). role 필드 없음 → 항상 MEMBER로 생성(whitelist가 role 주입 거부).
export class RegisterDto {
  @IsEmail()
  email!: string;

  // bcrypt 72바이트 상한 + 최소 길이
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}
