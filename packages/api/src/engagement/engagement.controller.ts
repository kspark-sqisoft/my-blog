import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserDto, LikeStateDto, ViewCountDto } from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EngagementService } from './engagement.service';
import { visitorKeyFrom } from './visitor-key';

// 참여(Engagement) 엔드포인트 (ADR-0024). 좋아요는 로그인 필수, 조회는 공개.
@Controller('posts/:postId')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  // 좋아요(로그인 필수, 멱등) → 현재 상태
  @UseGuards(JwtAuthGuard)
  @Post('like')
  @HttpCode(HttpStatus.OK)
  like(
    @Param('postId') postId: string,
    @Req() req: Request,
  ): Promise<LikeStateDto> {
    const user = req.user as AuthUserDto;
    return this.engagement.like(postId, user.id);
  }

  // 좋아요 취소(로그인 필수, 멱등) → 현재 상태
  @UseGuards(JwtAuthGuard)
  @Delete('like')
  @HttpCode(HttpStatus.OK)
  unlike(
    @Param('postId') postId: string,
    @Req() req: Request,
  ): Promise<LikeStateDto> {
    const user = req.user as AuthUserDto;
    return this.engagement.unlike(postId, user.id);
  }

  // 조회 기록(공개, 30분 dedup) → 현재 조회수.
  // OptionalJwtAuthGuard: 로그인이면 user 기준, 아니면 ip|ua 해시로 방문자 식별.
  @UseGuards(OptionalJwtAuthGuard)
  @Post('view')
  @HttpCode(HttpStatus.OK)
  view(
    @Param('postId') postId: string,
    @Req() req: Request,
  ): Promise<ViewCountDto> {
    const user = req.user as AuthUserDto | undefined;
    return this.engagement.recordView(postId, visitorKeyFrom(req, user?.id));
  }
}
