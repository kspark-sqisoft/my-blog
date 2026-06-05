import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

// 참여(Engagement) Context (ADR-0024): 좋아요/조회수.
// AuthModule import → JwtStrategy 인스턴스화로 Jwt/OptionalJwt 가드 동작.
@Module({
  imports: [AuthModule],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
