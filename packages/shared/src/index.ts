// @blog/shared — 프론트·백엔드 공유 타입 계약 (ADR-0004: 순수 TS 타입, 검증은 각 패키지)
export type {
  PostStatus,
  PostSummaryDto,
  PostDetailDto,
  AdminPostSummaryDto,
  CreatePostDto,
  UpdatePostDto,
} from './dto/post';
export type { CommentDto, CreateCommentDto } from './dto/comment';
export type { TagDto } from './dto/tag';
export type { AuthUserDto, UserRole, RegisterDto } from './dto/auth';
export type { AdminUserDto, UpdateUserRoleDto } from './dto/user';
export type { UploadResultDto } from './dto/upload';
export type { Paginated } from './dto/pagination';
// 본문 HTML 화이트리스트 (ADR-0021). 서버/클라 sanitize 단일 소스.
export {
  richHtmlSchema,
  RICH_HTML_SPAN_CLASSES,
  RICH_HTML_ALIGN_CLASSES,
} from './rich-html-schema';
export type {
  RichHtmlSchema,
  RichHtmlSpanClass,
  RichHtmlAlignClass,
} from './rich-html-schema';
