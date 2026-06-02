// e2e 테스트는 개발 DB(blog)가 아닌 테스트 DB(blog_test)를 사용한다.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://blog:blog@127.0.0.1:5433/blog_test?schema=public';
