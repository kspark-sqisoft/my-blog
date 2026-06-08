import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUserDto, CommentDto } from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CommentService, type Actor } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

// 수정·삭제 주체 (ADR-0018 actor 패턴). role 은 JwtStrategy 가 DB 재조회로 채운다.
function actorOf(req: Request): Actor {
  const user = req.user as AuthUserDto;
  return { id: user.id, role: user.role };
}

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

  // 수정: 로그인 작성자 본인만(body) — ADR-0027. 미인증 401 → 없음 404 → 본인 아님 403.
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: Request,
  ): Promise<CommentDto> {
    return this.comments.update(id, dto.body, actorOf(req));
  }

  // 삭제: 본인·운영자(ADMIN)·글쓴이 — ADR-0027. 조건부 soft/hard 는 서비스가 판정.
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    return this.comments.remove(id, actorOf(req));
  }
}
