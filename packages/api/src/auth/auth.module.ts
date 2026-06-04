import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './user-admin.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      // JWT_SECRET 환경변수에서 서명 비밀 주입 (ADR-0001)
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'change-me',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController, UserAdminController],
  // RolesGuard·JwtStrategy를 export → 다른 모듈(@UseGuards)에서 RBAC 사용 (ADR-0018)
  providers: [AuthService, JwtStrategy, RolesGuard, UserAdminService],
  exports: [RolesGuard, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
