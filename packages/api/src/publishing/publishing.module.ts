import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPostController } from './admin-post.controller';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { UploadController } from './upload.controller';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { StorageProvider } from './storage/storage.provider';
import { SeoController } from './seo/seo.controller';
import { OgController } from './seo/og.controller';
import { FeedService } from './seo/feed.service';
import { SitemapService } from './seo/sitemap.service';
import { OgMetaService } from './seo/og-meta.service';

@Module({
  // AuthModule import → JwtStrategy 인스턴스화로 JwtAuthGuard 동작
  imports: [AuthModule],
  controllers: [
    PostController,
    AdminPostController,
    TagController,
    UploadController,
    SeoController,
    OgController,
  ],
  providers: [
    PostService,
    TagService,
    FeedService,
    SitemapService,
    OgMetaService,
    // 저장소 추상화: 로컬 → S3 확장은 useClass 교체로 (ADR-0012)
    { provide: StorageProvider, useClass: LocalStorageProvider },
  ],
  exports: [PostService, TagService],
})
export class PublishingModule {}
