import { Controller, Get, Param } from '@nestjs/common';
import type { AuthorProfileDto } from '@blog/shared';
import { UserService } from './user.service';

// 공개 작성자 프로필 API (ADR-0028). 인증 불필요 — 누구나 조회.
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  // 공개: id(cuid)로 작성자 프로필 조회. 없는 id → 404. 이메일 비노출.
  @Get(':id')
  getProfile(@Param('id') id: string): Promise<AuthorProfileDto> {
    return this.users.getPublicProfile(id);
  }
}
