import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Post 수정 요청 (모든 필드 선택). ADR-0021: contentHtml 도 받음(서비스가 sanitize).
export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  tags?: string[];
}
