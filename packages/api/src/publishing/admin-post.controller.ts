import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type {
  AdminPostSummaryDto,
  AuthUserDto,
  Paginated,
  PostDetailDto,
} from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListPostsQueryDto } from './dto/list-posts.query';
import { PostService, type Actor } from './post.service';

// req.user(AuthUserDto)에서 스코프 판정용 actor를 추출 (ADR-0018/0019)
function actorOf(req: Request): Actor {
  const user = req.user as AuthUserDto;
  return { id: user.id, role: user.role };
}

// 작성자/운영자 Post API (초안 포함). ADMIN은 전체, AUTHOR는 본인 글만 (ADR-0019).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AUTHOR', 'ADMIN')
@Controller('admin/posts')
export class AdminPostController {
  constructor(private readonly posts: PostService) {}

  @Get()
  list(
    @Query() query: ListPostsQueryDto,
    @Req() req: Request,
  ): Promise<Paginated<AdminPostSummaryDto>> {
    return this.posts.listForAdmin(
      { page: query.page, pageSize: query.pageSize },
      actorOf(req),
    );
  }

  // 단건 상세 (초안 포함) — 편집 화면 로드용
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: Request): Promise<PostDetailDto> {
    return this.posts.getForAdmin(id, actorOf(req));
  }
}
