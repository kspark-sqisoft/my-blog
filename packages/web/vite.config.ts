/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 컨테이너 외부에서 접속 허용
    port: 5173,
    watch: {
      // Docker 바인드 마운트(특히 Windows)에서 파일 변경 감지를 위한 폴링
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
    proxy: {
      // 개발 시 /api 요청을 백엔드로 프록시.
      // 로컬: http://localhost:3000 / Docker: http://api:3000 (VITE_API_PROXY)
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:3000',
      // 업로드 이미지(/uploads)도 백엔드 정적 서빙으로 프록시 (그렇지 않으면 SPA fallback HTML 반환)
      '/uploads': process.env.VITE_API_PROXY ?? 'http://localhost:3000',
      // seo-feed 산출물(ADR-0026): dev 에서도 api 로 프록시 (prod 는 nginx 가 동일 역할)
      '/feed.xml': process.env.VITE_API_PROXY ?? 'http://localhost:3000',
      '/sitemap.xml': process.env.VITE_API_PROXY ?? 'http://localhost:3000',
      '/robots.txt': process.env.VITE_API_PROXY ?? 'http://localhost:3000',
      '/og': process.env.VITE_API_PROXY ?? 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Playwright E2E(e2e/*.spec.ts)는 Vitest 대상에서 제외
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
