import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// 시리즈 생성 입력 (ADR-0029). 전역 ValidationPipe(whitelist+forbidNonWhitelisted) 적용.
export class CreateSeriesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  // null/미지정 = 설명 없음. 문자열이면 최대 500자.
  @IsOptional()
  @ValidateIf((o: CreateSeriesDto) => o.description !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
