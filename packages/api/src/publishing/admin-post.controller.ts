import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type {
  AdminPostSummaryDto,
  Paginated,
  PostDetailDto,
} from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListPostsQueryDto } from './dto/list-posts.query';
import { PostService } from './post.service';

// 운영자 전용 Post API (초안 포함). JwtAuthGuard 보호.
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

  // 단건 상세 (초안 포함) — 편집 화면 로드용
  @Get(':id')
  detail(@Param('id') id: string): Promise<PostDetailDto> {
    return this.posts.getForAdmin(id);
  }
}
