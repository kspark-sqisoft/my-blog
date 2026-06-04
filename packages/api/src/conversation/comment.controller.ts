import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUserDto, CommentDto } from '@blog/shared';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('posts/:postId/comments')
export class CommentController {
  constructor(private readonly comments: CommentService) {}

  // 공개: 해당 Post의 Comment 목록(깊이 2 중첩)
  @Get()
  list(@Param('postId') postId: string): Promise<CommentDto[]> {
    return this.comments.listByPost(postId);
  }

  // 공개: Comment 작성. 로그인이면 실명(userId), 비로그인이면 익명(displayName) — ADR-0018.
  // OptionalJwtAuthGuard는 토큰이 없어도 통과시킨다. 레이트리밋으로 스팸 억제(NF1, ADR-0009).
  @UseGuards(OptionalJwtAuthGuard, ThrottlerGuard)
  @Post()
  create(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ): Promise<CommentDto> {
    const user = req.user as AuthUserDto | undefined;
    return this.comments.create({
      postId,
      body: dto.body,
      // 로그인 회원이면 displayName 입력은 무시하고 계정 이름을 쓴다
      displayName: user ? undefined : dto.displayName,
      parentId: dto.parentId,
      userId: user?.id,
    });
  }
}
