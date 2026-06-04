import type { UserRole } from './auth';

// 운영자 사용자 관리 목록 항목 (ADR-0018). email 포함(관리자만 조회).
export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string; // ISO 8601
}

// 역할 변경 입력 (운영자 전용)
export interface UpdateUserRoleDto {
  role: UserRole;
}
