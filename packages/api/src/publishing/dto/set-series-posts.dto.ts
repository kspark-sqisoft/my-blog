import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

// 시리즈 멤버십·순서 원자 재지정 입력 (ADR-0029). postIds 순서가 곧 seriesOrder.
// 빈 배열 허용(전체 해제). 중복 금지(@ArrayUnique), 최대 100건(트랜잭션 비용 상한).
export class SetSeriesPostsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  postIds!: string[];
}
