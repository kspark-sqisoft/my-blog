import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CommentDto } from '@blog/shared';
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

  // 공개(익명): Comment 작성. 레이트리밋으로 스팸 억제(NF1, ADR-0009).
  @UseGuards(ThrottlerGuard)
  @Post()
  create(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.create({
      postId,
      body: dto.body,
      displayName: dto.displayName,
      parentId: dto.parentId,
    });
  }
}
