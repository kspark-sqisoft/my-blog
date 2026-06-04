import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Post 생성 요청 (api 검증 — ADR-0004). authorId는 인증 사용자에서 주입.
// ADR-0021 과도기: contentHtml 우선, 없으면 contentMarkdown 을 마크다운 변환 후 sanitize.
// 둘 다 비면 서비스 계층에서 400.
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5) // Tag는 0~5개 (ADR-0006)
  tags?: string[];
}
