import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserDto, SeriesDetailDto } from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import type { Actor } from './post.service';
import { SeriesService } from './series.service';

// req.user(AuthUserDto)에서 소유권 판정용 actor 추출 (ADR-0018)
function actorOf(req: Request): Actor {
  const user = req.user as AuthUserDto;
  return { id: user.id, role: user.role };
}

@Controller('series')
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  // 작성자/운영자: 시리즈 생성
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Post()
  create(
    @Body() dto: CreateSeriesDto,
    @Req() req: Request,
  ): Promise<SeriesDetailDto> {
    return this.series.create(dto, actorOf(req));
  }

  // 소유자/운영자: 제목·설명 수정 (slug 불변)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSeriesDto,
    @Req() req: Request,
  ): Promise<SeriesDetailDto> {
    return this.series.update(id, dto, actorOf(req));
  }

  // 소유자/운영자: 삭제 (소속 글은 SetNull 로 보존)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    return this.series.remove(id, actorOf(req));
  }
}
