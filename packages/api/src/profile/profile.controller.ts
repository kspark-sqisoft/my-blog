import {
  BadRequestException,
  Controller,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AvatarUploadResultDto } from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageProvider } from '../publishing/storage/storage.provider';

// 아바타는 이미지 전용 (ADR-0025). 운영자 업로드(/api/uploads, 비디오 포함)와 분리.
const ALLOWED_AVATAR_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);
const DEFAULT_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB

const avatarFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
): void => {
  if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
    cb(
      new BadRequestException('이미지(jpeg/png/gif/webp)만 올릴 수 있습니다.'),
      false,
    );
    return;
  }
  cb(null, true);
};

// 아바타 업로드 (ADR-0025): 로그인한 모든 사용자(역할 무관). 저장 후 URL 만 반환(영속화는 PATCH /auth/me).
@Controller('profile')
export class ProfileController {
  constructor(private readonly storage: StorageProvider) {}

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { fileFilter: avatarFileFilter }))
  async uploadAvatar(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<AvatarUploadResultDto> {
    if (!file) {
      throw new BadRequestException('파일(file)이 필요합니다.');
    }
    const maxBytes = Number(
      process.env.AVATAR_MAX_BYTES ?? DEFAULT_AVATAR_MAX_BYTES,
    );
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `아바타 이미지 크기는 ${maxBytes} bytes를 초과할 수 없습니다.`,
      );
    }
    const saved = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    return { url: saved.url };
  }
}
