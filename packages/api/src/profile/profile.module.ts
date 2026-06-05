import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LocalStorageProvider } from '../publishing/storage/local-storage.provider';
import { StorageProvider } from '../publishing/storage/storage.provider';
import { ProfileController } from './profile.controller';

// 프로필(Auth Context 확장, ADR-0025): 아바타 업로드.
// AuthModule → JwtAuthGuard 동작. StorageProvider 는 Publishing 과 동일 클래스를 독립 바인딩
// (모듈 간 결합 회피 — LocalStorageProvider 는 env 기반 stateless).
@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [{ provide: StorageProvider, useClass: LocalStorageProvider }],
})
export class ProfileModule {}
