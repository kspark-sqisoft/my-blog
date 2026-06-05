import { z } from 'zod';

// 프로필 수정 입력 (ADR-0025). 이름 + 아바타만. 웹 폼·검증의 단일 소스(서버는 class-validator 로 별도 강제).
// avatarUrl: 로컬 업로드 경로(/uploads/...) 또는 null(아바타 제거). 외부 URL 거부.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요').max(50, '이름은 50자 이하여야 합니다'),
  avatarUrl: z
    .string()
    .regex(/^\/uploads\//, '아바타 경로가 올바르지 않습니다')
    .nullable(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

// 아바타 업로드 응답 (ADR-0025).
export interface AvatarUploadResultDto {
  url: string; // 로컬 /uploads 경로
}
