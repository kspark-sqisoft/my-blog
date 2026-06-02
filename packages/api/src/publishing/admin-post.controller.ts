import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminPostSummaryDto, Paginated } from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListPostsQueryDto } from './dto/list-posts.query';
import { PostService } from './post.service';

// 운영자 전용 Post 목록 (초안 포함). JwtAuthGuard 보호.
@UseGuards(JwtAuthGuard)
@Controller('admin/posts')
export class AdminPostController {
  constructor(private readonly posts: PostService) {}

  @Get()
  list(
    @Query() query: ListPostsQueryDto,
  ): Promise<Paginated<AdminPostSummaryDto>> {
    return this.posts.listForAdmin({
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
