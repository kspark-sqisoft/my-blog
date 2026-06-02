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
} from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts.query';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';

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
    });
  }

  // 공개: 발행 Post 상세 (초안은 404)
  @Get(':id')
  detail(@Param('id') id: string): Promise<PostDetailDto> {
    return this.posts.getPublishedDetail(id);
  }

  // 운영자: 생성(초안)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreatePostDto,
    @Req() req: Request,
  ): Promise<PostDetailDto> {
    const user = req.user as AuthUserDto;
    return this.posts.create({
      title: dto.title,
      contentMarkdown: dto.contentMarkdown,
      authorId: user.id,
      tags: dto.tags,
    });
  }

  // 운영자: 수정
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostDetailDto> {
    return this.posts.update(id, dto);
  }

  // 운영자: 발행 / 발행취소
  @UseGuards(JwtAuthGuard)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string): Promise<PostDetailDto> {
    return this.posts.publish(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id') id: string): Promise<PostDetailDto> {
    return this.posts.unpublish(id);
  }

  // 운영자: 삭제
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.posts.remove(id);
  }
}
