import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@blog/shared';

// @Roles(...)로 핸들러/컨트롤러에 필요한 역할을 메타데이터로 지정한다 (ADR-0018).
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
