// e2e 테스트 공통 환경. AppModule 부팅 시 Prisma 연결에 DATABASE_URL이 필요하다.
// 미설정 시 dev compose의 db(localhost:5433)를 기본값으로 사용.
process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';
