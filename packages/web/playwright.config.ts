import { defineConfig, devices } from '@playwright/test';

// E2E 설정 (T-WEB-008).
// 사전 조건: docker compose dev 스택(web:5173, api:3001, db:5433)이 떠 있어야 한다.
//   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
// 공유 dev DB(blog) 상태를 변경하므로 워커 1개로 직렬 실행한다.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
