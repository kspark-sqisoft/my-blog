import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  // AuthModule import → JwtStrategy 인스턴스화로 JwtAuthGuard 동작
  imports: [AuthModule],
  controllers: [PostController, TagController],
  providers: [PostService, TagService],
  exports: [PostService, TagService],
})
export class PublishingModule {}
