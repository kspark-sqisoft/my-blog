// e2e 테스트는 개발 DB(blog)가 아닌 테스트 DB(blog_test)를 사용한다.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://blog:blog@127.0.0.1:5433/blog_test?schema=public';

// JWT_SECRET 은 AuthModule 부트에서 강제된다 (C1). e2e 전반에 기본값을 보장해
// 신규 spec 이 환경변수를 깔아주는 걸 잊어도 부트가 실패하지 않게 한다.
process.env.JWT_SECRET ??= 'test-secret';
