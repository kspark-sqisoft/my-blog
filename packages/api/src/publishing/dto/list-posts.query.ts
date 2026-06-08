import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// 발행 목록 쿼리 (?page=&pageSize=&tag=&q=&author=). 쿼리 문자열 → 숫자 변환.
export class ListPostsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  tag?: string;

  // 제목·본문 키워드 검색(부분일치, 대소문자 무시). 비면 전체.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  // 작성자 필터 (author-profile, ADR-0028). User.id(cuid). 없는 author → 빈 목록.
  @IsOptional()
  @IsString()
  author?: string;
}
