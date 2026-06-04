import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

@Module({
  // AuthModule: OptionalJwtAuthGuard(JwtStrategy) 사용 (ADR-0018)
  // Comment 작성 레이트리밋: 60초당 10회 (ADR-0009)
  imports: [AuthModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class ConversationModule {}
