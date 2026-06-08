import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// 시리즈 수정 입력 (ADR-0029). title·description 부분 수정. slug 는 불변(서비스).
export class UpdateSeriesDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @ValidateIf((o: UpdateSeriesDto) => o.description !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
