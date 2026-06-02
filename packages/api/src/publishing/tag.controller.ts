import { Controller, Get } from '@nestjs/common';
import type { TagDto } from '@blog/shared';
import { TagService } from './tag.service';

@Controller('tags')
export class TagController {
  constructor(private readonly tags: TagService) {}

  // 공개: 발행 Post에 쓰인 Tag 목록 + postCount
  @Get()
  list(): Promise<TagDto[]> {
    return this.tags.listUsedTags();
  }
}
