import {
  BadRequestException,
  Controller,
  Post,
  PayloadTooLargeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadResultDto } from '@blog/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { StorageProvider } from './storage/storage.provider';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4', // T-PUB-202 / ADR-0020
]);
const DEFAULT_MAX_BYTES_IMAGE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_BYTES_VIDEO = 50 * 1024 * 1024; // 50MB

// MIME 화이트리스트 — 이미지 4종 + video/mp4. 위조 차단을 위해 컨트롤러에서 확장자도 함께 검증한다.
const mediaFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
): void => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(
      new BadRequestException('이미지 또는 MP4 비디오만 업로드할 수 있습니다.'),
      false,
    );
    return;
  }
  cb(null, true);
};

// MIME 의 첫 토큰을 응답 type 으로 매핑. 화이트리스트 통과 후이므로 image/video 둘 중 하나.
function resolveMediaType(mimetype: string): 'image' | 'video' {
  return mimetype.startsWith('video/') ? 'video' : 'image';
}

@Controller('uploads')
export class UploadController {
  constructor(private readonly storage: StorageProvider) {}

  // 작성자/운영자 이미지 업로드 (ADR-0012, NF6 / ADR-0018)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('file', { fileFilter: mediaFileFilter }))
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadResultDto> {
    if (!file) {
      throw new BadRequestException('파일(file)이 필요합니다.');
    }
    const type = resolveMediaType(file.mimetype);
    // 이미지/비디오 별 분리 한도 — env 우선, 미설정 시 5MB/50MB.
    const maxBytes =
      type === 'video'
        ? Number(process.env.UPLOAD_MAX_BYTES_VIDEO ?? DEFAULT_MAX_BYTES_VIDEO)
        : Number(process.env.UPLOAD_MAX_BYTES ?? DEFAULT_MAX_BYTES_IMAGE);
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `${type === 'video' ? '비디오' : '이미지'} 크기는 ${maxBytes} bytes를 초과할 수 없습니다.`,
      );
    }

    const saved = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    return {
      url: saved.url,
      contentType: file.mimetype,
      size: file.size,
      type,
    };
  }
}
