import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Post 생성 요청 (api 검증 — ADR-0004). authorId는 인증 사용자에서 주입.
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  contentMarkdown!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5) // Tag는 0~5개 (ADR-0006)
  tags?: string[];
}
