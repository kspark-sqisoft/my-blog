import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// 프로필 수정 입력 (ADR-0025): 이름·아바타만. 전역 ValidationPipe(whitelist+forbidNonWhitelisted)가 적용된다.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  // null = 아바타 제거. 문자열이면 로컬 /uploads 경로만 허용(외부 URL 거부, ADR-0025).
  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => o.avatarUrl !== null)
  @IsString()
  @Matches(/^\/uploads\//, {
    message: 'avatarUrl은 /uploads 로 시작하는 로컬 경로여야 합니다.',
  })
  avatarUrl?: string | null;
}
