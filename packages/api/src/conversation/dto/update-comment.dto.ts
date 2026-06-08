import { IsString, MaxLength, MinLength } from 'class-validator';
import { COMMENT_BODY_MAX } from './create-comment.dto';

// Comment 수정 요청 (로그인 작성자 본인만, body 만 — ADR-0027).
// 길이 상한은 작성(CreateCommentDto)과 동일 상수 재사용.
export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_BODY_MAX)
  body!: string;
}
