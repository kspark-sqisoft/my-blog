# @blog/api - NestJS 백엔드

## 명령- 개발: `pnpm	dev` (포트 3001)- 테스트: `pnpm	test` (Jest)- E2E: `pnpm	test:e2e`- 마이그레이션: `pnpm	prisma	migrate	dev`

## 아키텍처- 모듈 기반 (NestJS 표준). 각 모듈 = Bounded Context (docs/bounded-contexts.md 참고)- ORM: Prisma. 스키마는 prisma/schema.prisma 단일 파일- 인증: JWT (Passport). AuthGuard 는 @UseGuards(JwtAuthGuard) 로 적용- DTO: class-validator 데코레이터 필수. ValidationPipe 가 글로벌 적용됨- 에러: HttpException 만 throw. 커스텀 에러 클래스 만들지 말 것

## DB 스키마 변경 규칙

1. prisma/schema.prisma 수정
2. `pnpm	prisma	migrate	dev	--name	{설명}` 실행
3. 마이그레이션 파일을 git에 commit
4. seed 데이터가 영향받으면 prisma/seed.ts 도 업데이트

## API 응답 포맷 (고정)- 성공: { "data": <T>, "meta": { ... } }- 실패: { "error": { "code": "...", "message": "..." } }

## TDD 규칙 (NestJS 적용)- 새 엔드포인트는 반드시 test/{domain}.e2e-spec.ts 의 실패 테스트부터- 단위 테스트는 _.spec.ts (서비스 레이어), e2e는 test/_.e2e-spec.ts- "테스트 통과" 주장은 실제 pnpm test 출력으로만 인정
