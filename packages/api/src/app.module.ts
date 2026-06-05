import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PublishingModule } from './publishing/publishing.module';
import { ConversationModule } from './conversation/conversation.module';
import { EngagementModule } from './engagement/engagement.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PublishingModule,
    ConversationModule,
    EngagementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
