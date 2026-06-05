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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthUserDto,
  Paginated,
  PostDetailDto,
  PostSummaryDto,
  RelatedPostDto,
} from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts.query';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService, type Actor } from './post.service';

// req.user(AuthUserDto)에서 소유권 판정용 actor를 추출 (ADR-0018)
function actorOf(req: Request): Actor {
  const user = req.user as AuthUserDto;
  return { id: user.id, role: user.role };
}

@Controller('posts')
export class PostController {
  constructor(private readonly posts: PostService) {}

  // 공개: 발행 Post 목록
  @Get()
  list(@Query() query: ListPostsQueryDto): Promise<Paginated<PostSummaryDto>> {
    return this.posts.listPublished({
      page: query.page,
      pageSize: query.pageSize,
      tag: query.tag,
      q: query.q,
    });
  }

  // 공개: 관련 글 (태그 겹침 우선 → 최신 보완). :id 보다 먼저 선언해 라우팅 충돌 방지.
  @Get(':id/related')
  related(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ): Promise<RelatedPostDto[]> {
    const n = limit ? Number(limit) : undefined;
    return this.posts.getRelated(id, Number.isFinite(n) ? n : undefined);
  }

  // 공개: 발행 Post 상세 (초안은 404)
  @Get(':id')
  detail(@Param('id') id: string): Promise<PostDetailDto> {
    return this.posts.getPublishedDetail(id);
  }

  // 작성자/운영자: 생성(초안)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Post()
  create(
    @Body() dto: CreatePostDto,
    @Req() req: Request,
  ): Promise<PostDetailDto> {
    return this.posts.create({
      title: dto.title,
      contentMarkdown: dto.contentMarkdown,
      contentHtml: dto.contentHtml,
      authorId: actorOf(req).id,
      tags: dto.tags,
    });
  }

  // 작성자(본인 글)/운영자: 수정
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @Req() req: Request,
  ): Promise<PostDetailDto> {
    return this.posts.update(id, dto, actorOf(req));
  }

  // 작성자(본인 글)/운영자: 발행 / 발행취소
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<PostDetailDto> {
    return this.posts.publish(id, actorOf(req));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<PostDetailDto> {
    return this.posts.unpublish(id, actorOf(req));
  }

  // 작성자(본인 글)/운영자: 삭제
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    return this.posts.remove(id, actorOf(req));
  }
}
