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
      // 개발 시 /api 요청을 로컬 api 서버(3000)로 프록시
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
