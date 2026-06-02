import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const BODY_MAX = 1000; // Comment 본문 길이 상한 (스팸 억제 — NF1)

// Comment 작성 요청 (익명 가능, api 검증 — ADR-0004)
export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(BODY_MAX)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
