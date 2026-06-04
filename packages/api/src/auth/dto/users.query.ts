import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

// 사용자 목록 쿼리 (?page=&pageSize=). 쿼리 문자열 → 숫자 변환.
export class UsersQueryDto {
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
}
