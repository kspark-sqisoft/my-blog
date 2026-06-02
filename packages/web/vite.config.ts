import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 컨테이너 외부에서 접속 허용
    port: 5173,
    watch: {
      // Docker 바인드 마운트(특히 Windows)에서 파일 변경 감지를 위한 폴링
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
  },
})
