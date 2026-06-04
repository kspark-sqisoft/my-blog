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
]);
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB

// 이미지 MIME 화이트리스트 (decorator-time 정의, 요청마다 실행)
const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
): void => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(new BadRequestException('이미지 파일만 업로드할 수 있습니다.'), false);
    return;
  }
  cb(null, true);
};

@Controller('uploads')
export class UploadController {
  constructor(private readonly storage: StorageProvider) {}

  // 작성자/운영자 이미지 업로드 (ADR-0012, NF6 / ADR-0018)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUTHOR', 'ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('file', { fileFilter: imageFileFilter }))
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadResultDto> {
    if (!file) {
      throw new BadRequestException('파일(file)이 필요합니다.');
    }
    const maxBytes = Number(process.env.UPLOAD_MAX_BYTES ?? DEFAULT_MAX_BYTES);
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `파일 크기는 ${maxBytes} bytes를 초과할 수 없습니다.`,
      );
    }

    const saved = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    return { url: saved.url, contentType: file.mimetype, size: file.size };
  }
}
