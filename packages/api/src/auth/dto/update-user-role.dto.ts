import { IsIn } from 'class-validator';
import type { UserRole } from '@blog/shared';

const ROLES: UserRole[] = ['ADMIN', 'AUTHOR', 'MEMBER'];

// 역할 변경 요청 (운영자 전용 — ADR-0018)
export class UpdateUserRoleDto {
  @IsIn(ROLES)
  role!: UserRole;
}
