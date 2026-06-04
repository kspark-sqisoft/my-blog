import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminUserDto, Paginated } from '@blog/shared';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersQueryDto } from './dto/users.query';
import { UserAdminService } from './user-admin.service';

// 운영자 전용 사용자 관리 API (ADR-0018)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/users')
export class UserAdminController {
  constructor(private readonly users: UserAdminService) {}

  @Get()
  list(@Query() query: UsersQueryDto): Promise<Paginated<AdminUserDto>> {
    return this.users.list({ page: query.page, pageSize: query.pageSize });
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<AdminUserDto> {
    return this.users.updateRole(id, dto.role);
  }
}
