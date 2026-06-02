import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

@Module({
  // Comment 작성 레이트리밋: 60초당 10회 (ADR-0009)
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class ConversationModule {}
