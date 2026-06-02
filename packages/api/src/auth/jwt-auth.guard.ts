import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// 쓰기 엔드포인트 보호용 가드 (passport-jwt 전략 사용).
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
